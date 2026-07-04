// Deliberately empty. Without this file, the Studio's Vite walks up and inherits the
// ROOT postcss.config.mjs (the Next app's breakpoint-token pipeline), which doesn't
// apply to the Studio workspace. Nearest config wins — this one isolates the workspace.
module.exports = { plugins: {} };
