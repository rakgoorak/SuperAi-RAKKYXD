# Privacy

SuperAi & RAKKYXD runs on your computer. There is no account with us and no server of ours between
you and the AI you use.

## What stays on your computer

- Projects, chats, history and settings: `%USERPROFILE%\.opencode-multi` on Windows,
  `~/.opencode-multi` on macOS.
- Files you attach: `.superai/attachments/` inside the project.
- API keys you save in **Settings → API Key**: encrypted with your operating system's credential
  protection (Windows DPAPI, macOS Keychain) and never written in plain text.
- Voice dictation: audio is transcribed on your computer and never uploaded.

## What goes to the AI providers

Your prompts, the files the AI reads and the commands it runs go directly from your computer to the
provider you choose (Anthropic, OpenAI, Google, OpenCode, OpenRouter, DeepSeek, Groq, or your own
Ollama), using your own sign-in or API key. Their privacy policies and terms apply. An API key is
only ever sent to the provider it belongs to.

## What the app sends to us

Only an anonymous usage count, so the website can show how many people use the app:

| Sent | Example |
| :--- | :--- |
| A random ID created on first launch | `0b1e…` (not linked to you, your account or your computer's name) |
| App version | `1.0.41` |
| Operating system | `win32`, `darwin` |

It is sent every 10 minutes while the app is open, to a Cloudflare Worker
([source](services/usage-counter)). The worker stores the ID, version, operating system, the country
Cloudflare reports for the request, and when the ID was first and last seen. It does not store IP
addresses, and nothing else is collected: no prompts, files, project names, accounts or keys.

Turn it off any time in **Settings → Notifications**, under "นับจำนวนผู้ใช้แบบไม่ระบุตัวตน" (anonymous usage count; the setting is not translated yet). Development builds
never send it.

## Updates and downloads

The app checks GitHub for new versions on launch and every 30 minutes, and downloads updates from
GitHub. GitHub's privacy policy applies to those requests.

## Questions

Open an issue or a discussion at
[github.com/rakgoorak/SuperAi-RAKKYXD](https://github.com/rakgoorak/SuperAi-RAKKYXD).
