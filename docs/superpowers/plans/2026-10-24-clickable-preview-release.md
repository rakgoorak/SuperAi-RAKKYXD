# Clickable links and in-app Preview

The user explicitly requests clickable answer links, in-app URL/image viewing, commit/push of the conversation redesign and this fix, and a release on the source and public downloads repositories. This extends the already approved conversation workspace interaction.

- Reproduce the real Markdown link failure in the browser renderer test. Baseline: the new accessible-link assertion fails because Markdown emits a span.
- Parse web and project-file targets without permitting executable URL schemes. Turn Markdown and bare HTTP(S) URLs into keyboard-accessible anchors.
- Route link activation through the existing right-side Preview. Preserve native Chromium for websites, show local images/PDF/text in the app, hide native views behind local previews, and retain explicit external-open controls.
- Serve local previews from a registered workspace only, validating real paths/symlinks, file types and size before returning bytes. Render HTML as text, not executable content.
- Verify link activation, URL switching, image/text/PDF states, missing-file errors, path containment and existing conversation behavior; build all changed packages.
- Prepare v1.0.20 metadata, release notes and reviewable commit content. Use the connected GitHub API for remote commit/push because local `.git` and GitHub CLI configuration are read-restricted.
- Publish releases only through an available authorized tool. Browser access to github.com was explicitly denied; do not route around that denial. Record any remaining release blocker after completing the code and permitted push.
