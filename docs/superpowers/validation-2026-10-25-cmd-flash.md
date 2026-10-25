# CMD flash investigation — 2026-10-25

User report: a CMD window appeared and closed unexpectedly; user asked whether SuperAi caused it. Exact window ownership and appearance time were not captured, so attribution remains unconfirmed.

## Evidence ledger

1. Read-only process inventory found Electron PIDs 42640 and 1444 starting at 13:47:08/13:47:13, and 39896 and 41328 at 13:48:52/13:48:53. All executable paths matched `D:/AgentBuild/node_modules/electron/dist/electron.exe`. These timestamps match the two session-controls test launches and their isolated output folders recorded in the preceding UI validation.
2. Confirmed process identity/path/start-time before stopping those four test processes. A subsequent inventory of those exact PIDs returned no processes. Other CMD, Node, PowerShell, Claude and ChatGPT processes were not terminated.
3. Inspected subprocess call sites in studio/server and desktop code. Inspected production CLI probes and termination helpers specify `windowsHide: true`; this does not establish that every descendant process or every installed version does so.
4. Found the executed test cleanup fallback in `packages/desktop/test/smoke-harness.mjs` calling Windows `taskkill` without `windowsHide` or a timeout, and swallowing termination failures. This is a concrete potential source of a brief console during failed test cleanup, not proof of the user's exact flash.
5. Ran `node --test packages/desktop/smoke-harness.test.mjs` before the fix: 1 passed, 2 failed. The real cleanup call site omitted console hiding and did not report failed termination. The child-process function was mocked, so no visible helper or real process termination was invoked by these tests.
6. Added `windowsHide: true`, a 10-second helper deadline, and a log for unsuccessful owned-process cleanup. Added the regression file to the desktop test command.
7. Reran the same test command: all 3 passed, zero skipped. `node --check packages/desktop/test/smoke-harness.mjs` and `git diff --check` passed. Exact-PID inventory again returned no remaining test Electron processes.

## Attribution limits

Ranked possibilities were the test cleanup helper, activity from the leftover test instances, and another application or tool. The missing console-hiding flag is verified and fixed; the leftover test instances are stopped. The visible CMD's process ancestry was not available, and no deliberate visible-window reproduction was performed on the user's desktop. The original flash therefore cannot yet be conclusively attributed, nor can this change be claimed to eliminate every possible CMD flash. An ongoing occurrence and its approximate time would allow further correlation.

The fix affects the development/test harness. It does not establish a defect or a fix in the distributed main application. No new installer or release was produced.
