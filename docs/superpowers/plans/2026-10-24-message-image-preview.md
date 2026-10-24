# Sent image previews

Approved design: sent image attachments appear as thumbnails in the conversation. Clicking opens a large contained image over a dark backdrop. Close with the close button, Escape or the backdrop. Existing saved attachments remain usable when reopening a conversation.

- [x] Add a shared message-attachment component with lazy thumbnails, file labels, missing-image states and an accessible modal with focus restoration.
- [x] Use registered workspace preview endpoints for Agent/Chat and a session-folder preview endpoint for Code. Reuse the existing real-path, size and content-type checks.
- [x] Suspend native web Preview while the image modal is open. Keep existing send/provider behavior. Native window integration remains unverified; the code updates existing native Preview bounds visibility.
- [x] Verify multiple images, persistence after reload, Escape/backdrop/button closing, focus restoration, unavailable files, mobile bounds and endpoint containment. Studio/Client builds passed; preview tests passed 5/5; renderer checks passed 59/59. Impeccable detector reported no findings. Screenshots inspected at desktop and mobile sizes.
