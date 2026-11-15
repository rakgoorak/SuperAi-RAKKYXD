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

Alternatively, run GitHub Actions → **Build Microsoft Store MSIX** →
**Run workflow**. Leave **submit** unticked to only build: download the
`microsoft-store-msix` artifact and extract the MSIX from its ZIP.

## Automatic Store submission on every release

`.github/workflows/microsoft-store.yml` submits a new MSIX to the Store for
every stable GitHub release, so Store users get the same updates as GitHub users.

- **When it runs:** after **Build Windows and macOS Release** succeeds for a
  pushed `vX.Y.Z` tag (the normal release path), and when someone publishes a
  stable release by hand. Prereleases and tags such as `v1.2.0-beta.1` are
  built but never submitted. `release.yml` publishes releases with
  `GITHUB_TOKEN`, and GitHub does not start other workflows from those events,
  which is why the workflow also listens for the release workflow finishing.
- **What it does:** checks out the tag, checks that it matches the
  `package.json` version, builds and tests the MSIX, then runs the Microsoft
  Store Developer CLI (`msstore publish <msix> --appId 9NZH79QL515K`). That
  creates a new submission from the live one, marks the old package for
  removal, uploads the new MSIX, and commits the submission for certification.
  Listing text, screenshots, pricing and age ratings carry over unchanged.
- **Manual run:** **Run workflow** with **tag** set to an existing `vX.Y.Z` tag
  and **submit** ticked. Use this to submit a release that was missed, for
  example the current GitHub version right after finishing the setup below.
- **Without credentials** the MSIX is still built and uploaded as an artifact.
  The submit job logs a warning naming the missing secrets and skips submission.

The workflow must be on the default branch (`main`) for the release triggers
to fire, and the tagged release must contain the Store support from this branch
(`distribution: microsoft-store`, `store-identity.json`, `package-msix.mjs`).
Merge this branch into `main` before the first automated release.

Certification usually takes from a few hours to three business days. The CLI
deletes any pending submission before creating its own, so a release submitted
while the previous one is still pending replaces it. That includes a draft you
started by hand in Partner Center: finish or submit listing edits before the
next release goes out.

### One-time setup (Partner Center credentials)

You need Partner Center **account owner or Manager** rights, and the Partner
Center account must be linked to a Microsoft Entra ID (Azure AD) tenant.

1. **Link a tenant if needed.** In Partner Center open **Settings** (gear) →
   **Account settings** → **Tenants**. If no tenant is listed, choose
   **Associate** and sign in with a work or school (Entra ID) account, or
   create a new tenant there.
2. **Create or add the Entra app.** Go to **Account settings** →
   **User management** → **Microsoft Entra applications**.
   - New app: **Create Microsoft Entra application**, and give it a name such
     as `SuperAi Store CI`.
   - Existing app (created in Azure portal → **Microsoft Entra ID** →
     **App registrations**): **Add Microsoft Entra application** and pick it.
3. **Give it the Manager role.** On the app's page in Partner Center, under
   **Roles**, select **Manager** and save. Lower roles cannot create or commit
   submissions.
4. **Create a client secret.** On the same page choose **Add new key**. Copy
   the key immediately; it is shown only once. Note its expiry date: submission
   fails once it expires, and you then repeat this step and update the secret.
5. **Collect the IDs.**
   - **Tenant ID** and **Client ID**: shown on the app's page in Partner Center
     (also in Azure portal → App registrations → the app → **Overview** as
     *Directory (tenant) ID* and *Application (client) ID*).
   - **Seller ID**: Partner Center → **Account settings** → **Legal info** →
     **Developer** tab → **Seller ID**.
6. **Add the four repository secrets.** In GitHub open the repository →
   **Settings** → **Secrets and variables** → **Actions** →
   **New repository secret**, and add:

   | Secret name | Value |
   | --- | --- |
   | `PARTNER_CENTER_TENANT_ID` | Tenant ID |
   | `PARTNER_CENTER_CLIENT_ID` | Client ID |
   | `PARTNER_CENTER_CLIENT_SECRET` | Client secret (key) from step 4 |
   | `PARTNER_CENTER_SELLER_ID` | Seller ID |

7. **Catch up the Store.** Run **Build Microsoft Store MSIX** manually with the
   latest stable tag and **submit** ticked. Check that the new submission shows
   up under the product's **Submissions** in Partner Center.

Never commit these values to the repository. The workflow reads them only from
GitHub secrets, and GitHub masks them in logs.

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

## Partner Center (first submission or listing changes)

After the one-time setup above, new versions are submitted automatically; use
these manual steps only for the first submission or to change the listing.

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
[Electron process.windowsStore](https://www.electronjs.org/docs/latest/api/process),
[Microsoft Store Developer CLI](https://learn.microsoft.com/windows/apps/publish/msstore-dev-cli/overview).
