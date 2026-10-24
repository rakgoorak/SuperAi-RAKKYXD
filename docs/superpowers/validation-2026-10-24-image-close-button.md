# Image viewer close button

The original close button occupied y=16–60 CSS pixels. The Electron window controls overlay is configured with a height of 53px, covering most of the close button. A renderer geometry assertion reproduced the overlap before the change.

The viewer now reserves the native titlebar area using CSS environment values, with a 53px fallback and a 12px gap. Its close button includes an X, the Thai label “ปิดรูปภาพ”, and an Esc hint on a contrasting light background. The image remains below the toolbar; the dialog explicitly uses a non-draggable region. Escape, backdrop closing and focus restoration remain unchanged.

Validation: Client TypeScript/production build passed; 87 browser renderer checks passed. Added assertions cover titlebar clearance, a readable close label, a normal 1000x700 window, and a narrow 390x844 viewport. Normal/narrow screenshots were inspected. git diff --check passed. Actual native window chrome was not exercised by the browser fixture; its 53px overlap constraint is taken from the desktop window configuration.
