// Run only in an isolated checkout with an explicitly supplied provider credential.
import assert from "node:assert/strict";
import { generatePersonalSynthesis } from "../lib/server/memory/personalSynthesis";

const sources = [
  { id: "profile:about", text: "Pessoa sintética: Ana. Prefere explicações em prosa, curtas e claras. Em 2024 não bebia café; não há informação atual. Não gosta de viagens aéreas. Mora em Recife, segundo este registro sem data." },
  { id: "profile:imported", text: "Registro sintético sem data: Ana mora em Porto Alegre. Não há evidência de qual registro é mais recente. Não inferir mudança de cidade." },
  { id: "memory:project", text: "Projeto sintético Jardim. Meta: plantar 12 árvores até dezembro de 2027. O orçamento de 300 reais é apenas uma hipótese, ainda não aprovado." },
  { id: "memory:detail", text: "Inventário técnico sintético: " + "O equipamento experimental tem etiqueta azul e precisa ser conferido antes do uso. ".repeat(60) + " Código específico: ZETA-743." },
];
async function main() {
const result = await generatePersonalSynthesis(sources);
const text = result.items.map(item => item.text).join("\n");
assert.ok(text.length <= 4000);
assert.match(text, /2024/);
assert.match(text, /2027/);
assert.match(text, /Recife/);
assert.match(text, /Porto Alegre/);
assert.match(text, /hip[oó]tese|hipot[eé]tic|não aprovado/i);
assert.match(text, /diverg|contradi|conflit|não.*(?:sabe|evidência|defin|atual)|sem.*(?:data|cronolog)/i);
console.log(JSON.stringify({ originalChars: sources.reduce((sum, source) => sum + source.text.length, 0), summaryChars: text.length, items: result.items, usage: result.usage }, null, 2));
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : "Synthetic synthesis smoke failed"); process.exitCode = 1; });
