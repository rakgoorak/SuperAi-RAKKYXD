# v1.1.0 validation

- Root build passed (core / studio / client / desktop / voice).
- npm test passed: core 5, desktop 1, studio 30, voice 10, frontend TypeScript. Fixtures include install prerequisites, whitelist, discovery, timeout/cancel, separate team models, >20k full result handoff, failure diagnosis and summary, cancellation, persisted snapshots, readonly Claude tools.
- Electron team smoke passed: installer UI start/cancel/retry/catalog refresh, project team survives reload, sequential HTTP provider calls leader→coder→reviewer→leader, actual results reach next member and leader, no renderer errors. Screen captures in ignored output/team-check-iS1uOl.
- First team smoke failed because test expected Assistant mode after reload, while app intentionally initializes Code mode. Source trace App.tsx mode default confirmed; corrected test to reopen Assistant before verifying saved team. No product behavior changed for this test issue.
- Read-only review found four P2 issues; fixed Claude readonly reads, removed silent output truncation, retained leader diagnosis on failed run and retained underlying worker error in task result/context. Tests verify all four.
- Tests do not perform real npm installs, authenticate CLI accounts, use paid LLM quota, or record microphones. User-installed CLI/model/account behavior still depends on vendor and environment.
- Native Windows/macOS release checks and publication are tracked by the v1.1.0 GitHub Actions run.

- Initial cross-platform CI run 39391840568: Mac Intel passed all build/team/packaged checks; Windows and Mac arm64 failed locating New Session. Root cause: max-width1200 CSS hides the button text span, leaving no accessible name. Added permanent aria-label/title and forced 1100px startup in team smoke to cover compact layouts. New immutable tag v1.1.1 carries this fix; v1.1.0 was never published as a release.
