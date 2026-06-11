const http=require('http'),{PrismaClient}=require('@prisma/client');
function api(m,h,po,t,b,k,mt){
 return new Promise((res,rej)=>{
  const o={hostname:h,port:po,path:m,method:mt||(b?'POST':'GET'),headers:{}};
  if(t) o.headers['Authorization']='Bearer '+t;
  if(k) o.headers['Idempotency-Key']=k;
  if(b) o.headers['Content-Type']='application/json';
  const r=http.request(o,rs=>{let d='';rs.on('data',c=>d+=c);rs.on('end',()=>{try{res({s:rs.statusCode,b:JSON.parse(d)})}catch{res({s:rs.statusCode,b:d})}})});
  r.on('error',e=>res({s:0,e:e.message}));
  if(b) r.write(JSON.stringify(b));
  r.end();
});
}
async function main(){
const p=new PrismaClient();
const v=await p.vulnerabilityReport.findFirst({where:{reportNo:'CQUPT-SRC-20260608-45LXL4'},select:{id:true}});
const l=await api('/api/auth/login/password','localhost',3000,null,{unifiedCode:'0000000',password:'admin123456+-'});
const t=l.b.accessToken;
console.log('1. Login OK');

// Create with needsAccount
const ikey='retest-cred-'+Date.now();
const r=await api('/api/vulnerabilities/'+v.id+'/ai-retests','localhost',3000,t,{
 mode:'HERMES_DIRECT',confirmedTargets:['https://cquptsrc.asia/'],
 scopeConfirmed:true,riskAcknowledged:true,
 confirmationText:'已获授权对cquptsrc.asia进行AI复测，测试账号0000001/admin',
 credentialRequest:{needsAccount:true,needsCaptcha:false}
},ikey);
console.log('2. Create:',r.s,typeof r.b==='object'?(r.b.id?.slice(-8)||r.b.message):r.b.slice(0,100));
if(r.s!==201){await p.$disconnect();return;}
const jid=r.b.id;

// Wait for planning
console.log('3. Waiting for plan generation...');
for(let w=0;w<15;w++){
 await new Promise(r=>setTimeout(r,10000));
 const j=await p.aiVulnerabilityRetestJob.findUnique({where:{id:jid},select:{status:true,failureCode:true,plan:true}});
 console.log('  t+'+(w+1)*10+'s:',j.status,j.failureCode||'');
 if(j.plan||['FAILED','DIRECT_PLAN_REVIEW'].includes(j.status)){break;}
}
const job=await p.aiVulnerabilityRetestJob.findUnique({where:{id:jid},include:{plan:true}});
if(job.status!=='DIRECT_PLAN_REVIEW'){console.log('Not in review, status:',job.status);await p.$disconnect();return;}
console.log('4. Plan ready:',job.plan?.normalizedPlan?.summary?.slice(0,100));

// Approve
const plan=job.plan.normalizedPlan||{};
const apr=await api('/api/ai-retests/'+jid+'/direct-plan/approve','localhost',3000,t,{
 acknowledgedRisks:true,proposalHash:job.plan.planHash,
 confirmedTargetScope:Array.isArray(plan.targets)?plan.targets:['https://cquptsrc.asia/'],
 confirmedImpactScope:Array.isArray(plan.impactScope)?plan.impactScope:['身份认证入口'],
 approvedToolClasses:(Array.isArray(plan.toolClasses)?plan.toolClasses:['browser']).filter(x=>['browser','http_client','python','security_tool','shell','skill'].includes(x)),
 confirmationText:'审核通过，批准Hermes执行复测，凭证已准备'
});
console.log('5. Approve:',apr.s,apr.b.status||apr.b.message);

// Add credential
if(apr.s===201){
 const cr=await api('/api/ai-retests/'+jid+'/direct-credentials','localhost',3000,t,{
  credentialType:'ACCOUNT',
  payload:{username:'0000001',password:'admin'},
  targetScope:['https://cquptsrc.asia/']
 });
 console.log('6. Add credential:',cr.s,JSON.stringify(cr.b).slice(0,200));

 // Wait for execution
 console.log('7. Waiting for execution (up to 4min)...');
 for(let w=0;w<24;w++){
  await new Promise(r=>setTimeout(r,10000));
  const j=await p.aiVulnerabilityRetestJob.findUnique({where:{id:jid},select:{status:true,failureCode:true}});
  console.log('  t+'+(w+1)*10+'s:',j.status,j.failureCode||'');
  if(['SUCCEEDED','FAILED','REPORTING','CANCELLED'].includes(j.status)){break;}
 }
 const fj=await p.aiVulnerabilityRetestJob.findUnique({where:{id:jid},include:{report:true,directSession:{include:{actions:true}}}});
 console.log('\n=== FINAL ===');
 console.log('Status:',fj.status,'Failure:',fj.failureCode||'none');
 if(fj.report){const rj=fj.report.reportJson||{};console.log('Evidence:',(rj.evidenceSummary||'').slice(0,300));console.log('Steps with ev:',(rj.steps||[]).filter(s=>s.evidence?.length).length);}
 if(fj.directSession){console.log('Session:',fj.directSession.status,'runId:',fj.directSession.hermesSessionId,'actions:',fj.directSession.actions?.length||0);}
}
await p.$disconnect();
}
main().catch(e=>console.error(e.message));
