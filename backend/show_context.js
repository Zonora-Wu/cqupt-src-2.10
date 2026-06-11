const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
const j=await p.aiVulnerabilityRetestJob.findFirst({
 where:{id:'cmq7fntg0000juklqp0lbnzv0'},
 select:{sanitizedContext:true,targetSnapshot:true,plan:{select:{rawPlan:true,normalizedPlan:true,promptVersion:true}}}
});
if(!j){console.log('Job not found');await p.$disconnect();return;}

if(j.sanitizedContext){
 const sc=j.sanitizedContext;
 console.log('=== SANITIZED CONTEXT (platform → Hermes) ===');
 console.log('confirmedTargets:',sc.confirmedTargets);
 console.log('extractedTargets:',sc.extractedTargets);
 console.log('\n--- Report data ---');
 if(sc.report){
  console.log('  reportNo:',sc.report.reportNo);
  console.log('  title:',sc.report.title);
  console.log('  vulnerabilityType:',sc.report.vulnerabilityType);
  console.log('  assetUrl:',sc.report.assetUrl);
  console.log('  finalSeverity:',sc.report.finalSeverity);
  console.log('  status:',sc.report.status);
  console.log('  reproductionSteps:',(sc.report.reproductionSteps||'').slice(0,500));
  console.log('  impactAssessment:',(sc.report.impactAssessment||'').slice(0,500));
 }
 console.log('attachments:',(sc.attachments||[]).length);
}

if(j.targetSnapshot){
 console.log('\n=== TARGET SNAPSHOT ===');
 console.log('confirmedBy:',j.targetSnapshot.confirmedBy);
 console.log('confirmationText:',j.targetSnapshot.confirmationText);
 console.log('confirmedTargets:',j.targetSnapshot.confirmedTargets);
 console.log('extractedTargets:',j.targetSnapshot.extractedTargets);
 console.log('credentialRequest:',JSON.stringify(j.targetSnapshot.credentialRequest));
}

if(j.plan?.rawPlan){
 console.log('\n=== RAW PLAN (Hermes → platform) ===');
 console.log(JSON.stringify(j.plan.rawPlan,null,2).slice(0,3000));
}
await p.$disconnect();
})();
