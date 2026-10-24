# Artifact rendering implementation plan

**Approved scope:** Render Mermaid diagrams and HTML/React previews, offer preview/code, diagram zoom and expanded view, and actionable render errors.

**Design:** Keep the app's charcoal palette (#222220, #2b2b28, #33332f), warm white text (#eeede7), muted text (#b9b8ad), and existing accent (#d9a080). Noto Sans Thai for controls and diagram labels; Cascadia Code for source. Quiet, wrapping toolbar above an uncluttered canvas. Diagrams fit the canvas initially; zoom increases readable labels and scrolls rather than clipping. Expanded view retains a clear close action below the native titlebar. This preserves the established product identity instead of introducing another theme.

**Architecture:** A document builder compiles React with Sucrase and packages local React runtime assets. All generated content, including SVG and Mermaid, runs in an opaque-origin sandbox iframe. Mermaid 11.12.0 loads from jsDelivr inside the sandbox after the iframe load handshake. PreviewPanel owns navigation; ArtifactPreview owns the current render, controls, and error state. The renderer loads lazily, so its compiler/runtime does not enlarge the initial app chunk.

- [x] Add Sucrase as an explicit dependency; package existing local React UMD assets. Mermaid installation was denied by network permissions (EACCES), so use the pinned CDN loader and document the online requirement.
- [x] Add artifact document builder, separate language dispatch, safe script serialization, runtime error reporting and import restrictions.
- [x] Replace ArtifactPreview's HTML-only renderer with loading/error states, diagram zoom, and native-dialog expansion.
- [x] Clear artifact state when navigating to files or web URLs; reset preview state when a different artifact is selected.
- [x] Add browser checks for Mermaid loader/render integration with a stubbed parser, interactive JSX/TSX, real SVG isolation/zoom, malformed code recovery, expansion, narrow layout and navigation.
- [x] Run client build and focused browser checks; inspect screenshots and record limits. Preserve unrelated working changes. No release or Git writes in this task.

**Remaining validation:** Real Mermaid parsing/CDN access and native Electron packaging require an environment with the required access. They are not certified by the stubbed browser tests.
