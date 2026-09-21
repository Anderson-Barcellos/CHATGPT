# Grok 4.7 e voz Realtime no SoundCase

## 1. Entrevista e objetivo

Substituir todos os usos ativos do GPT-5.4 mini por Grok 4.7 com reasoning medium e experimentar texto → voz Grok Realtime somente no SoundCase.

### 1.1 Aprovação vinculante

Anders confirmou substituir todos os usos (chat, Documento, Deepsearch médio, Pulse, Studio e extrações internas), preservando Luna como default do chat. Escolheu Realtime para voz, mantendo TTS OpenAI. Em 2026-09-21 autorizou: “Implement the proposed plan.”

| Decisão | Contrato |
|---|---|
| Modelo | grok-4.7, reasoning medium fixo também no servidor |
| Voz | Grok Realtime experimental, sem microfone, escolha explícita no SoundCase |
| Áudio atual | TTS, arquivos e Realtime OpenAI preservados |
| Produção | Worktree isolada; sem merge, push, deploy ou restart |
| Histórico | Não reescrever dados privados; resolver identificadores antigos nas leituras/execuções |

Fica fora: TTS xAI, clonagem, microfone, voz xAI no chat/Pulse, alterações em outros modelos.

## Modelos de texto — substituição integrada

Objetivo: todos os usos ativos do mini executam Grok sem perder os contratos do produto.

Escopo por arquivo: lib/models/modelConfig.ts, types/*, lib/server/chatRequest.ts e adaptador xAI novo, app/api/chat/**, hooks/useChat.ts, lib/chat/deepsearchConfig.ts, lib/pulse/**, lib/calendar/naturalLanguageDraft.ts, lib/studio/models.ts, lib/server/studioAssistant.ts, seletores/store e testes correspondentes.

Contratos: provider server-side xAI na Responses API; medium fixo; streaming, abort, histórico, tokens, citações, memória, saída estruturada e código conforme capacidades. Mini vira alias legado para Grok, sem migração de dados. Imagens continuam OpenAI por chamada separada. Studio continua somente leitura, web apenas no painel; FIM preservado. Erros explícitos sem fallback silencioso.

Background: xAI não implementa background=true. Executar no servidor independente do browser, persistir job/provider, sincronizar pelas rotas atuais, cancelar chamada ativa e impedir publicação tardia. Reinício interrompe de forma recuperável sem repetir chamada cobrada automaticamente. Jobs OpenAI existentes preservados.

Dependências: cliente/provider e normalização antes de consumidores. Testes internos: aliases, parâmetros, ferramentas, fluxo/background e falhas. Testes externos: chat, Documento/Deepsearch após reabrir aba, Pulse com imagem/citações e Studio. Evidência de pronto: nenhum uso ativo do mini, exceto compatibilidade e histórico.

Preservar: Luna default, outros providers/modelos, Quiz, Deepsearch alto, dados privados, permissões de ferramentas e contratos visuais.

## SoundCase — leitura Realtime experimental

Objetivo: selecionar Grok Realtime e ouvir texto de uma versão sem microfone.

Escopo por arquivo: components/soundcase/**, hooks/useSoundCaseRealtime.ts e adaptador xAI novo, hooks/useSoundCaseSettings.ts, lib/soundcase/*, app/api/soundcase/* (rotas novas de sessão/vozes), testes correspondentes.

Contratos: opção explícita Grok Realtime experimental; engine atual default; vozes xAI independentes; eve e 1.0x inicial, ajuste 0.7–1.5x. Token efêmero via rota autenticada com projeto/versão válidos, no-store. Browser WebSocket com token temporário, Web Audio para PCM; chave permanente server-only. Leitura fiel em turnos manuais, sem microfone. Snapshot imutável; não criar job/versão por replay. Fence contra áudio tardio; parar/trocar segmento/engine encerra anterior. Painel fechado mantém sessão/barra; sair encerra. Erro encerra e retry explícito.

Dependências: somente credencial XAI_API_KEY compartilhada com texto. Testes internos: auth, chave/token, desconexão, cancelamento, versão/segmento, lifecycle e preferências. Externos: Chrome desktop/mobile e smoke sintético de até 2 minutos totais xAI. Evidência: ouvir, parar, trocar segmento e voltar OpenAI sem sobreposição.

Preservar: TTS/worker/arquivos/Realtime OpenAI, snapshots, configurações existentes, demais players.

## Integração e validação

Responsabilidades: principal cuida de Git, documentação, instrumentation.ts/isolar boot de QA, instalações, gates pesados, integração/revisão. Implementador texto é dono de todos os módulos de texto acima; implementador voz é dono de todos os módulos SoundCase acima. Nenhum arquivo compartilhado é editado em paralelo. Ambos não editam docs canônicas/package/instrumentation.

Gates sequenciais: npm test, npx tsc --noEmit, npm run lint, NEXT_PUBLIC_BASE_PATH=/chat npm run build; Playwright frontend desktop/mobile. Fixtures sintéticas e diretórios temporários, sem dados privados. Boot QA deve evitar cleanup de units Studio de produção. Smoke real curto: uma chamada Grok e até dois minutos de voz, com custo/latência/fidelidade registrados. Credencial só por mecanismo seguro, sem exibir valores; bashrc não implica disponibilidade no systemd.

Pontos de parada: indisponibilidade do modelo/credencial, incompatibilidade que altere contrato, gate obrigatório bloqueado, QA sem isolamento seguro. Registrar BLOCKED e seguir somente partes independentes.

Registro técnico: docs/plans/2026-09-21-grok-chat-soundcase-report.md; relatórios de frentes com sufixos -texto-report.md e -voz-report.md. Atualizar API, arquitetura, modelos, infraestrutura, BACKLOG e diário ao fechar. Avaliação subjetiva da voz fica com Anders. Pronta para revisão somente após gates/revisão; publicação separada.
