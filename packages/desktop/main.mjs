// Entry point. `--superai-installer` opens the branded installer (launched by Setup.exe);
// otherwise this is the normal desktop app.
if (process.argv.includes("--superai-installer")) await import("./installer/installer-main.mjs");
else await import("./app.mjs");
