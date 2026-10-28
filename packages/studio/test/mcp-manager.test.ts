import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getClaudeMcpServers,
  getCodexMcpServers,
  listMcpServers,
  saveMcpServer,
  removeMcpServer,
  toggleMcpServer,
  type McpPaths,
} from "../server/McpManager.js";

function tempPaths(): { paths: McpPaths; cleanup: () => void } {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-"));
  const home = path.join(tmp, "user");
  const codexHome = path.join(tmp, "codex");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(codexHome, { recursive: true });
  return {
    paths: { home, codexHome },
    cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }),
  };
}

test("reads Claude MCP servers from .claude.json", () => {
  const { paths, cleanup } = tempPaths();
  try {
    const claudeJson = {
      mcpServers: {
        "roblox-studio": {
          type: "stdio",
          command: "cmd.exe",
          args: ["/c", "mcp.bat"],
          env: { FOO: "bar" },
        },
        "remote-docs": {
          type: "http",
          url: "https://example.com/mcp",
          disabled: true,
        },
      },
    };
    fs.writeFileSync(path.join(paths.home, ".claude.json"), JSON.stringify(claudeJson));

    const servers = getClaudeMcpServers(paths);
    assert.equal(servers.length, 2);

    const roblox = servers.find((s) => s.name === "roblox-studio")!;
    assert.ok(roblox);
    assert.equal(roblox.provider, "claude");
    assert.equal(roblox.command, "cmd.exe");
    assert.deepEqual(roblox.args, ["/c", "mcp.bat"]);
    assert.equal(roblox.enabled, true);

    const docs = servers.find((s) => s.name === "remote-docs")!;
    assert.ok(docs);
    assert.equal(docs.url, "https://example.com/mcp");
    assert.equal(docs.enabled, false);
  } finally {
    cleanup();
  }
});

test("reads Codex MCP servers from config.toml", () => {
  const { paths, cleanup } = tempPaths();
  try {
    const toml = `
model = "gpt-5"

[mcp_servers.blender]
command = "uvx"
args = ["blender-mcp"]

[mcp_servers.node_repl]
command = "node_repl.exe"
args = ["--interactive"]
disabled = true

[mcp_servers.node_repl.env]
PORT = "3000"
KEY = "abc"

[projects."d:\\test"]
trust_level = "trusted"
`;
    fs.writeFileSync(path.join(paths.codexHome, "config.toml"), toml);

    const servers = getCodexMcpServers(paths);
    assert.equal(servers.length, 2);

    const blender = servers.find((s) => s.name === "blender")!;
    assert.ok(blender);
    assert.equal(blender.provider, "codex");
    assert.equal(blender.command, "uvx");
    assert.deepEqual(blender.args, ["blender-mcp"]);
    assert.equal(blender.enabled, true);

    const nodeRepl = servers.find((s) => s.name === "node_repl")!;
    assert.ok(nodeRepl);
    assert.equal(nodeRepl.enabled, false);
    assert.equal(nodeRepl.env?.PORT, "3000");
    assert.equal(nodeRepl.env?.KEY, "abc");
  } finally {
    cleanup();
  }
});

test("saves, toggles, and removes MCP servers for Claude and Codex", () => {
  const { paths, cleanup } = tempPaths();
  try {
    // 1. Add Claude server
    saveMcpServer(
      {
        provider: "claude",
        name: "test-claude",
        type: "stdio",
        command: "npx",
        args: ["-y", "test-mcp"],
      },
      undefined,
      paths,
    );

    // 2. Add Codex server
    saveMcpServer(
      {
        provider: "codex",
        name: "test-codex",
        type: "stdio",
        command: "python",
        args: ["-m", "mcp_server"],
        env: { DEBUG: "1" },
      },
      undefined,
      paths,
    );

    let list = listMcpServers(undefined, paths);
    assert.equal(list.length, 2);
    assert.ok(list.some((s) => s.name === "test-claude" && s.provider === "claude"));
    assert.ok(list.some((s) => s.name === "test-codex" && s.provider === "codex"));

    // 3. Toggle disable
    toggleMcpServer("claude", "test-claude", false, undefined, paths);
    toggleMcpServer("codex", "test-codex", false, undefined, paths);

    list = listMcpServers(undefined, paths);
    assert.equal(list.find((s) => s.name === "test-claude")?.enabled, false);
    assert.equal(list.find((s) => s.name === "test-codex")?.enabled, false);

    // 4. Toggle back enable
    toggleMcpServer("claude", "test-claude", true, undefined, paths);
    toggleMcpServer("codex", "test-codex", true, undefined, paths);

    list = listMcpServers(undefined, paths);
    assert.equal(list.find((s) => s.name === "test-claude")?.enabled, true);
    assert.equal(list.find((s) => s.name === "test-codex")?.enabled, true);

    // 5. Remove servers
    assert.equal(removeMcpServer("claude", "test-claude", undefined, paths), true);
    assert.equal(removeMcpServer("codex", "test-codex", undefined, paths), true);

    list = listMcpServers(undefined, paths);
    assert.equal(list.length, 0);
  } finally {
    cleanup();
  }
});
