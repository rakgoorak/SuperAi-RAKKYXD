import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { SNAPSHOT } from "../server/BrowserPage.js";
import { runExternal } from "../server/ExternalBrowser.js";

test("hidden file inputs have upload refs, while hidden text inputs are omitted", () => {
  const input = (type: string) => ({
    tagName: "INPUT", type, getBoundingClientRect: () => ({ width: 0, height: 0 }),
    closest: () => ({}), getAttribute: (name: string) => name === "type" ? type : null,
    setAttribute() {}, value: "",
  });
  const inputs = [input("text"), input("file")];
  const result = runInNewContext(SNAPSHOT, {
    document: { documentElement: { scrollHeight: 0 }, querySelectorAll: (query: string) => query.startsWith("a[href]") ? inputs : [] },
    getComputedStyle: () => ({ display: "none", opacity: 0, visibility: "hidden" }),
    window: {}, location: { href: "https://example.com" }, scrollY: 0, innerHeight: 0,
  });
  assert.match(JSON.stringify(result), /\[e1\] file input/);
  assert.doesNotMatch(JSON.stringify(result), /text input/);
});

test("an invalid opt-in Edge connection fails instead of launching another browser", async () => {
  const previous = process.env.SUPERAI_EDGE_CDP_PORT;
  process.env.SUPERAI_EDGE_CDP_PORT = "65536";
  try {
    await assert.rejects(runExternal("edge", "browser_tabs", {}), /configured Microsoft Edge window.*valid local debugging port/);
  } finally {
    if (previous === undefined) delete process.env.SUPERAI_EDGE_CDP_PORT;
    else process.env.SUPERAI_EDGE_CDP_PORT = previous;
  }
});
