# AI account profiles

Open **การตั้งค่า → บัญชี AI** to add a named profile, sign in using the provider's CLI terminal, refresh its status, rename it, or choose the default for new work. The original machine login appears as **บัญชีเดิมของเครื่อง** and is preserved.

Select an account when opening a Code room, starting a quick conversation, or configuring an Agent/Chat seat. A room keeps its original account across restarts and chat/terminal switches. Forks retain the source account. Changing the default affects new work only. Account names in rooms are profile labels supplied by the user; they are not verified email addresses.

The Usage panel has an account selector for each supported CLI. Authentication, model discovery, quota probes, skills, predictions and team requests use the chosen profile. Existing saved rooms and older run history retain the system account.

| Provider | Support | Mechanism |
| --- | --- | --- |
| Claude Code | Separate claude.ai logins | `CLAUDE_CONFIG_DIR` per process |
| Codex | Separate logins | `CODEX_HOME` per process; new profiles use the CLI's file credential store |
| OpenCode | Separate CLI profiles | Separate XDG data/config/cache/state directories and `OPENCODE_CONFIG_DIR`; verified with OpenCode 1.19.5 on Windows using `debug paths` |
| Antigravity (`agy`) | Original machine login only | Its documented unified OS keyring does not establish a supported per-process login isolation mechanism; the UI therefore does not offer additional profiles |

Profiles contain independent CLI settings, history and plugins. Sign in to each new profile yourself and configure its global skills/plugins through that CLI. Project settings remain project settings, shared with other profiles using that project. The app's existing global MCP editor manages the original machine configuration; project-scoped MCP configuration can still be shared.

Metadata lives under `~/.opencode-multi/accounts/profiles.json`. Each generated UUID identifies a private profile directory. With `SUPERAI_DATA_DIR`, the registry is stored under that application's data directory instead. The app stores names and ids; credentials remain owned by the provider CLI and are never returned by the account API. New profiles do not copy existing credentials. Common inherited authentication/backend overrides are removed from managed CLI processes; OpenCode's AWS/Google fallback credential paths also point into its profile directory. The system profile preserves the original environment.

Removing a profile removes its registry entry, resets its default selection, and retains its CLI login/history files on disk. Removal is refused while saved tabs or run history reference that profile. Close the relevant tabs and clear the relevant run history first. Removing a profile is not a provider logout.

Claude's documentation notes that separate configuration directories do not isolate two Claude Console sign-ins without API keys. This feature's Claude account support targets claude.ai logins. Provider policies and project-level credential helpers remain controlled by the CLI.

Validation uses temporary registries, fake credential values, real child processes, scoped HTTP API tests, and a Playwright desktop UI smoke test. The UI smoke test stubs auth/model probes and never signs into a real account. Real OAuth login and live quota readings must be checked after the user connects their accounts.

Sources: [Claude authentication](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts), [Codex authentication](https://learn.chatgpt.com/docs/auth), [OpenCode troubleshooting](https://docs.dev.opencode.ai/docs/troubleshooting/), [OpenCode providers](https://opencode.ai/docs/providers/), [Antigravity authentication](https://antigravity.google/docs/install?tab=cli).
