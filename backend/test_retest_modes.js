const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function report(label, data) {
  console.log(`\n=== ${label} ===`);
  if (typeof data === 'object') console.log(JSON.stringify(data, null, 2));
  else console.log(data);
}

async function main() {
  // ── 1. Hermes Direct mode: check existing jobs and their flow ──
  report('MODE 1: HERMES_DIRECT — Check existing jobs');
  
  const directJobs = await prisma.aiVulnerabilityRetestJob.findMany({
    where: { mode: 'HERMES_DIRECT' },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, status: true, policyDecision: true, riskLevel: true, failureCode: true, createdAt: true, finishedAt: true }
  });
  console.log(`Found ${directJobs.length} HERMES_DIRECT jobs`);
  directJobs.forEach(j => console.log(`  ${j.id.slice(-8)} | ${j.status} | policy:${j.policyDecision || 'none'} | risk:${j.riskLevel || 'none'} | err:${j.failureCode || 'none'}`));

  // Check complete flow for a succeeded or running job
  const complete = await prisma.aiVulnerabilityRetestJob.findFirst({
    where: { mode: 'HERMES_DIRECT', status: { notIn: ['FAILED', 'CANCELLED', 'EXPIRED'] } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: { plan: true, steps: true, report: true, directSession: true }
  });
  
  if (complete) {
    report(`Flow for job ${complete.id.slice(-8)}`);
    console.log('Status chain:', complete.status);
    console.log('Has plan:', !!complete.plan);
    if (complete.plan) console.log('Plan keys:', Object.keys(complete.plan.normalizedPlan || {}));
    console.log('Steps count:', complete.steps.length);
    console.log('Has report:', !!complete.report);
    if (complete.report) {
      console.log('Report keys:', Object.keys(complete.report.reportJson || {}));
      const rj = complete.report.reportJson;
      console.log('EvidenceSummary:', (rj?.evidenceSummary || '').slice(0, 150));
      console.log('ImpactAssessment:', (rj?.impactAssessment || '').slice(0, 150));
      console.log('Steps with evidence:', (rj?.steps || []).filter(s => s.evidence?.length > 0).length);
    }
    console.log('Has directSession:', !!complete.directSession);
    if (complete.directSession) {
      console.log('Session status:', complete.directSession.status);
      console.log('Hermes runId:', complete.directSession.hermesSessionId);
    }
  }

  // ── 2. Runner mode: check plan generation ──
  report('MODE 2: CONTROLLED_RUN (Runner) — Check plan-only jobs');
  
  const runnerJobs = await prisma.aiVulnerabilityRetestJob.findMany({
    where: { mode: 'CONTROLLED_RUN' },
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { plan: true, steps: { orderBy: { sequence: 'asc' } } }
  });
  console.log(`Found ${runnerJobs.length} CONTROLLED_RUN jobs`);
  
  for (const j of runnerJobs) {
    console.log(`  Job ${j.id.slice(-8)}: status=${j.status} steps=${j.steps.length}`);
    if (j.plan) console.log('    Plan overallRisk:', (j.plan.normalizedPlan || {}).overallRisk);
    j.steps.forEach(s => console.log(`    Step ${s.sequence}: ${s.title} [${s.toolType}] status=${s.status} risk=${s.riskLevel}`));
  }

  // ── 3. ADVISORY_ONLY mode ──
  report('MODE 3: ADVISORY_ONLY — Check high-risk handling');
  
  const advisoryJobs = await prisma.aiVulnerabilityRetestJob.findMany({
    where: { policyDecision: 'ADVISORY_ONLY' },
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { report: true, plan: true }
  });
  console.log(`Found ${advisoryJobs.length} ADVISORY_ONLY jobs`);
  
  for (const j of advisoryJobs) {
    console.log(`  Job ${j.id.slice(-8)}: status=${j.status} risk=${j.riskLevel}`);
    if (j.report) {
      const rj = j.report.reportJson || {};
      console.log('    manualRetestOnly:', rj.manualRetestAdvice?.manualRetestOnly);
      console.log('    blockedReason:', rj.manualRetestAdvice?.blockedReason);
      console.log('    remediationAdvice count:', rj.manualRetestAdvice?.remediationAdvice?.length || 0);
    }
  }

  // ── 4. Verify Hermes endpoints ──
  report('MODE 4: INFRA — Verify Hermes connectivity');
  
  const http = require('http');
  const fs = require('fs');
  const env = fs.readFileSync('/home/cocking/projects/cqupt-src-2.10/backend/.env', 'utf8');
  const tokenLine = env.split('\n').find(l => l.startsWith('AI_RETEST_HERMES_TOKEN=')) || '';
  const token = tokenLine.split('=').slice(1).join('=').trim();
  
  function api(method, path, body) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost', port: 5001, path: '/v1' + path, method,
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      });
      req.on('error', e => resolve({ status: 0, error: e.message }));
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
  
  const h = await api('GET', '/health');
  console.log('Health:', h.status, h.body?.status || 'N/A');
  
  const m = await api('GET', '/models');
  console.log('Models:', m.status, Array.isArray(m.body?.data) ? m.body.data.map(x => x.id).join(',') : 'N/A');
  
  // Test SSE connectivity
  const r = await api('POST', '/runs', {
    input: 'Say "ok" only', instructions: 'Be minimal', model: 'hermes-agent', session_id: 'e2e-test-' + Date.now()
  });
  console.log('Create run:', r.status, r.body?.run_id ? 'OK' : 'FAIL');
  
  if (r.body?.run_id) {
    // Quick SSE test: read first event
    const sseReq = http.request({
      hostname: 'localhost', port: 5001, path: '/v1/runs/' + r.body.run_id + '/events', method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    }, res => {
      let evt = '';
      const timer = setTimeout(() => {
        console.log('SSE events received:', evt.length > 0 ? 'YES' : 'NO (timeout)');
        sseReq.destroy();
      }, 5000);
      res.on('data', c => { evt += c.toString(); });
      res.on('end', () => { clearTimeout(timer); console.log('SSE ended, chars:', evt.length); });
    });
    sseReq.on('error', e => console.log('SSE error:', e.message));
    sseReq.end();
    await new Promise(r => setTimeout(r, 6000));
  }

  // ── 5. State machine validation ──
  report('MODE 5: STATE MACHINE — Verify transitions');
  
  const states = await prisma.aiVulnerabilityRetestJob.groupBy({
    by: ['status', 'mode'],
    _count: true
  });
  console.log('Job distribution:');
  states.forEach(s => console.log(`  ${s.mode}:${s.status} = ${s._count}`));

  await prisma.$disconnect();
  console.log('\n=== ALL TESTS COMPLETE ===');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
