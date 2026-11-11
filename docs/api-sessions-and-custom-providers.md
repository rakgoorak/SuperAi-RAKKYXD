# API chat sessions and custom providers

The graphical chat inside Terminal mode now supports API connections alongside CLI sessions. API sessions use SuperAi's own streaming chat and file/command tools; they do not launch a CLI or offer a raw terminal view.

## Use

1. Open **Settings → API Key** and connect OpenRouter, DeepSeek or Groq, or choose **Add Custom Provider**.
2. For custom providers, enter a name, an OpenAI-compatible API base URL, a key, and one or more model IDs. The base URL excludes `/chat/completions`; HTTPS is required except for loopback HTTP endpoints.
3. Open **New session** in Terminal mode, choose the entry ending in **API**, choose a model, and open the session.
4. Use the existing composer, model selector, conversation history, questions, queue and Stop button.

Custom entries are also available in Agent and multi-AI seat pickers. Custom model lists are entered manually, so endpoints without a model-list API remain usable. The Test button checks the endpoint's model-list route and may fail when that route is unavailable even if chat completions work.

## Credentials and transport

Endpoint metadata is stored in `custom-providers.json` in the application's data directory. Keys use the existing encrypted CredentialStore, independently keyed by each custom provider's ID. Metadata and conversation history do not contain keys. A custom key is attached only to the explicitly configured endpoint; redirects are refused. Saving a custom entry does not make an API request. Existing built-in key checks are retained.

## Current scope

- Custom protocol: OpenAI-compatible Chat Completions with streaming. Native Anthropic/Gemini protocols are not implemented in the custom form.
- Permissions: read (read/search tools), edit (adds file-write tools), auto (adds command/git tools). Interactive per-tool approval and CLI-only skills are not offered for API sessions.
- The latest 40 user/assistant messages are sent for follow-up context; file-tool results are included within the active turn. History itself uses existing persistent chat storage.
- Image/PDF attachments are currently rejected with an explicit message. Text files can be read through tools.
- Existing running sessions are unchanged. Start the updated local build to use the new connection options. No installer/release was produced.

## Verification

- Core, server and client TypeScript builds passed; client Vite production build passed.
- 45 focused provider, API session, route, persistence, cancellation, custom-key isolation and CLI regression checks passed.
- Browser smoke `node packages/desktop/test/api-session-smoke.mjs` passed custom form submission, session creation, selected model forwarding, streamed answer, absence of a raw terminal toggle, history after reload and renderer-error checks. Screenshots are in `output/api-session/`.
- Integration tests used an in-process loopback API and an in-memory credential adapter. No live paid provider requests or changes to the user's saved keys were made.
- The repository-wide suite was not rerun; earlier unresolved multi-AI summarizer test results remain outside this change's validation.
