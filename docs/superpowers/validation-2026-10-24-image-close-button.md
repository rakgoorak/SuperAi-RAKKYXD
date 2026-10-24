# Image viewer close button

The original close button occupied y=16–60 CSS pixels. The Electron window controls overlay is configured with a height of 53px, covering most of the close button. A renderer geometry assertion reproduced the overlap before the change.

The viewer now reserves the native titlebar area using CSS environment values, with a 53px fallback and a 12px gap. Its close button includes an X, the Thai label “ปิดรูปภาพ”, and an Esc hint on a contrasting light background. The image remains below the toolbar; the dialog explicitly uses a non-draggable region. Escape, backdrop closing and focus restoration remain unchanged.

Validation: Client TypeScript/production build passed; 87 browser renderer checks passed. Added assertions cover titlebar clearance, a readable close label, a normal 1000x700 window, and a narrow 390x844 viewport. Normal/narrow screenshots were inspected. git diff --check passed. Actual native window chrome was not exercised by the browser fixture; its 53px overlap constraint is taken from the desktop window configuration.

## Follow-up: overlapping controls and an old running build

Read-only probes of local app HTTP responses found two different bundles running simultaneously. Port 3888 served `index-ZTcEDsHr.js` and CSS with the original `top:16px` toolbar. Port 3899 served the current workspace build. This explains why the original overlapping button could still appear after changing source: the older running app serves a different build.

The close action now comes before the filename on the left, opposite the native window controls. The CSS offset uses a minimum 53px titlebar reserve plus a 12px gap even when titlebar environment values exist but are zero. A new position assertion failed against the previous right-aligned implementation and passed after the change. The final Client build passed; 89 renderer checks passed; normal/narrow screenshots were inspected; git diff --check passed. Port 3899 subsequently served the new `index-AtifeRYI.js` bundle, while port 3888 still served its old bundle. No running user application was terminated or reloaded by this investigation.
