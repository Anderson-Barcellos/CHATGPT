import { createServer } from "node:http";
import { attachRealtimeTranscription } from "../lib/server/realtimeTranscription";
import { validateRuntimeAuthConfig, isAuthEnabled } from "../lib/server/auth";

validateRuntimeAuthConfig();
if (!isAuthEnabled() || !process.env.OPENAI_API_KEY?.trim()) {
  throw new Error("Ditado ao vivo exige autenticação e OPENAI_API_KEY configuradas no servidor.");
}
const port = Number(process.env.TRANSCRIPTION_PORT || 3041);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("TRANSCRIPTION_PORT inválida.");
const server = createServer((request, response) => {
  const health = request.url === "/health";
  response.writeHead(health ? 200 : 404, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(health ? { status: "ready" } : { error: "Not found" }));
});
const sockets = attachRealtimeTranscription(server);
server.listen(port, "127.0.0.1", () => console.info(`[transcription] escutando em loopback:${port}`));
const shutdown = () => {
  for (const socket of sockets.clients) socket.close(1001);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
