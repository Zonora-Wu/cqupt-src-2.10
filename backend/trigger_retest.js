const http = require('http');

function api(method, path, host, port, token, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: host, port, path, method, headers: {} };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) { opts.headers['Content-Type'] = 'application/json'; }
    const req = http.request(opts, res => {
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

async function main() {
  // Step 1: Login as admin
  const login = await api('POST', '/api/auth/login/password', 'localhost', 3000, null,
    { unifiedCode: '0000000', password: 'admin123456+-' });
  if (!login.body.accessToken) { console.log('LOGIN FAILED:', login.body); return; }
  const token = login.body.accessToken;
  console.log('1. Login OK, user:', login.body.user.name);

  // Step 2: Query the vulnerability
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const vuln = await prisma.vulnerabilityReport.findFirst({
    where: { reportNo: 'CQUPT-SRC-20260608-45LXL4' },
    select: { id: true }
  });
  console.log('2. Vulnerability:', vuln.id);

  // Step 3: Create a new Hermes Direct retest job
  const createResult = await api('POST', '/api/vulnerabilities/' + vuln.id + '/ai-retests', 'localhost', 3000, token, {
    mode: 'HERMES_DIRECT',
    confirmedTargets: ['https://cquptsrc.asia/'],
    scopeConfirmed: true,
    riskAcknowledged: true,
    confirmationText: '已获得授权，确认对 https://cquptsrc.asia/ 进行AI辅助复测，理解AI复测仅作为审核辅助参考',
    credentialRequest: { needsAccount: false, needsCaptcha: false }
  });
  console.log('3. Create retest:', createResult.status);
  if (createResult.body) {
    const b = createResult.body;
    console.log('   jobId:', b.id?.slice(-8) || 'N/A');
    console.log('   status:', b.status);
    console.log('   mode:', b.mode);
    if (b.message) console.log('   msg:', b.message);
  }

  // Step 4: Wait for worker to pick up, then check status
  console.log('4. Waiting for worker (15s)...');
  await new Promise(r => setTimeout(r, 15000));

  const jobs2 = await prisma.aiVulnerabilityRetestJob.findMany({
    where: { vulnerabilityId: vuln.id },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, status: true, mode: true, failureCode: true, createdAt: true }
  });
  console.log('   Recent jobs:');
  jobs2.forEach(j => console.log('   ', j.id.slice(-8), j.status, j.mode, j.failureCode || '-', j.createdAt.toISOString()));

  await prisma.$disconnect();
}
main().catch(e => console.error(e.message));
