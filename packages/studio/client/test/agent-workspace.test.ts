import assert from "node:assert/strict";
import { agentLocations } from "../src/components/agentWorkspaceState";

const main = { name: "Main", provider: "cli:codex", model: "", effort: "" };
const sub = { ...main, name: "Sub" };
const config = { main, subagents: [sub] };
const run = { status: "running", stage: "working", main, subagents: [sub], tasks: [{ assignee: 0, status: "running" }] } as any;

assert.deepEqual(agentLocations(config, undefined, true).map(a => a.room), ["meeting", "meeting"]);
assert.deepEqual(agentLocations(config, { ...run, stage: "planning" }, false).map(a => a.room), ["meeting", "meeting"]);
assert.deepEqual(agentLocations(config, run, false).map(a => a.room), ["meeting", "desk"]);
assert.deepEqual(agentLocations(config, { ...run, status: "completed", stage: "completed" }, false).map(a => a.room), ["meeting", "meeting"]);
console.log("agent workspace state: passed");
