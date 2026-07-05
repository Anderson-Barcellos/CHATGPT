State:
- PDF A4 de documentos agora usa header compacto com icone OpenAI + titulo, fonte Lexend embutida e sem o bloco grande de metadados.
- `ArtifactPreviewSheet` removeu a acao de imprimir; ficam exportar PDF e baixar arquivo fonte.
- A arvore tambem contem ajustes acumulados de streaming, mobile composer, `chat-latest` aliases e titulos do Pulse que precisam entrar no commit de fechamento.

Next:
- Rodar validacao completa fresca, commitar/pushar para `origin/main`, e confirmar `git status --short --branch` limpo.

Context:
- Nao limpar dados runtime em `data/*.json`.
- Depois de build em producao, reiniciar `chatgpt.service` e checar `/chat/api/health` local/publico.
