# Package manager manifests

Generated from the latest public release. Do not edit by hand.

```bash
npm run manifests:update
```

This writes:

- `packaging/winget/manifests/r/rakgoorak/SuperAiRAKKYXD/<version>/` — multi-file
  manifests in the exact layout [winget-pkgs](https://github.com/microsoft/winget-pkgs)
  expects (`version`, `installer`, and `defaultLocale`).
- `packaging/homebrew/Casks/superai-rakkyxd.rb` — cask for
  [homebrew-cask](https://github.com/Homebrew/homebrew-cask).

The winget installer is `nullsoft` (NSIS), per-user scope, with `/S` silent
switches. `npm run manifests:update` reads the checksums from the release assets,
so a release must be published before you regenerate.

## Validate

```powershell
winget validate --manifest packaging\winget\manifests\r\rakgoorak\SuperAiRAKKYXD\<version>
```

Validation must print `Manifest validation succeeded.` before you submit.

## Submitting to winget

```powershell
winget install Microsoft.WingetCreate
wingetcreate submit --token <GITHUB_TOKEN> packaging\winget\manifests\r\rakgoorak\SuperAiRAKKYXD\<version>
```

`wingetcreate` opens the PR against `microsoft/winget-pkgs` for you. Or fork the
repo and copy the version folder to
`manifests/r/rakgoorak/SuperAiRAKKYXD/<version>/` manually.

Users can then install with:

```powershell
winget install rakgoorak.SuperAiRAKKYXD
```

Winget requires a new `<version>` directory for every release. Never edit the
previous version's folder.

## Submitting to Homebrew

1. Verify the DMGs are signed with a Developer ID and notarized; Homebrew users
   expect Gatekeeper to pass without manual steps.
2. Fork `Homebrew/homebrew-cask` and add the cask to `Casks/s/superai-rakkyxd.rb`.
3. Run `brew audit --new --cask superai-rakkyxd` and `brew install --cask superai-rakkyxd`.
4. Open a PR.

Users can then install with:

```bash
brew install --cask superai-rakkyxd
```

## Release checklist

After every release:

1. `npm run manifests:update`
2. `winget validate --manifest packaging\winget\manifests\r\rakgoorak\SuperAiRAKKYXD\<version>`
3. Submit the winget PR (`wingetcreate submit`).
4. Update the Homebrew cask PR (only after the DMG is signed and notarized).
