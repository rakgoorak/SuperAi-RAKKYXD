# Agent and Chat team settings

Status: approved by the user and implemented. Renderer validation: 116 checks passed; client production build passed.

## Goal

Keep Agent and Chat conversations focused on messages. Remove the large inline configuration forms and use one consistent, dedicated team editor. Preserve the established dark olive surfaces, peach accent, Thai typography, provider choices, and execution behavior.

## Recommended interaction

Place a compact team summary beside the conversation heading, with a clearly labeled “ตั้งค่าทีม” button. Agent summarizes its Main and Sub-agent count; Chat summarizes the selected AI count and whether a summarizer is enabled. The summary contains no editable dropdowns.

The button opens a right-side modal drawer. On narrow windows it fills the viewport. Its header shows “ทีม Agent” or “ทีม Chat” and a labeled close control, positioned below the native desktop title bar. The conversation stays visible behind the drawer on larger windows.

The drawer has a scrollable body and fixed footer with “ยกเลิก” and “บันทึกทีม”. Edits are local until saved. Cancel, Escape, and close discard pending edits; saving applies the existing workspace configuration and returns focus to the opener. A save error keeps the drawer and edits open with useful feedback. Switching workspace or mode closes the editor without applying unsaved changes.

## Agent

Show a “ผู้วางแผนและตรวจงาน” Main section, followed by a “ผู้ร่วมทีม” list. Each member has a compact identity row and vertically grouped provider, model, and effort fields. Adding and removing members respects existing limits. Keep tool readiness and account guidance near the affected member. Preserve the existing permission to allow Sub-agents to edit files and run commands.

## Chat

Show “AI ที่ร่วมตอบ” as the editable member list. Put the optional summarizer in a separate section below it, including the existing summary strategy and summarizer model controls. Preserve existing member limits and provider/model availability rules.

## Conversation surface

Remove configuration cards from the message scroll area in both modes. Keep conversation history, run progress, input, attachments, pinned files, and isolated drafts working. Provide a brief empty state inviting a first message, with the team summary available before sending. While a run is active, show team details read-only and explain why changes are unavailable.

## Alternatives considered

- Centered modal: familiar, but gives less room for several members and long model names.
- Separate settings page: roomier, but interrupts composing and makes checking the current conversation harder.

The drawer preserves conversation context while giving configuration its own space.

## Verification

Build and type-check the client. Extend the existing conversation fixture to check Agent and Chat drawers, saved and canceled changes, workspace/mode separation, active-run locking, member limits, summarizer toggling, Escape and focus restoration. Inspect desktop and narrow-window screenshots for readable fields, no horizontal overflow, visible footer actions, and native title-bar clearance. Do not call paid AI providers during UI checks.
