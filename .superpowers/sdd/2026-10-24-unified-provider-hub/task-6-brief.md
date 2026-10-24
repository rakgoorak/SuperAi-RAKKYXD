# Task 6 Brief: Direct Cloud API Provider Engine (DeepSeek, OpenRouter, Groq BYOK)

## Context
Currently, SuperAi requires local CLI tools (Claude Code, Codex, Antigravity, OpenCode) or Ollama for models. Users want to bring their own API keys (BYOK) for popular high-performance cloud providers—DeepSeek (V3 & R1), Groq (ultra-fast Llama & DeepSeek R1 Distill), and OpenRouter (universal model access)—directly in SuperAi without having to install CLIs or configure local proxies.

## Objectives

1. **Implement `OpenAiCompatibleProvider.ts` (`packages/core/src/providers/OpenAiCompatibleProvider.ts`)**:
   - Class `OpenAiCompatibleProvider extends BaseProvider`:
     - Options:
       ```ts
       export interface OpenAiCompatibleProviderOptions {
         providerId?: 'deepseek' | 'groq' | 'openrouter' | 'openai' | string;
         apiKey?: string;
         baseURL?: string;
         model?: string;
         temperature?: number;
         maxTokens?: number;
       }
       ```
     - Default configurations:
       - `deepseek`: `baseURL = 'https://api.deepseek.com/v1'`, default model `deepseek-chat`
       - `groq`: `baseURL = 'https://api.groq.com/openai/v1'`, default model `llama-3.3-70b-versatile`
       - `openrouter`: `baseURL = 'https://openrouter.ai/api/v1'`, default model `deepseek/deepseek-r1`
       - `openai`: `baseURL = 'https://api.openai.com/v1'`, default model `gpt-4o`
     - Approved origins:
       ```ts
       export const APPROVED_OPENAI_COMPATIBLE_ORIGINS = [
         'https://api.openai.com',
         'https://api.deepseek.com',
         'https://api.groq.com',
         'https://openrouter.ai',
       ] as const;
       ```
     - Uses `credentialEndpoint(endpoint, APPROVED_OPENAI_COMPATIBLE_ORIGINS)` when apiKey is present and destination is not local (localhost/127.0.0.1).
     - Streaming SSE implementation in `stream()`:
       - Sends POST to `/chat/completions` with `{ stream: true, ... }`.
       - Reads the SSE response chunk-by-chunk (`data: {...}`).
       - Handles delta text chunks and calls `onChunk(delta)`.
       - Redacts credentials from outputs and errors using `redactCredential`.
     - Non-streaming `generate()` method supporting standard tool format and usage token parsing.
     - Error handling: Friendly error messages when API key is missing or quota/auth fails.

2. **Update Provider Factory & Types (`packages/core/src/providers/index.ts`)**:
   - Export `OpenAiCompatibleProvider` and related types.
   - Update `ProviderSelectionConfig`:
     `provider: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'web_session' | 'mock' | 'deepseek' | 'groq' | 'openrouter' | 'openai_compatible';`
   - Update `loadStoredAuth`:
     Check for `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` from `.env` and `CredentialStore`.
   - Update `createProvider`:
     Instantiate `OpenAiCompatibleProvider` for `deepseek`, `groq`, `openrouter`, `openai_compatible`.

3. **Update Server Providers Profiles (`packages/studio/server/Providers.ts`)**:
   - Add profiles and model suggestions for cloud providers:
     - `deepseek`: models `['deepseek-chat', 'deepseek-reasoner']`
     - `groq`: models `['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b']`
     - `openrouter`: models `['deepseek/deepseek-r1', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.5-flash']`

4. **Update Client Provider UI & Labels (`packages/studio/client/src/providers.ts` & `ProviderAccess.tsx`)**:
   - Add labels for `deepseek: 'DeepSeek'`, `groq: 'Groq'`, `openrouter: 'OpenRouter'` in `PROVIDER_LABEL`.
   - Update `ProviderAccess.tsx` so BYOK providers show API key setup status / guide.

5. **Unit Tests (`packages/core/test/openai-compatible-provider.test.ts`)**:
   - Test initialization with default base URLs and models for DeepSeek, Groq, OpenRouter.
   - Test credential endpoint enforcement (reject unapproved origins).
   - Test non-streaming `generate()` response parsing and usage token extraction.
   - Test streaming `stream()` SSE delta parsing and chunk delivery.
   - Test `createProvider` factory instantiation.
   - Ensure existing tests in `packages/core/test/token-security.test.ts` and `core.test.ts` remain 100% passing.

6. **Verification**:
   - Run `npm test` across workspaces.
   - Run `npm --workspace=@superai-rakkyxd/client run build`.
