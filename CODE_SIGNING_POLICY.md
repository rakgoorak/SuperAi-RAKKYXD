# Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by
[SignPath Foundation](https://signpath.org/).

The Windows installer (`SuperAi-RAKKYXD-Setup.exe`) and the app's executable
(`SuperAi-RAKKYXD.exe`) are signed. They are built from this repository by the
[release workflow](.github/workflows/release.yml) on GitHub-hosted runners and published only at
[SuperAi-RAKKYXD-releases](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases).
Every release is signed only after a person approves it. Third-party files shipped with the app
(Electron, Node.js modules) keep their publishers' signatures or stay unsigned; they are not signed
with this certificate.

## Team roles

| Role | Members |
| :--- | :--- |
| Authors (may change the source without further review) | [rakgoorak](https://github.com/rakgoorak) |
| Reviewers (review contributions from others, such as pull requests) | [rakgoorak](https://github.com/rakgoorak) |
| Approvers (approve each signing request) | [rakgoorak](https://github.com/rakgoorak) |

All members use multi-factor authentication for GitHub and SignPath.

## Privacy

See the [privacy policy](PRIVACY.md). In short: the app sends the developer only an anonymous usage
count (a random install ID, the app version and the operating system), which can be turned off in
the installer and in Settings. Everything else goes only where you send it:

- The AI providers you choose, under their own policies:
  [Anthropic](https://www.anthropic.com/legal/privacy),
  [OpenAI](https://openai.com/policies/privacy-policy/),
  [Google](https://policies.google.com/privacy),
  [OpenCode](https://opencode.ai/),
  [OpenRouter](https://openrouter.ai/privacy),
  [DeepSeek](https://platform.deepseek.com/downloads/DeepSeek%20Privacy%20Policy.html),
  [Groq](https://groq.com/privacy-policy/), or your own [Ollama](https://ollama.com/) on your computer.
- The anonymous usage count is received by a [Cloudflare Worker](services/usage-counter)
  ([Cloudflare privacy policy](https://www.cloudflare.com/privacypolicy/)).
- Update checks and downloads go to GitHub ([GitHub privacy statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement)).

## Reporting

Report a suspicious or wrongly signed file as described in [SECURITY.md](SECURITY.md).
