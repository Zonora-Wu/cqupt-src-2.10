# Hermes Agent adaptation

Pinned upstream: `NousResearch/hermes-agent@7b65073dc919c9a930315b78f57520c0d772eed3`.

The NestJS runtime adapts these reviewed ideas:

- bounded model and tool iterations;
- explicit interruption;
- per-run iteration accounting;
- step and tool-call observability.

The implementation is TypeScript and uses CQUPT-SRC authentication, Prisma,
RBAC, tool registry, redaction, audit and model routing. It does not embed the
Hermes Python runtime.

Excluded:

- shell, terminal and arbitrary process execution;
- filesystem mutation;
- browser automation;
- MCP server loading;
- autonomous memory or self-modification;
- cron and background autonomy;
- Hermes CLI and desktop behavior.
