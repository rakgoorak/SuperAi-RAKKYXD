# Recovery, history and results — 2026-10-24

User approved all three additions: retry/edit, resume/search, and inspect changes/preview.

Implementation: preserve existing session/chat persistence. Store per-turn request metadata for new Code chats so retry can retain model, effort, skill and attachments. Edit loads text for review; attached files need reattaching. Agent/Chat retry creates a new run with original seat configuration and saved attachments. Classify account, quota and network errors without hiding their original details.

History searches recorded user/assistant content across registered projects and chat sessions. Restore selected session and scroll offset across restart. Open history entries directly into their context.

Changes panel reads Git working-tree/staged changes relative to HEAD plus untracked paths. Files and diff remain read-only, capped at 256 KB and bounded to the selected workspace, including symlink validation. Label explicitly that changes include the user's edits. Preview opens the existing browser rather than starting a development server automatically.

Validation: unit/integration checks for file scope, binary/large-file restrictions, git staged/unstaged/untracked/deleted files and error hints; desktop smoke and team flow with history, recovery and results actions.

Completed validation: full production build, 123 Studio tests plus core/desktop unit checks, desktop smoke 16 checks, Code composer smoke including retry/edit and reload restoration, Agent/Chat smoke including original-run retry, searchable history and actual Git diff/content/Preview. Screenshots: output/team-check-8mAezq/history.png and changes.png.
