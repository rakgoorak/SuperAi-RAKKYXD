# Inline answer images and zoom viewer

## Design and scope

Preserve the established app identity: base `#222220`, surface `#2b2b28`, controls `#3d3c36`, text `#eeede7`, accent `#d9a080`; Noto Sans Thai / Segoe UI. Image content is the focus. Keep answer text left aligned with a readable image up to 620px wide; retain the original caption link for Preview. The full-window viewer centers the image, keeps the labeled close control on the left below native chrome, and puts zoom controls on a compact bottom toolbar.

Local raster image file links in Markdown answers now render inline through the existing project/session preview-file API. Standard `![label](path)` syntax works too. Code uses its own session root; Agent and Chat use the active workspace root. Original file links remain available when loading fails or no image endpoint exists. SVG, web links and other unsupported formats retain the existing Preview behavior; no arbitrary HTML is rendered.

`ImageViewer` is shared by sent attachments, answer images and tool screenshots. It supports fit-to-window, actual 100% pixels, plus/minus controls, wheel zoom, keyboard +/- and 0, double-click between fit/actual size, and mouse dragging to pan. Zoom is bounded at 5–800% for manual changes. Resize refits the image. Escape/close restores focus to the opening control. Existing native browser overlay suppression is retained.

## Validation

- Client TypeScript and Vite build passed.
- `node packages/desktop/test/image-chat-smoke.mjs`: 17 passed, no renderer errors. Covers absolute/encoded local paths, Markdown image syntax, missing-image fallback, zoom buttons, actual pixels, keyboard, wheel, pan, fit, narrow toolbar bounds, native titlebar clearance, focus restoration, sent attachments and Agent/Chat workspace isolation.
- Inspected `output/image-chat/inline-images.png`, `zoom-viewer.png`, and `zoom-viewer-narrow.png` (1440x900 and 390x844). No image-specific visual defects found.
- `git diff --check` passed with line-ending normalization notices only.

The focused renderer test uses fixture API/WebSocket responses and an existing repository screenshot. No paid provider calls or real user processes were started or stopped. Native packaged Electron was not exercised. The broader conversation suite previously had an unrelated response-options failure; no full-suite success is claimed here. Unrelated concurrent App/Preview/editor changes were preserved. No release was published in this task.
