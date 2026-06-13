# BACKLOG

### 2026-06-11 17:46 - Shell mobile mais expansivo

Context:
Rodada focada em aproximar a sensação de app full-screen do workspace mobile sem redesenhar o produto nem mexer na lógica de PWA.

Details:
`components/workspace-v2/WorkspaceLayoutV2.tsx` foi ajustado para reduzir a moldura visual no mobile, afinar header/subheader, compactar controles do topo e deixar o sheet contextual direito full-bleed em telas pequenas. `app/globals.css` recebeu novos tokens mobile para diminuir padding externo, raio do shell e altura ocupada por header/composer.

Notes:
Validação executada: `git diff --check`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, `curl http://127.0.0.1:3040/chat/api/health`. Se ainda faltar sensação de app, o próximo passo mais promissor é QA visual real em iPhone/Safari para micro-ajustar header e composer, não a camada PWA.

### 2026-06-11 18:02 - Settings full-screen no mobile

Context:
A foto do iPhone mostrou que, mesmo após o shell mobile ficar mais expansivo, o painel de Configurações ainda abria como drawer lateral estreito e deixava uma faixa do chat visível atrás.

Details:
`components/settings/SettingsDrawer.tsx` agora usa largura full-screen no mobile, sem borda lateral e sem sombra de drawer, mantendo o painel lateral compacto em `sm+`. O topo do painel foi afinado para ocupar menos altura e combinar com o shell mobile.

Notes:
Validação executada: `git diff --check`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, health local `healthy` e health público HTTP 200. A barra/pílula do domínio no Safari ainda pertence ao navegador; esta rodada corrige a parte interna do app.
