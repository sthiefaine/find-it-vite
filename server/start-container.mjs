import { spawn } from "node:child_process";

// Keep the web server and room server together: either failure restarts both.
const children = [
  spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    stdio: "inherit",
    env: { ...process.env, PORT: "3001", HOST: "127.0.0.1" },
  }),
  spawn("nginx", ["-g", "daemon off;"], { stdio: "inherit" }),
];

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 5_000).unref();
}

for (const child of children) {
  child.once("error", (error) => { console.error(error); stop(1); });
  child.once("exit", (code) => stop(code || 1));
}
process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));
