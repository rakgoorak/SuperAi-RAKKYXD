# Third-party notices

SuperAi & RAKKYXD is released under the [MIT License](LICENSE). It is built on the open-source
software below, each under its own license. Server-side packages ship with their license files in
`resources/app/node_modules/` (Windows) or `SuperAi-RAKKYXD.app/Contents/Resources/app/node_modules/`
(macOS); interface libraries are compiled into the app's web bundle, and their license texts are
in the projects linked below.

## Included in the app

| Package | License |
| :--- | :--- |
| [Electron](https://github.com/electron/electron) (includes Chromium and Node.js) | MIT, plus the licenses in `LICENSES.chromium.html` shipped with Electron |
| [React](https://github.com/facebook/react), React DOM | MIT |
| [Express](https://github.com/expressjs/express), [cors](https://github.com/expressjs/cors) | MIT |
| [ws](https://github.com/websockets/ws) | MIT |
| [@lydell/node-pty](https://github.com/lydell/node-pty) (fork of microsoft/node-pty) | MIT |
| [xterm.js](https://github.com/xtermjs/xterm.js) and `@xterm/addon-fit` | MIT |
| [ansi_up](https://github.com/drudru/ansi_up) | MIT |
| [sucrase](https://github.com/alangpierce/sucrase) | MIT |
| [Lucide](https://github.com/lucide-icons/lucide) (`lucide-react`) | ISC |
| [Transformers.js](https://github.com/huggingface/transformers.js) (`@huggingface/transformers`) | Apache-2.0 |
| [Playwright](https://github.com/microsoft/playwright) (`playwright-core`) | Apache-2.0 |
| [react-markdown](https://github.com/remarkjs/react-markdown), [remark-gfm](https://github.com/remarkjs/remark-gfm), [remark-breaks](https://github.com/remarkjs/remark-breaks), [remark-math](https://github.com/remarkjs/remark-math), [rehype-katex](https://github.com/remarkjs/remark-math), [rehype-highlight](https://github.com/rehypejs/rehype-highlight) | MIT |
| [KaTeX](https://github.com/KaTeX/KaTeX) (math in answers, with its fonts) | MIT |
| [Mermaid](https://github.com/mermaid-js/mermaid) (diagrams in answers) | MIT |
| [highlight.js](https://github.com/highlightjs/highlight.js) (code colours, via `lowlight`) | BSD-3-Clause |
| [Noto Sans Thai](https://fonts.google.com/noto/specimen/Noto+Sans+Thai) (`@fontsource/noto-sans-thai`) | SIL Open Font License 1.1 |

Packages these depend on are installed alongside them, each with its own license file.

## Downloaded only when you ask for them

These are not shipped with the app. They are fetched from their official sources when you choose
them, and their own terms apply:

- **AI command-line tools:** Claude Code (`@anthropic-ai/claude-code`), Codex (`@openai/codex`),
  OpenCode (`opencode-ai`) and Freebuff (`freebuff`) from npm, and Antigravity CLI from Google's
  official installer. Using them is subject to each provider's terms of service.
- **Voice dictation models** from Hugging Face: `onnx-community/whisper-base`,
  `onnx-community/whisper-small` and `phagehunter/whisper-th-small-onnx`, under the licenses on
  their model pages.
- **Node.js and Git**, when the setup guide installs them for you.
- **Agent Skills** you install from the Skills page, from the repositories it lists (Anthropic,
  OpenAI, Vercel, Cloudflare, Supabase, Addy Osmani's web-quality skills) or from skills.sh, under
  each skill's own license.

## In this repository only

The project ships two Agent Skills for people developing SuperAi with Claude Code, in
`.claude/skills/`. They are not part of the app, and each folder keeps its MIT license file:

- `accessibility` from [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills)
- `native-feel-cross-platform-desktop` from [yetone/native-feel-skill](https://github.com/yetone/native-feel-skill)

SuperAi & RAKKYXD is not affiliated with, endorsed by, or sponsored by Anthropic, OpenAI, Google,
or any other AI provider. All product names and trademarks belong to their owners.
