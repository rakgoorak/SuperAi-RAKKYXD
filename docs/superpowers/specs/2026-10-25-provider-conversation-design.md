# Provider conversation refinement

Approved by the user after the review in `output/provider-ui-review-2026-10-25.md`.

Keep the existing warm charcoal visual system and CLI integrations. Refine the existing shell instead of adding five themes or replacing the chat implementation.

- A new conversation shows the existing composer with an AI selector. Sending creates a chat session with the saved model/effort, without the session configuration dialog. Existing explicit session creation remains available for terminals and bulk launches. General conversation can use an app-managed folder when no project exists; it must not silently select a user folder. New quick conversations start read-only, visibly explained beside the selector.
- Keep drafts and attachments until sending succeeds. Reuse a just-created session after a failed first send. Prevent duplicate first sends. Starting a new conversation must not auto-select another existing session.
- Default to one conversation and a closed Preview, while respecting saved layout/Preview preferences. Hide redundant headings for zero/one session; retain layout and hidden-session recovery when relevant.
- Show a stable provider badge in the sidebar, session tabs and composer independently of editable session names. Describe CLI transport, attachments and terminal-only restrictions honestly.
- History has a recent-conversations view shared across modes plus full-text message search. Code entries reopen the correct session, including hidden sessions; Agent/Chat entries reopen the correct run. Show providers and project context. Preserve loading, error and no-results states.
- Explain permission choices per provider, especially Codex's workspace-write semantics for both edit/auto. Do not imply per-tool approval is implemented.

Validation: client/server type checks and builds; targeted server tests for the app-managed general workspace; browser fixture coverage for first send, retries, duplicate sends, drafts, provider identity, history navigation and narrow layout. Provider calls and account login are not required for deterministic UI checks.
