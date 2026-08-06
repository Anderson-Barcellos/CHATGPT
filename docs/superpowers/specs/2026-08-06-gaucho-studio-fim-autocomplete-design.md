# Gaucho Studio FIM Autocomplete Design

**Status:** aprovado em conversa; aguardando revisão do documento por Anders
**Data:** 2026-08-06
**Escopo:** autocomplete inline para scripts TypeScript e JavaScript no Gaucho Studio desktop

## Objetivo

Adicionar autocomplete automático ao Monaco do Gaucho Studio usando o endpoint
FIM do DeepSeek. A sugestão aparece como ghost text nativo e só altera o arquivo
quando Anders a aceita com `Tab`.

O recurso não transforma o chat lateral em agente, não aplica patches e não
introduz execução multifile. Chat, runner, autosave e autocomplete permanecem
subsistemas independentes.

## Decisões aprovadas

- Usar `monaco.languages.registerInlineCompletionsProvider`, sem overlay próprio.
- Disparar automaticamente após 450 ms sem interação.
- Manter o recurso ligado por padrão no desktop, com controle visível e preferência local persistida.
- Restringir a primeira versão a TypeScript e JavaScript.
- Desativar o provider e as chamadas em mobile ou dispositivo sem ponteiro fino.
- Enviar o arquivo inteiro quando tiver até 32 mil caracteres.
- Acima de 32 mil caracteres, enviar até 24 mil caracteres antes e 8 mil depois do cursor.
- Usar `deepseek-v4-pro` fixo no endpoint FIM Beta, sem reasoning.
- Permitir sugestões adaptativas, de uma expressão até um bloco curto, com teto de 256 tokens.
- Aceitar a sugestão inteira com `Tab`; `Esc`, digitação, seleção, movimento do cursor ou troca de arquivo descartam o resultado.
- Após um aceite, permitir nova sugestão encadeada depois de outros 450 ms.
- Tratar falhas silenciosamente, sem toast e sem afetar chat, runner ou autosave.

## Arquitetura

### Provider do Monaco

O provider vive em um módulo cliente focado e é registrado quando o
`StudioEditor` monta. Ele recebe o modelo e a posição diretamente do Monaco,
monta o contexto, coordena debounce/cancelamento e converte uma resposta válida
em `InlineCompletion`.

O provider usa os contratos disponíveis no Monaco 0.55.1:

- `debounceDelayMs: 450` para o atraso automático;
- `CancellationToken` para interromper trabalho obsoleto;
- `InlineCompletion.command` para reagir ao aceite completo;
- `disposeInlineCompletions` para liberar recursos;
- `onDidCompositionStart` e `onDidCompositionEnd` para não sugerir durante IME;
- ghost text, `Tab`, `Esc` e undo nativos do editor.

O comando associado ao item aceito solicita uma nova avaliação. O coordenador
elimina duplicidade caso o próprio evento de alteração do Monaco já tenha
agendado a mesma continuação.

### Coordenador cliente

Um módulo puro concentra regras que não dependem da UI:

- elegibilidade por linguagem, seleção, composição, desktop e preferência;
- divisão de prefixo e sufixo;
- janela 24k/8k para arquivos grandes;
- chave da solicitação por URI, versão do documento, posição e hash do contexto;
- normalização e filtragem da resposta;
- contagem de falhas e cooldown.

Somente uma requisição pode permanecer ativa. Uma nova posição, versão,
seleção, aba ou preferência aborta a anterior. O resultado só é devolvido se a
chave atual ainda coincidir integralmente com a chave que originou o request.

### Rota backend

`POST /api/studio/autocomplete` é uma rota autenticada e separada do chat
lateral. Ela valida o body, aplica rate limit próprio e usa a
`DEEPSEEK_API_KEY` já configurada no servidor.

O adapter FIM usa um cliente OpenAI-compatible exclusivo com:

- `baseURL: https://api.deepseek.com/beta`;
- endpoint `/completions` não streaming;
- `model: deepseek-v4-pro`;
- `prompt` e `suffix` recebidos do cliente;
- `max_tokens: 256`;
- `temperature: 0.1`;
- nenhum campo de reasoning, thinking, tool ou histórico.

A rota retorna somente a conclusão, o `finish_reason` e metadados mínimos de
uso necessários para diagnóstico. Código, prompt e resposta não entram em logs.

## Contrato de dados

### Request do navegador

```ts
interface StudioAutocompleteRequest {
  filePath: string;
  language: "typescript" | "javascript";
  prefix: string;
  suffix: string;
}
```

`prefix.length + suffix.length` nunca ultrapassa 32 mil caracteres. O backend
também impõe esse limite, restringe o caminho a 320 caracteres e rejeita tipos
ou campos desconhecidos.

### Response do backend

```ts
interface StudioAutocompleteResponse {
  completion: string;
  finishReason: "stop" | "length" | "content_filter" | "insufficient_system_resource";
}
```

Somente `finishReason: "stop"` pode produzir ghost text. Os demais estados são
tratados como ausência de sugestão.

