# CLI install and configurable Agent team implementation plan

Approved design: ../specs/2026-10-20-cli-install-agent-team.md; sequential execution confirmed by user.

1. Red/green: tests for installer command allowlist, prefix discovery and cancellation/exit handling. Implement catalog metadata and install manager with fixed arguments and bounded jobs; expose status/start/cancel routes.
2. Red/green: test distinct leader/worker providers and result handoff. Extend SupervisorAgent with enabled roles and provider mapping; snapshot/validate team config in AgentRunManager, keep old API compatible, enforce role permissions and cancellation.
3. Implement CLI install progress UI in New Session and TeamEditor/TeamProgress in Agent mode. Persist project teams; explicit enabled roles/model choices and real outputs; chat remains separate.
4. Run unit/build and isolated Electron checks for install/progress/team. Read-only code review and fix blockers. Update docs/version/release notes; publish new private GitHub tag via existing Windows/macOS CI and verify downloadable assets.
