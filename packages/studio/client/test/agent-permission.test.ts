import assert from "node:assert/strict";

// Test storage key and default fallback behavior for allowTools per workspace
function getAllowToolsKey(workspaceId: string): string {
  return `superai-agent-allow-tools:${workspaceId}`;
}

function loadAllowToolsPreference(workspaceId: string, storage: Record<string, string>): boolean {
  if (!workspaceId) return false;
  const value = storage[getAllowToolsKey(workspaceId)];
  return value === "true";
}

function saveAllowToolsPreference(workspaceId: string, allowed: boolean, storage: Record<string, string>): void {
  if (!workspaceId) return;
  storage[getAllowToolsKey(workspaceId)] = allowed ? "true" : "false";
}

// 1. Defaults to false when nothing is stored
const fakeStorage: Record<string, string> = {};
assert.equal(loadAllowToolsPreference("ws-1", fakeStorage), false, "Default should be false (read-only plan mode)");

// 2. Saves preference and reads back true
saveAllowToolsPreference("ws-1", true, fakeStorage);
assert.equal(loadAllowToolsPreference("ws-1", fakeStorage), true, "Should return true after saving true");

// 3. Independent workspaces have independent preferences
assert.equal(loadAllowToolsPreference("ws-2", fakeStorage), false, "ws-2 should still be false");
saveAllowToolsPreference("ws-2", false, fakeStorage);
assert.equal(loadAllowToolsPreference("ws-1", fakeStorage), true, "ws-1 should remain true");
assert.equal(loadAllowToolsPreference("ws-2", fakeStorage), false, "ws-2 should remain false");

console.log("agent permission tests passed");
