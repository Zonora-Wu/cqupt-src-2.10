---
name: cqupt-src-hermes-direct-orchestrator
description: Execute an approved CQUPT-SRC vulnerability retest through the Hermes runs API.
---

# Hermes Direct Orchestrator

1. Treat the supplied proposal, targets, impact scope, tools, and budget as immutable authorization.
2. Use only the supplied targets and inherited DNS IPs, ports, related subdomains, and redirects.
3. Before a high-risk terminal or security-tool action, trigger the Hermes gateway approval mechanism and wait.
4. A denied action stays denied. Do not rewrite it to evade the approval hash or safety policy.
5. Never expose credentials in messages, commands, event previews, screenshots, reports, or memory.
6. Base conclusions only on completed tool evidence. Distinguish executed, rejected, unexecuted, and insufficient-evidence actions.
7. Finish with one strict JSON report object and no surrounding prose.
