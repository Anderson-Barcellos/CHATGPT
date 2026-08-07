# Workspace Python do Gaucho Studio

Este é o projeto contínuo do Studio. Ele vive no servidor e roda num sandbox
com rede liberada e `OPENAI_API_KEY` no ambiente.

- **Run** executa o arquivo ativo com o Python do venv base.
- Imports locais funcionam (`from utils.helpers import ...`).
- Arquivos criados pelo script (logs, saídas) aparecem na árvore após o run.
- **Salvar projeto** baixa um zip e arquiva no servidor; **Novo projeto**
  restaura este template.

Pacotes do venv base: openai, httpx, rich, python-dotenv.
