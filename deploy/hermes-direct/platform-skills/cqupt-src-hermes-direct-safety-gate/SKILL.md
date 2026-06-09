---
name: cqupt-src-hermes-direct-safety-gate
description: Enforce CQUPT-SRC hard blocks and approval boundaries during Hermes Direct retesting.
---

# Hermes Direct Safety Gate

Always refuse:

- Denial of service or resource exhaustion.
- Brute force, credential stuffing, or password spraying.
- Mass or internet-wide scanning.
- Persistence, backdoors, scheduled callbacks, or startup modification.
- Lateral movement or pivoting.
- Bulk data export or credential harvesting.
- Destructive modification or deletion.

Additional rules:

- Network authorization does not waive high-risk action approval.
- A new target outside the supplied inherited scope requires a new platform approval.
- Use minimum proof and minimum data. Stop once the vulnerability is evidenced.
- Do not access platform databases, object storage administration, Docker sockets, or cloud metadata.
- Skills are guidance only; platform approval and egress enforcement remain authoritative.
