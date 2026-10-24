# Artifact rendering validation — 2026-10-25

The old renderer inserted Mermaid and JSX source into an HTML body, so preview displayed source text rather than diagrams/components. SVG was inserted directly into the app DOM. Artifact state also survived file/address-bar navigation.

Implemented language-specific documents in opaque-origin iframes (`sandbox="allow-scripts"`, no same-origin access). React/TSX compiles locally through Sucrase; local React/ReactDOM runtimes support hooks and interaction without network requests. Nonvisual source opens as code. Unsupported imports and runtime/parser errors offer source/retry actions. Rendering state is reset for each selected artifact. The preview toolbar wraps; diagrams fit first and zoom up to 300%, expansion uses a native dialog below the titlebar with a labeled close button, Escape and focus restoration. SVG stays inside the sandbox. File/web navigation clears the old artifact. The runtime/compiler is split into a lazy chunk.

## Checks

- Client TypeScript/Vite production build passed.
- `node packages/desktop/test/artifact-rendering-smoke.mjs`: 23 checks passed in Chromium using the real UI components and local React runtime. Checks include JSX/TSX interaction, source preservation, unsupported imports, malformed JSX, render boundary errors, HTML interaction, SVG isolation, actual SVG zoom/fit, expansion/keyboard focus, narrow controls, Mermaid loader/configuration/result insertion, failed-load retry, parser error display and file/web navigation.
- Mermaid's script request is intercepted with a test stub. This validates integration, not the real Mermaid parser or the availability of the remote asset. No test results claim otherwise.
- `node packages/desktop/test/image-chat-smoke.mjs`: 17 checks passed against the production build, including inline images, zoom, native-titlebar clearance, focus restoration, and Code/Agent/Chat image endpoints.
- Screenshots inspected: `output/artifact-rendering/diagram-preview.png` (real SVG architecture example), `svg-expanded.png`, `react-preview.png`. The diagram screenshot is an SVG example, not evidence that real Mermaid ran.

## Limits

Mermaid currently requires internet access to `https://cdn.jsdelivr.net/npm/mermaid@11.12.0/dist/mermaid.min.js`. Installing a local Mermaid dependency was rejected with EACCES by this environment's network restrictions; no escalation or alternate download was used. The UI reports load failures and has a 20-second loading timeout. A real online Mermaid diagram still needs verification. React previews support a single component file with React/ReactDOM imports; arbitrary packages and project-relative modules are not resolved. Artifact HTML/components must supply their own additional styling and assets. Native Electron packaging and release were not performed.

The API usage follows the [Mermaid renderer documentation](https://mermaid.js.org/config/usage.html) and [Sucrase's supported transformations](https://github.com/alangpierce/sucrase).
