# Isolated composer drafts

User request: typing and pending attachments must not follow a mode/session switch.

Design: key drafts by workspace and mode; Code additionally keys by selected session or broadcast target. Keep unsent text across reload using a versioned localStorage map, migrating the existing global draft once. Pending File objects and thumbnail URLs stay in memory per key. Returning to a key restores its own text and attachments. Sending clears only its originating key, even when the user switches while the request is pending. Suggestions/edits that target a different Code session write directly to that session's key.

- [x] Introduce keyed text draft storage and route explicit session-targeted draft actions correctly.
- [x] Key pending composer attachments with correct URL cleanup and asynchronous PDF metadata routing.
- [x] Verify mode/session/broadcast/project isolation, restoration, reload persistence, explicit suggestion targeting and send clearing with browser fixtures. Client build passed; 83 renderer checks passed, including 19 added draft-isolation checks. No renderer errors.
