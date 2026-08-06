import "server-only";

const STUDIO_RUNNER_CSP = [
  "default-src 'none'",
  "script-src blob:",
  "connect-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
].join("; ");

const STUDIO_RUNNER_SOURCE = `
const hostPostMessage = self.postMessage.bind(self);
let sessionToken = null;
let logCount = 0;
let logBytes = 0;
const maxLogs = 200;
const maxLogBytes = 65536;
const maxEntryBytes = 8192;
const encoder = new TextEncoder();

const send = (payload) => hostPostMessage({ token: sessionToken, ...payload });
const stringify = (value) => {
  if (typeof value === "string") return value;
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "function") return "[Function " + (value.name || "anonymous") + "]";
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
};
const sendLog = (level, args) => {
  const text = args.map(stringify).join(" ");
  const bytes = encoder.encode(text).byteLength;
  if (logCount >= maxLogs || bytes > maxEntryBytes || logBytes + bytes > maxLogBytes) {
    throw new Error("Limite de saída do runner excedido.");
  }
  logCount += 1;
  logBytes += bytes;
  send({ type: "console", level, text });
};

self.console = {
  log: (...args) => sendLog("log", args),
  info: (...args) => sendLog("info", args),
  warn: (...args) => sendLog("warn", args),
  error: (...args) => sendLog("error", args),
};

const blockedNetwork = () => Promise.reject(new Error("Rede desativada no runner local."));
for (const [name, value] of [
  ["fetch", blockedNetwork],
  ["XMLHttpRequest", undefined],
  ["WebSocket", undefined],
  ["EventSource", undefined],
  ["WebTransport", undefined],
  ["Worker", undefined],
  ["SharedWorker", undefined],
]) {
  try {
    Object.defineProperty(self, name, { value, configurable: false, writable: false });
  } catch {}
}
try {
  Object.defineProperty(self, "postMessage", {
    value: () => { throw new Error("Canal do runner reservado."); },
    configurable: false,
    writable: false,
  });
} catch {}

self.addEventListener("message", async (event) => {
  if (sessionToken || !event.data || typeof event.data.token !== "string" || typeof event.data.code !== "string") return;
  sessionToken = event.data.token;
  const moduleUrl = URL.createObjectURL(new Blob([event.data.code], { type: "text/javascript" }));
  try {
    await import(moduleUrl);
    send({ type: "done" });
  } catch (error) {
    send({ type: "runtime-error", text: error instanceof Error ? error.stack || error.message : String(error) });
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
});
`;

export function createStudioRunnerScriptResponse(): Response {
  return new Response(STUDIO_RUNNER_SOURCE, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Content-Security-Policy": STUDIO_RUNNER_CSP,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
