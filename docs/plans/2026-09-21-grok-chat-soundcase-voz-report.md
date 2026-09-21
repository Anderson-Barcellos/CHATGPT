# Relatório da frente VOZ — 2026-09-21

## Resultado observável

O SoundCase mantém o Realtime OpenAI como padrão. Nas configurações da própria superfície, a pessoa pode escolher **Grok Realtime experimental**, selecionar a voz xAI (inicialmente `eve`) e ajustar a velocidade entre `0.7x` e `1.5x` (inicialmente `1.0x`). A escolha não altera as preferências de direção/arquivo do SoundCase nem o TTS OpenAI.

Ao iniciar a leitura de uma versão salva, o navegador lê primeiro o snapshot imutável autenticado. Só então solicita uma sessão temporária autenticada e abre `wss://api.x.ai/v1/realtime?model=grok-voice-latest` com o subprotocolo efêmero. A sessão envia turnos manuais, sem microfone, com instrução de ler apenas o texto fornecido. Áudio PCM de 24 kHz é reproduzido em Web Audio; parar, trocar de engine, trocar de versão ou desmontar invalida a geração de áudio, cancela/fecha a sessão e limpa a fila local. Fechar o painel preserva a sessão e a barra de controle; sair do produto desmonta o provider e encerra a leitura.

## DECISÃO: preferências e conexão isoladas

As preferências Grok vivem em `gaucho-soundcase:grok-realtime:v1`, separadas de `gaucho-soundcase:settings:v1`. Motivo: as configurações existentes alimentam a geração de direção e o arquivo TTS persistido; a escolha experimental só controla a leitura ao vivo. A validação cobre normalização de velocidade e a interação existente confirma que o caminho OpenAI continua recebendo somente as configurações de geração.

O helper server aceita `XAI_API_KEY` e, por compatibilidade operacional, `GROK_API_KEY`; o primeiro tem precedência. A chave nunca aparece no payload do navegador. A rota de token exige autenticação, UUIDs válidos, versão pertencente ao projeto e direção persistida antes do mint. Os retornos de token e vozes usam `Cache-Control: private, no-store`.

## Arquivos e contratos

- `lib/server/soundcase/grokRealtime.ts` e `app/api/soundcase/grok-realtime/{session,voices}`: adaptador xAI server-only, token de 300 segundos, lista de vozes e validação de sessão.
- `hooks/useSoundCaseGrokRealtime.ts` e `lib/soundcase/grokRealtimeAudio.ts`: WebSocket efêmero, turnos manuais, cerca de ciclo de vida e fila PCM em Web Audio.
- `hooks/useSoundCaseGrokSettings.ts` e `components/soundcase/SoundCaseGrokRealtimeSettings.tsx`: preferências locais e seletor acessível de engine/voz/velocidade.
- `components/soundcase/SoundCaseRealtimeProvider.tsx`, `SoundCaseWorkspace.tsx` e `SoundCaseRealtimeBar.tsx`: coexistência de uma sessão por engine, exclusão mútua ao trocar fonte e barra persistente para ambas.

Não houve remoção, substituição ou import retirado de TTS, worker, arquivos ou Realtime OpenAI. O caminho existente permanece o default; Grok é uma opção explícita do SoundCase.

## Validação

Comando executado:

```bash
npm test -- hooks/useSoundCaseGrokRealtime.test.tsx app/api/soundcase/grok-realtime/routes.test.ts lib/server/soundcase/grokRealtime.test.ts lib/soundcase/grokRealtimeAudio.test.ts hooks/useSoundCaseGrokSettings.test.ts components/soundcase/SoundCaseWorkspace.interaction.test.tsx components/soundcase/SoundCaseRealtimeBar.test.tsx components/soundcase/SoundCaseRealtimeProvider.test.tsx
```

Resultado final: código de saída `0`; 8 arquivos de teste, 29 testes aprovados, 0 falhas e 0 skips. Cobertura focada: autenticação antes de mint/listagem, projeto/versão/direção, token de 300 s e alias de ambiente, indisponibilidade de credencial sem chamada externa, cancelamento da requisição upstream, `no-store`, formato oficial `voices[].voice_id`, PCM little-endian, preferências separadas, token WebSocket/subprotocolo, `turn_detection: null`, texto do snapshot, cancelamento diante de resposta tardia, socket aberto sem `session.updated`, encerramento depois de drenar áudio, desconexão inicial, salto de segmento com `AudioContext` preparado antes da nova requisição, lifecycle da barra/provider e integração do acervo.

A rodada anterior de 27 testes não cobria o formato documentado de catálogo, o timeout entre `open` e `session.updated` nem a preservação do gesto de áudio no salto. Esses pontos foram corrigidos antes deste resultado final e têm testes causais na rodada de 29.

Também foram executados `npx tsc --noEmit` e `git diff --check`, ambos com código de saída `0`.

O principal realizou um smoke real autorizado separado antes da conclusão desta frente: 28 vozes, token/WebSocket efêmero, `eve`, `turn_detection: null`, PCM 24 kHz, velocidade 1.15x, primeiro áudio em 2029 ms, 6,852 s de áudio e transcrição portuguesa fiel. Essa evidência está em `/root/.cache/grok-chat-soundcase-qa` e não foi repetida nesta frente para evitar custo.

Gates completos, TypeScript, lint, build e QA visual integrado ficam para a coordenação sequencial do principal. Não há bloqueio de implementação nesta frente.

## Sequência para QA integrado

1. Abrir uma versão salva no Acervo que tenha `direction` persistida e `source.txt` válido; o fixture mínimo é uma versão UUID ligada a um projeto UUID, texto curto no endpoint `.../source` e `effectiveSettings`/`direction` não nulos.
2. Abrir **Configurações do Soundcase**, selecionar **Grok Realtime experimental**, manter `eve`/1.0x ou selecionar uma voz retornada por `GET /api/soundcase/grok-realtime/voices`.
3. Expandir a versão e usar **Ouvir com Realtime**. Confirmar que não surgiu job/versão nova, que a barra permanece ao fechar o painel e que **Parar leitura** silencia a fonte.
4. Enquanto lê, trocar para Realtime OpenAI ou escolher outra versão; confirmar que não há sobreposição. Retornar ao Grok e iniciar explicitamente outra vez para validar retry.
