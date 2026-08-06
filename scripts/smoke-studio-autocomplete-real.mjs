import OpenAI from "openai";

const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
if (!apiKey) {
  throw new Error("DEEPSEEK_API_KEY is required");
}

const client = new OpenAI({
  apiKey,
  baseURL: "https://api.deepseek.com/beta",
  maxRetries: 0,
  logLevel: "off",
});
const response = await client.completions.create({
  model: "deepseek-v4-pro",
  prompt: "function soma(a: number, b: number) {\n  return ",
  suffix: ";\n}",
  max_tokens: 32,
  temperature: 0.1,
});
const choice = response.choices[0];

if (!choice?.text || choice.finish_reason !== "stop") {
  throw new Error(
    `FIM smoke failed with finish_reason=${choice?.finish_reason ?? "missing"}`
  );
}

console.log("DeepSeek FIM contract smoke: OK");
