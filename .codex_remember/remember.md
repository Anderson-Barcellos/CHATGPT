State:
- Gaucho Studio é Python-only em `/chat/studio`, com workspace contínuo em `/root/studio-projects/active/`, step-up auth e execução sandboxed via systemd.
- Monaco, run com stdin, terminal PTY, preview Markdown e notebook `.ipynb` com ipykernel persistente estão integrados em `main` e documentados.
- Explorer cria arquivos/pastas, seleciona e recolhe pastas, atualiza a árvore e exclui com confirmação; rename permanece apenas no backend.
- Assistente lateral continua somente leitura (`store=false`, `tools=[]`); FIM DeepSeek exige aceitação explícita.
- Dados runtime privados em `data/*.json` e o workspace real do Anders não devem ser usados como fixtures nem limpos.

Next:
- Nenhum PACK ativo. Anders revisa o Studio atual e escolhe a próxima frente.
- Se rename virar prioridade, desenhar apenas a ação de UI sobre a rota já existente.

Context:
- Template versionado fica em `templates/studio-python/`; "Novo projeto" reseta o workspace real a partir dele.
- `/etc/apache2/APACHE.md` é obrigatório antes de mudanças de rota/cookie; `ProxyPassReverseCookiePath` fica dentro de `<Location /chat>`.
- Monaco mantém dois warnings de fallback do language worker, sem falha funcional conhecida.
- Advisory conhecido: `pdfjs-dist` GHSA-hq66-cqwq-w95j; correção exige major 6.x.
