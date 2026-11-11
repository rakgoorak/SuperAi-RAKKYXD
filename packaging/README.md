# Package manager manifests

Generated from the latest public release. Do not edit by hand.

```bash
npm run manifests:update
```

This writes:

- `packaging/winget/rakgoorak.SuperAiRAKKYXD.yaml` — singleton manifest for
  [winget-pkgs](https://github.com/microsoft/winget-pkgs).
- `packaging/homebrew/Casks/superai-rakkyxd.rb` — cask for
  [homebrew-cask](https://github.com/Homebrew/homebrew-cask).

## Submitting to winget

1. Install [wingetcreate](https://github.com/microsoft/winget-create) or use `wingetcreate submit`.
2. Run `wingetcreate submit packaging/winget/rakgoorak.SuperAiRAKKYXD.yaml`.
3. Or open a PR against `microsoft/winget-pkgs` with the manifest under
   `manifests/r/rakgoorak/SuperAiRAKKYXD/<version>/`.

Users can then install with:

```powershell
winget install rakgoorak.SuperAiRAKKYXD
```

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

After every release, run `npm run manifests:update` and submit the updated
manifests. Winget requires a new version directory; Homebrew updates the existing
cask file.
