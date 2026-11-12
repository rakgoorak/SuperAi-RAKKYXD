# Microsoft Store (MSIX)

The Store identity is in `installer/windows/store-identity.json` and matches
the Partner Center product **SuperAi&RAKKYXD**, Store ID `9NZH79QL515K`.
These are public identifiers, not credentials. Keep the Name and Publisher
exactly as shown in Partner Center.

## Build on Windows

Use Windows x64, Node.js 22, and the Windows 10/11 SDK (MakeAppx.exe).

```powershell
npm ci
npm run build
npm run test:msix
npm run package:release
npm run package:msix
```

The package is written to `store-assets/SuperAi-RAKKYXD-<version>-x64.msix`.
The script discovers MakeAppx in Windows Kits; `MAKEAPPX_PATH` can override it.
It validates the executable's architecture and package version before staging,
then runs MakeAppx with validation enabled. It packages a separate copy of the
Windows release, marked `distribution: microsoft-store`. Store builds never
download or install GitHub ZIP updates; their update button opens the Store page.

The root `package.json` version `1.0.33` becomes `1.0.33.0`. Increase the version
for each subsequent Store submission. Only stable versions are accepted here.
The fourth component stays zero for Microsoft Store submission.

Alternatively, commit and push these changes, then run GitHub Actions →
**Build Microsoft Store MSIX** → **Run workflow** on that branch. Download the
`microsoft-store-msix` artifact and extract the MSIX from its ZIP. This workflow
builds an artifact only; it does not publish a GitHub release or submit to Store.

## Windows acceptance checks before submission

The generated MSIX is unsigned for Store submission. Microsoft signs the
distributed package after certification. Do not distribute this unsigned file
as a regular installer; local testing requires developer registration or a
separately signed test package.

On a Windows test machine with Developer Mode enabled, use the
`Add-AppxPackage -Register "...\AppxManifest.xml"` command printed by the build.
Launch the registered app from Start, not the original unpackaged EXE. Check:

- First launch, folder selection, reading/writing a user project and chat persistence.
- Provider sign-in and one actual CLI conversation, terminal/PTY, browser, and microphone.
- Restart and reopening saved conversations.
- Update panel says Microsoft Store; no GitHub update prompt/download occurs.
- Taskbar, Start menu icon, and uninstall behavior.

Run Windows App Certification Kit against the package and resolve failures.
The existing release smoke test checks the unpackaged app only; it does not
replace these installed-package checks or Microsoft Store certification.

## Partner Center

1. Open the reserved product and choose **Start submission**.
2. Upload the extracted `.msix` in **Packages** and resolve validation messages.
3. Complete pricing/availability, properties, age ratings, Store listings,
   screenshots, support contact, and the privacy policy URL.
4. Explain `runFullTrust` when prompted: this is an Electron desktop coding tool
   that reads/writes user-selected projects and runs user-requested developer
   CLI tools. It runs as the current user, not as administrator.
5. Provide reviewer instructions for provider login/requirements and a usable
   test path. Submit only after checking the installed Windows package.

Store approval is separate from successful packaging. No submission or signing
credentials are stored in this repository.

References: [Microsoft packaging guide](https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-manual-conversion),
[MSIX signing guide](https://learn.microsoft.com/windows/msix/package/sign-msix-package-guide),
[Electron process.windowsStore](https://www.electronjs.org/docs/latest/api/process).