## Fluxo de interação

1. Anders digita, cola conteúdo ou aceita uma sugestão.
2. O Monaco aguarda 450 ms e chama o provider.
3. O provider confirma desktop, foco, linguagem permitida, seleção vazia e ausência de composição.
4. O contexto é dividido no cursor e enviado à rota autenticada.
5. Qualquer alteração posterior cancela ou invalida o request.
6. A resposta válida aparece como ghost text.
7. `Tab` insere o texto numa operação de undo; `Esc` ou qualquer nova interação descarta.
8. Depois do aceite, outra avaliação pode ocorrer após 450 ms.

Sugestões multilinha só são expostas quando o cursor está no fim da linha,
respeitando o contrato de ranges do Monaco. No meio da linha, o cliente usa
somente a primeira linha não vazia da conclusão. O provider nunca substitui
silenciosamente texto existente depois do cursor.

## Interface e estados

O topo do Studio mostra um controle discreto próximo a “Execução local” e
“Salvo”:

- `Autocomplete`: ligado e ocioso;
- pulso azul: request em andamento;
- estado âmbar: cooldown temporário;
- desligado: provider inativo e requests cancelados.

O controle persiste `autocompleteEnabled` no snapshot local do Studio. Snapshots
antigos sem o campo normalizam para `true`, sem alterar a versão 1 nem o código
salvo. No mobile o controle fica oculto e a preferência não provoca chamadas.

## Erros, cancelamento e contenção

- Erros não geram toast nem alteram o conteúdo do editor.
- `429` respeita `Retry-After`.
- Três falhas consecutivas iniciam cooldown de 30 segundos.
- Uma resposta bem-sucedida zera falhas e cooldown.
- Timeout cliente de 8 segundos encerra requests que perderam valor interativo.
- Desligar o recurso aborta o request e limpa o ghost text imediatamente.
- A rota usa `RATE_LIMIT_STUDIO_AUTOCOMPLETE_RPM`, com padrão de 180 requests por minuto por identificador.
- Body, prefixo, sufixo, linguagem e autenticação são validados novamente no servidor.

## Limites conscientes da primeira versão

- Sem Python, JSON, Markdown ou plaintext.
- Sem mobile ou botão de aceite touch.
- Sem contexto de outros arquivos ou resolução de imports.
- Sem streaming progressivo da conclusão.
- Sem escolha de modelo ou configuração de prompt pelo usuário.
- Sem telemetria de conteúdo, edição automática ou integração com o chat lateral.

Python fica reservado para uma expansão própria, pois autocomplete da linguagem
e execução Python possuem contratos diferentes. A execução poderá exigir
Pyodide no navegador ou um runner server-side isolado.

## Estratégia de testes

### Testes unitários

- Arquivo até 32 mil caracteres usa contexto completo.
- Arquivo maior usa 24k de prefixo e 8k de sufixo.
- Mudança de versão, URI, posição ou hash invalida a resposta.
- Seleção, composição, mobile, preferência desligada e linguagem não permitida bloqueiam chamadas.
- Fences Markdown, resposta vazia e `finishReason` diferente de `stop` são descartados.
- Multilinha no fim da linha é preservada; no meio da linha é reduzida à primeira linha.
- Três falhas iniciam cooldown; sucesso posterior restaura o provider.

### Testes do servidor

- Parser rejeita body, tamanho, caminho ou linguagem inválidos.
- Adapter usa base URL Beta, `deepseek-v4-pro`, FIM, 256 tokens e nenhum reasoning.
- Rota exige autenticação, aplica rate limit e não retorna detalhes sensíveis de upstream.
- Abort e timeout encerram a chamada DeepSeek.

### Testes de integração no Monaco

- Ghost text aparece depois do debounce.
- `Tab` insere o retorno e undo remove tudo numa operação.
- `Esc`, digitação, movimento do cursor e troca de arquivo descartam a sugestão.
- Resposta atrasada de request antigo nunca aparece.
- Aceite agenda continuação encadeada.
- Mobile não registra request para a API.

### Validação final

- Testes focados RED/GREEN para cada comportamento.
- Suíte completa, TypeScript, ESLint e build Next.
- `git diff --check` e `npm audit --omit=dev`.
- Restart de `chatgpt.service` e health local/público.
- Smoke autenticado com mock determinístico para interação do Monaco.
- Smoke real curto contra DeepSeek para confirmar o contrato FIM sem expor código ou chave.

## Critérios de aceite

- Um script TypeScript/JavaScript no desktop recebe ghost text automático após 450 ms.
- Nenhuma alteração ocorre antes de `Tab`.
- Aceite, descarte, undo e encadeamento funcionam no Monaco real.
- Resultado obsoleto nunca aparece após mudança de documento ou cursor.
- Erros do DeepSeek permanecem silenciosos e não afetam os demais fluxos.
- Mobile e linguagens fora do escopo não chamam a rota.
- A chave DeepSeek não aparece no cliente; o conteúdo enviado não aparece em logs, diff ou respostas de erro.
