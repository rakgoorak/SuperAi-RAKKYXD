declare module '*?raw' {
  const source: string;
  export default source;
}

declare module 'virtual:artifact-react-runtime' {
  const source: string;
  export default source;
}

// Stylesheets loaded on demand with import() (for example KaTeX's, once an answer has math).
declare module "*.css";
