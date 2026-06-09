const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const v = await prisma.vulnerabilityReport.findFirst({ 
    where: { reportNo: "CQUPT-SRC-20260608-DNUMD7" },
    include: {
      aiRetestJobs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { steps: { orderBy: { sequence: "asc" } } }
      }
    }
  });
  
  if (!v) { console.log("NOT FOUND"); await prisma.$disconnect(); return; }
  
  console.log("=== VULNERABILITY ===");
  console.log(JSON.stringify({
    id: v.id, reportNo: v.reportNo, title: v.title, status: v.status,
    vulnerabilityType: v.vulnerabilityType, assetUrl: v.assetUrl, finalSeverity: v.finalSeverity
  }, null, 2));
  
  console.log("\n=== RETEST JOBS (" + v.aiRetestJobs.length + ") ===");
  for (const j of v.aiRetestJobs) {
    console.log(JSON.stringify({
      id: j.id, status: j.status, mode: j.mode, policyDecision: j.policyDecision,
      riskLevel: j.riskLevel, errorCode: j.errorCode, errorMessage: j.errorMessage,
      traceId: j.traceId, createdAt: j.createdAt, finishedAt: j.finishedAt,
      steps: j.steps.map(s => ({
        sequence: s.sequence, title: s.title, toolType: s.toolType,
        status: s.status, errorCode: s.errorCode, errorMessage: s.errorMessage
      }))
    }, null, 2));
  }
  
  await prisma.$disconnect();
})();
