# Project tasks and prompt history

Status: proposed for user review. No implementation changes yet.

## Observed problem

The Tasks and Saved Prompts tabs in RightDock read only manually created entries from localStorage (`superai-tasks-v1` and `superai-prompts-v1`). Neither the Code composer HTTP input endpoint nor terminal WebSocket input records a submitted prompt for these tabs. Existing conversation runs appear only in the dashboard. Typing instructions into a CLI therefore leaves both tabs empty, as in the supplied screenshots.

Codex has three conversation files for D:\AgentBuild on 2026-10-21. They contain user-role messages, including application-supplied context, which must be distinguished from actual user prompts before importing history. Availability of a transcript does not establish that a task completed.

## Options

1. Recommended: add persistent project prompt history, display submissions in Tasks, and provide reuse and explicit saving in Prompts. Import supported CLI transcripts to recover prior instructions.
2. Retain manual lists and clarify their labels. This does not meet the expectation that existing instructions appear automatically.
3. Parse AI output into a task tracker. This requires provider-specific structured events and a separate design; terminal process state alone cannot establish progress or completion.

## Proposed behavior

- Tasks shows submitted instructions for the selected project, with time, origin, recipient/session when known, and an honest status such as sent or user-marked complete. Existing manual tasks remain available and editable.
- Prompts shows history alongside existing saved prompts, supports search, and offers reuse in the composer without sending automatically. Users can save frequently used entries explicitly.
- Record accepted composer submissions, task delivery, and Agent/Chat requests at authoritative boundaries. Do not record failed deliveries as sent or duplicate a single submission on refresh/replay.
- Direct terminal history comes from supported CLI conversation transcripts. Do not attempt to reconstruct passwords or arbitrary terminal input from raw keystrokes. Identify unsupported or unavailable histories in the UI.
- Recover Codex and Claude prompts only for the selected project. Exclude system/developer/context messages, avoid duplicate records, preserve multiline Thai text and attachment references, and distinguish historical records from newly delivered work.
- Persist new history on disk under the app's existing per-user data directory, retain manual localStorage lists, and show actionable read/write failures.
- Never infer that an instruction was executed successfully or a task finished from a running/exited process or an empty output buffer.

## Verification

Use isolated storage and fixture transcripts to reproduce the missing-history behavior before the fix. Cover project isolation, imports from real supported transcript shapes, context exclusion, duplicate prevention, failed delivery, and persisted history after reload. Verify the Tasks and Prompts tabs in the rendered app, including Thai search, composer reuse without automatic submission, and preservation of existing manually saved entries. Package the validated change for the user's installed app without interrupting active CLI work.
