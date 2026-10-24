# Preview links and v1.0.20 validation

## Reproduction and root cause

The user could see an underlined “ดูหน้าตาใหม่” label but could not activate it. The Markdown renderer deliberately emitted a `span` for every Markdown link, with a comment saying local files could not be opened. It also did not recognize bare URLs. The production-renderer test was extended with the same file-link shape and failed its accessible-link assertion before the fix.

## Change

- Markdown links and bare HTTP(S)/www URLs are keyboard-accessible anchors. Activation routes to the existing right-side Preview instead of navigating the application away.
- Websites use the existing isolated native Chromium bridge, or the existing iframe fallback in the browser renderer. Explicit external-open controls remain available.
- Project images, PDF and text use a separate file viewer, with loading/missing-file states, image sizing, media downloads and source-line highlighting. Object URLs are revoked and in-flight requests aborted when changing files.
- `/api/workspaces/:wsId/preview-file` checks both the lexical path and resolved real path against the registered project. Symlink escapes, directories, unsupported binary content and oversized files are rejected. Text/HTML is served as plain text; raw file responses have a restrictive CSP and no caching. Existing origin checks cover this endpoint.
- v1.0.20 includes the conversation workspace redesign and next-step/slash-menu fixes from the preceding request.

## Completed checks

- Full Core/Studio/Client/Desktop production build passed.
- **32 focused tests passed**, covering suggestions, model/effort choices, session handoff/isolation, skills, terminal text and the new preview parser/file endpoint.
- **9 desktop URL/updater unit tests passed**.
- **31 browser renderer checks passed**. These include real link semantics, image decoding, source-line selection, HTML shown without execution, PDF viewer selection, missing-file recovery and keyboard activation of bare URLs. They also cover the original composer/slash/session/Preview regression checks.
- `git diff --check` passed. Screenshots and renderer results are under `output/conversation-workspace/`.
- Windows x64 packaging completed into `release/SuperAi-RAKKYXD-v1.0.20-windows-x64`. Both the portable ZIP and NSIS Setup.exe were generated with SHA-256 files using the existing packaging scripts.

## Limits and publication

The packaged Electron smoke test timed out waiting for its first window and completed with zero native checks passed. Earlier unmodified Electron launches in this environment reported GPU-process crashes. Browser renderer tests and syntax checks do not establish native Electron startup; that remains unverified here.

The broad combined Core/Studio test attempt stalled and was interrupted. It is not reported as a successful complete suite. The focused suites listed above completed.

The repository's `.git` directory and GitHub CLI configuration are read-restricted in this environment. The connected GitHub tools expose commit/tree/ref writes, but the attempted `github_create_tree` call was rejected before execution: “MCP tool call requires approval, but approval policy is never”. No commit was created and no ref was pushed. No alternate write method is used to bypass this rejection. These tools also do not expose release/tag creation.

The attempt to open github.com in the connected browser was explicitly denied by the browser origin approval gate. No alternative browser surface, raw network command, workflow modification or tag/ref trick is used to route around that denial. Release notes and local artifacts are prepared, but commit/push and publication need authorized write/release access. No claim of a published release should be made until GitHub confirms the release and uploaded assets.
