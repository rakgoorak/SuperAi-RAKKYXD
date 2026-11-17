// Artifact previews run user React code in a sandboxed iframe with React as plain globals.
// React 19 dropped its UMD files, so bundle the app's own React into one minified script
// that sets window.React and window.ReactDOM (react-dom plus react-dom/client).
// Used by vite.config.mjs (as virtual:artifact-react-runtime) and by the artifact smoke test.
import path from 'node:path';
import { build } from 'esbuild';

export const ARTIFACT_REACT_RUNTIME_ID = 'virtual:artifact-react-runtime';

export async function bundleArtifactReactRuntime() {
  const result = await build({
    stdin: {
      contents: "import * as React from 'react'; import * as DOM from 'react-dom'; import * as Client from 'react-dom/client';"
        + ' window.React = React; window.ReactDOM = { ...DOM, ...Client };',
      resolveDir: path.dirname(import.meta.dirname),
    },
    bundle: true, minify: true, write: false, format: 'iife', legalComments: 'inline',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  return result.outputFiles[0].text;
}
