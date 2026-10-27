# Release 1.0.31 preparation and publication block

The packaged Windows x64 application includes the latest model-catalog refresh, compact composer, rename field and search alignment, integrated on the remote main source state documented in `validation-2026-10-27-model-catalog.md`.

`npm.cmd run package:release` and `npm.cmd run archive:release` passed. The ZIP contains application version 1.0.31 and its SHA-256 was verified: `a9c59299832abc392027c3ac9404fafad50351cb0a0ab7fe0f74d399e9e47305` (134,493,539 bytes). Packaged desktop/server/client entrypoints match the current build. All 24 prepared source entries match their local files.

Publication has not occurred. The GitHub connector successfully read private main at `df398efce616272b5b55ab277ed41667c1b207c6`. Creating the Git tree was rejected with `MCP tool call requires approval, but approval policy is never`. No commit or ref was created. Browser publication was previously denied by a saved permission or managed policy. These controls were not bypassed.

For a user-run handoff, `scripts/publish-prepared-1.0.31.ps1` uses their GitHub CLI login, checks the expected private main, validates checksums, creates a fast-forward source commit through the Git data API, stages a draft public release, uploads the four updater/installer assets, checks their sizes and uploaded state, then publishes it as latest. It refuses an existing v1.0.31 or a changed private main. Its PowerShell syntax was checked, but no publishing command in that script was executed by the assistant. The source payload and release notes are prepared under `output/`.

This preparation does not validate native startup; the earlier native smoke timeout remains documented. The installer is unsigned. No application was installed or restarted.

`npm.cmd run installer:release` completed. Verified Setup file/product version 1.0.31, size 92,405,297 bytes, SHA-256 `8cad2493900b7a3f398d77086d74227bef00a9f5590389a066c5755a98595afd`. Both fixed-name and versioned installer copies are available in `release-assets/`.

## User-run publication recovery

The user's run created and pushed private commit `433c53b8674238012919fbadae09b93f7bb365fd`, tree `5319f70e9a4d2f5792549abe929ff7f3fa61bd16`, parent `df398efce616272b5b55ab277ed41667c1b207c6`, then stopped at the single immediate read-back assertion. Authenticated read-only GitHub inspection confirmed main points to that exact commit. The public repository still listed v1.0.29 as latest and no v1.0.31 in its recent releases. The push itself succeeded; the immediate response mismatch is consistent with a stale read, but its original response was not recorded, so caching/replication is not proven as the specific mechanism.

The handoff script now retries read-back up to eight times with a no-cache request header, preserves the expected-parent check, resumes an existing saved commit only after verifying its tree and parent, and rejects unrelated main changes. Public drafts may resume only when their source commit matches; published releases are never overwritten. Added an offline GH mock replay for the existing-commit/stale-read path. Both scripts pass PowerShell AST syntax validation. Executing the replay inside the agent environment was blocked by its PowerShell execution policy; that policy was not bypassed, and runtime replay is not claimed as passed. No remote write was performed by the assistant during diagnosis.
