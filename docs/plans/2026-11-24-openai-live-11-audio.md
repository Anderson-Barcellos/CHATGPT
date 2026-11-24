# OpenAI Live 1.1 no ditado, nas mensagens e no SoundCase

## Recorte aprovado

O ditado médico de `/stt` usa o Live 1.1 como caminho principal. Chat e notas do Gaúcho preservam o ditado atual. Nos balões de mensagens e na leitura ao vivo do SoundCase, o Live entra como opção ao lado do Grok. Geração e download do arquivo final do SoundCase mantêm o fluxo atual.

O protótipo fica em um Site do ChatGPT e seu código não estava disponível nesta sessão. A implementação segue a API GPT-Live.

## Entregas e aceite

- **STT** mantém o protocolo navegador–servidor e troca a conexão com o provedor pela API GPT-Live. Mostra a transcrição do microfone enquanto recebe áudio e espera o encerramento normal antes de incorporar o texto. Erro ou finalização incompleta encaminha a gravação de segurança ao fallback atual. A comparação mede a primeira prévia e o texto final, além de conferir palavras finais, medidas e lateralidade.
- **Gaúcho Chat** oferece o motor Live no mini player das mensagens e no seletor de leitura do SoundCase. Os dois enviam texto em trechos à mesma rota autenticada. A voz inicial é Marin, e o servidor compara a transcrição falada antes de liberar o PCM. Parar, trocar de motor e desmontar cancelam a leitura. O provedor do SoundCase mantém a sessão ao fechar o painel.
- **Validação** usa `/root/worktrees/gaucho-live-11` e `/root/worktrees/stt-live-11` com dados sintéticos. Executar suítes, tipos, builds, lint do Gaúcho e Chrome desktop/mobile. As evidências ficam em `/root/.cache/live-11-validation` e os resultados, nos BACKLOGs. Publicação fica para operação autorizada.
