# Simplify composer targets

User-specified behavior: retain only “ที่เลือก” and “ทุก session”. Select the destination session by clicking its pane, tab or sidebar entry. “ทุก session” continues to include only eligible sessions in the current project. Keep the recipient visible in the input placeholder and selector tooltip.

- [x] Replace session IDs in composer target state with the `active | all` union. Sending and stopping use the selected session in active mode. Recommendations and history set selection and return to active mode.
- [x] Remove individual-session options; keep two short labels. Update the placeholder for selected and broadcast modes.
- [x] Update renderer and native-smoke selectors to select session tabs, and verify exactly two choices, selection tracking, broadcast recipients, and no sends when changing selection. Client build passed; 64 browser renderer checks passed. Native smoke selectors were adapted; the native smoke itself was not rerun.
