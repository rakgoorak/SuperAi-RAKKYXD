# Windows installer 1.0.30

Includes the simplified composer, aligned conversation search icon and compact inline session rename field from the 2026-10-27 UI changes. Root package and lockfile metadata are version 1.0.30. Existing release directories were preserved.

Validation:

- Full `npm.cmd run build` passed for core, studio, client and desktop.
- `npm.cmd run package:release` completed, producing `release/SuperAi-RAKKYXD-v1.0.30-windows-x64`.
- Packaged app metadata reports 1.0.30. Packaged desktop entrypoint, server entrypoint, client HTML and linked JS/CSS hashes match the fresh source build.
- Composer browser fixture passed 23 checks against the final build. Earlier renderer regression results are recorded in `validation-2026-10-27-composer-layout.md`.
- Root `npm.cmd test` passed core (27) and desktop (12). The studio suite did not finish and was interrupted; do not report the complete workspace test command as passed.
- Native release smoke reached the first-window step but timed out waiting for `.app-shell`. It passed zero checks. Cleanup also reported a failed taskkill; subsequent process inspection found the specific owned app PID no longer present. Native startup is not validated by this release.

Installer generation uses the existing NSIS script. SHA-256 is generated alongside Setup and verified after completion. No signing certificate was configured, so the generated executable is unsigned. The installer is built locally; it was not installed, published or used to restart the user's application.

Completed artifact: `release-assets/SuperAi-RAKKYXD-Setup-v1.0.30.exe` (92,447,644 bytes). Windows file/product version is 1.0.30. Verified SHA-256: `4a875f9c7c02aba5ef2e566bd47ce657c062decaa23a3164ad06059737e6bfe7`. The fixed-name `SuperAi-RAKKYXD-Setup.exe` contains the same installer.
