# Composer context menu

User-authorized direction: adopt the supplied Claude reference for functional folder and branch menus. Keep incumbent charcoal (#222220, #2b2b28, #33332f), text (#eeede7, #b9b8ad), accent (#d9a080), Noto Sans Thai, and quiet compact controls. Popovers align to their triggers and open above the composer with a bounded scrolling list, clear selected checks, full-path tooltips, inline errors, and keyboard dismissal/focus return.

Implement project selection through the existing workspace/draft routing; opening a folder uses the existing project flow. Branch names come from Git in the actual selected session directory. Switching uses only known local branches and Git's non-force switch, refuses dirty directories and active work, and reports errors without losing drafts. Worktree management reuses the established dialog rather than adding a decorative toggle. Keep existing model/permission controls connected to their provider/session behavior; do not add provider-specific options the app cannot honor.

Verify real Git branch listing/switching and refusal cases in isolated fixtures, browser menu selection/search/Escape/outside dismissal, draft isolation, narrow popover bounds, and existing attachment placement. Build client/server and inspect screenshots. No release or live repository branch switching as part of implementation.
