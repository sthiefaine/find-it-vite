import path from "node:path";
import { createMultiplayerServer } from "./multiplayerServer";

const app = createMultiplayerServer({
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "127.0.0.1",
  distDir: path.resolve(process.env.MULTIPLAYER_DIST ?? "dist"),
  allowedOrigins: process.env.MULTIPLAYER_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === "1",
});
const address = await app.listen();
console.log(`Find It multijoueur : http://${address.address}:${address.port} (WebSocket /ws)`);
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { void app.close().then(() => process.exit(0)); });
