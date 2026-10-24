# Sent image previews

Sent attachments now show thumbnails in Code, Agent and Chat messages. A native HTML dialog opens the saved image over a dark backdrop; Escape, the close button and backdrop clicks dismiss it. Focus returns to the thumbnail. Missing files show an actionable error, while non-image attachments retain their filename. Code transcripts storing only a basename resolve that name under `.superai/attachments/`; existing absolute and relative paths remain supported.

The session preview endpoint uses the registered session working directory and the existing readPreviewFile checks. Tests cover dormant sessions, absolute/relative saved attachment paths, missing sessions/files, image content types and bytes, no-cache/CSP headers, blocked cross-origin requests, and real-path/symlink containment.

Completed verification:

- Studio TypeScript build passed.
- Client TypeScript and production Vite build passed.
- Preview parser/files/API tests: 5 passed.
- Browser renderer checks: 59 passed with no renderer errors. Eleven checks added for thumbnail/PDF presentation, legacy filename resolution, image interaction, Escape/focus restoration, close button, backdrop, missing images, mobile sizing, reload persistence and Agent/Chat workspace selection.
- Mechanical UI detector: no findings. git diff --check passed.
- Desktop and mobile screenshots inspected: `output/conversation-workspace/message-image-desktop.png` and `message-image-mobile.png`.

Browser fixtures mock the API and reuse a repository screenshot as the image. They do not invoke AI providers. Native Electron window startup and the native BrowserView hiding/restoration are not exercised by these browser tests. The implementation suspends native Preview visibility during the image dialog, but native integration still needs a desktop smoke check in an environment where Electron starts. No release was published for this change.
