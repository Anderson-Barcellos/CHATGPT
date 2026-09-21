// Smoke pago explícito, só com texto sintético. Não imprime credenciais/respostas brutas.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const key = process.env.XAI_API_KEY?.trim() || process.env.GROK_API_KEY?.trim();
const report = {};
const outputDir = process.env.GROK_SMOKE_OUTPUT_DIR;
const voiceOnly = process.argv.includes("--voice-only");
const textOnly = process.argv.includes("--text-only");
const emit = () => console.log(`GROK_SMOKE ${JSON.stringify(report)}`);

async function api(endpoint, body) {
  const response = await fetch(`https://api.x.ai/v1/${endpoint}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`upstream_http_${response.status}`);
  return response.json();
}

async function voice() {
  const catalog = await api("tts/voices");
  const voices = Array.isArray(catalog) ? catalog : catalog.voices ?? catalog.data ?? [];
  report.voiceCatalogCount = voices.length;
  const token = await api("realtime/client_secrets", { expires_after: { seconds: 300 } });
  const secret = typeof token.value === "string" ? token.value : token.client_secret?.value;
  if (!secret) throw new Error("ephemeral_token_invalid");
  const started = performance.now();
  const chunks = [];
  let byteCount = 0;
  let transcript = "";
  let firstAudioMs;
  const expected = "Este é um teste do SoundCase. A chuva passou, o céu ficou claro e agora podemos escutar esta frase com tranquilidade.";
  await new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://api.x.ai/v1/realtime?model=grok-voice-latest", [`xai-client-secret.${secret}`]);
    let finished = false;
    let requested = false;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      ws.close();
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => finish(new Error("voice_timeout")), 60_000);
    ws.addEventListener("error", () => finish(new Error("voice_connection_failed")));
    ws.addEventListener("close", () => { if (!finished) finish(new Error("voice_disconnected")); });
    ws.addEventListener("open", () => ws.send(JSON.stringify({
      type: "session.update",
      session: {
        voice: "eve", turn_detection: null,
        instructions: "Você é um narrador em português brasileiro. Leia exatamente o texto enviado, sem introduzir, resumir, responder ou acrescentar comentários.",
        audio: { output: { format: { type: "audio/pcm", rate: 24000 }, speed: 1.15 } },
      },
    })));
    ws.addEventListener("message", ({ data }) => {
      try {
        const event = JSON.parse(String(data));
        if (event.type === "session.updated" && !requested) {
          requested = true;
          ws.send(JSON.stringify({ type: "conversation.item.create", item: {
            type: "message", role: "user", content: [{ type: "input_text", text: expected }],
          } }));
          ws.send(JSON.stringify({ type: "response.create" }));
        }
        if (["response.audio.delta", "response.output_audio.delta"].includes(event.type)) {
          firstAudioMs ??= Math.round(performance.now() - started);
          const chunk = Buffer.from(event.delta, "base64");
          byteCount += chunk.length;
          // PCM 24 kHz mono int16: limite absoluto de dois minutos recebidos.
          if (byteCount > 24000 * 2 * 120) return finish(new Error("voice_budget_limit"));
          chunks.push(chunk);
        }
        if (["response.audio_transcript.delta", "response.output_audio_transcript.delta"].includes(event.type)) transcript += event.delta;
        if (event.type === "error") finish(new Error("voice_upstream_error"));
        if (event.type === "response.done") {
          if (event.response?.status && event.response.status !== "completed") return finish(new Error("voice_response_failed"));
          if (!byteCount) return finish(new Error("voice_empty_audio"));
          finish();
        }
      } catch { finish(new Error("voice_invalid_event")); }
    });
  });
  const seconds = byteCount / 48000;
  const normalize = (value) => value.toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]/gu, "");
  report.voice = { firstAudioMs, seconds, inputMessages: 1,
    estimatedUsd: seconds / 60 * 0.08 + 0.004,
    transcriptMatches: normalize(transcript) === normalize(expected), transcript };
  if (outputDir) {
    const pcm = Buffer.concat(chunks);
    const header = Buffer.alloc(44);
    header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4);
    header.write("WAVEfmt ", 8); header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
    header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28);
    header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
    header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, "grok-voice-synthetic.wav"), Buffer.concat([header, pcm]));
  }
}

try {
  if (!key) throw new Error("xai_key_missing");
  if (!voiceOnly) {
    const started = performance.now();
    const result = await api("responses", {
      model: "grok-4.7", reasoning: { effort: "medium" }, store: false,
      input: [{ role: "user", content: "Responda apenas com a palavra PRONTO." }],
      max_output_tokens: 1024,
    });
    const text = (result.output ?? []).flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("");
    report.text = { model: result.model, status: result.status,
      elapsedMs: Math.round(performance.now() - started),
      expectedAnswer: text.trim().replace(/[.!]+$/u, "") === "PRONTO",
      syntheticAnswer: text.slice(0, 160), usage: result.usage };
    if (!report.text.expectedAnswer) throw new Error("text_unexpected_answer");
  }
  if (!textOnly) await voice();
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = /^(upstream_http_\d+|voice_[a-z_]+|xai_key_missing|ephemeral_token_invalid|text_unexpected_answer)$/.test(error.message)
    ? error.message : "smoke_transport_failed";
  process.exitCode = 1;
} finally { emit(); }
