# Compact composer layout

**Goal:** Rebalance the crowded lower chat area using the user's Claude composer reference.
**Approved direction:** The user explicitly requests a simpler proportional layout with the supplied images; earlier minimal UI preferences continue to apply.
**Tokens:** Preserve charcoal #242422, writing surface #2b2b29, border #484844, primary text #e9e8e3, secondary #aaa9a2 and the existing muted action accent. Noto Sans Thai remains the body face: 14px writing, 12px metadata.

```
+  พิมพ์ข้อความ…                                      mic  send
folder  branch  permission                 AI  model  effort  options
```

The writing surface is the focus. One metadata row aligns with its edges. Long room titles stop appearing as placeholders; next-prompt suggestions remain available through Tab, the input tooltip and plus menu. Project context, pinning and size controls are reachable through the existing plus menu. Recipient targeting stays visible in the footer. Actual pending attachments remain visible. Narrow canvases may wrap metadata without clipping or moving controls inside the typing region. No provider, permission or send/interrupt semantics change.

- [x] Add plus-menu entries for context and advanced composer settings; use an explicit collapsed panel instead of faded invisible pin controls.
- [x] Move location and AI controls into one metadata footer and simplify the input row. Keep account warning, broadcast state, disabled/busy actions and accessible labels visible where needed.
- [x] Add scoped final composer styles, bound popup sizes and shorten placeholder copy. Verify selectors against earlier CSS rather than relying on accidental grid inheritance.
- [x] Build and inspect desktop/laptop/preview screenshots; exercise drafts, provider/model/effort/permission, file/context menus, send/stop, recipient targeting and folder/branch controls with the existing renderer fixtures. Verify microphone placement; real microphone capture is outside these fixtures.
