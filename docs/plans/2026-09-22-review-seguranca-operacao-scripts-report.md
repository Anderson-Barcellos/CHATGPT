# Frente scripts — review de segurança e operação

**Status:** pronta para revisão independente, sem publicação.

As ferramentas operacionais agora recusam o checkout que o `chatgpt.service` usa ao vivo antes de abrir gates, criar build ou consultar a porta. O QA local exige porta explícita e inicia somente em loopback com `GAUCHO_ISOLATED_RUNTIME=true`; um build com falha não chega ao `npm start`. O timer do Pulse exige token antes de qualquer tentativa de rede e o passa ao `curl` por stdin, sem incluí-lo nos argumentos. A unit versionada não mata mais o processo que já ocupa a porta 3040.

## Alterações

- `scripts/lib/runtime-safety.sh`: helper novo que resolve caminhos canônicos e compara o projeto com o `WorkingDirectory` obtido de `systemctl show chatgpt.service`.
- `scripts/pre-deploy.sh`: substituído o checklist que lia `.env`, instalava dependências e removia `.next` por gates estritos no checkout isolado. Gera `next-env.d.ts` com `npx --no-install next typegen` antes do `tsc`; argumentos desconhecidos falham, e `--skip-build` continua executando os demais gates sem certificar entrega.
- `scripts/test-local.sh`: substituído o caminho fixo de produção por resolução do diretório do script; requer `--port`, normaliza-a em base 10, falha fechada se não conseguir verificá-la e sobe `next start` com `--hostname 127.0.0.1`.
- `scripts/run-pulse-due.sh`: `PULSE_RUNNER_TOKEN` ausente falha antes do `curl`; o cabeçalho usa `-H @-` com stdin.
- `systemd/chatgpt.service`: removido o `ExecStartPre` que executava `fuser -k 3040/tcp`.
- `scripts/operational-safety.test.ts`: testes de processo com executores falsos e diretórios temporários, sem rede, dados runtime ou credenciais.

**DECISÃO:** a fonte de verdade para identificar o checkout de produção é o `WorkingDirectory` da unit em execução, e não o nome da branch nem um caminho escrito no script. A comparação usa `pwd -P` nos dois lados para que um symlink não contorne a recusa. Se o `systemctl` não puder fornecer um diretório válido, a ferramenta falha fechada; não é seguro assumir isolamento.

**DECISÃO:** `pre-deploy.sh` usa o binário `node_modules/.bin/tsc` e gera antes os tipos que o Next mantém ignorados pelo Git com `npx --no-install next typegen`. A flag obriga o `next` já instalado no checkout e impede download ou instalação automática durante o gate. As variáveis `GAUCHO_*_BIN` existem somente como seams dos testes sintéticos.

## Validação

| Comando | Resultado |
| --- | --- |
| `npx vitest --run scripts/operational-safety.test.ts` | primeira execução: exit 1, o parâmetro TypeScript chamado `arguments` era inválido em strict mode; após renomeá-lo e tipar o `ProcessEnv`, execução final exit 0, 1 arquivo e 13 testes aprovados. O harness prova que `next typegen` precede o `tsc` e que sua falha interrompe os gates. Evidência: `/root/.cache/gaucho-review-20260922/scripts-vitest.log`. |
| `bash -n scripts/pre-deploy.sh scripts/test-local.sh scripts/run-pulse-due.sh scripts/lib/runtime-safety.sh` | exit 0. Evidência: `/root/.cache/gaucho-review-20260922/scripts-bash-n.log`. |
| `systemd-analyze verify systemd/chatgpt.service` | exit 0, sem instalar ou reiniciar a unit. Evidência: `/root/.cache/gaucho-review-20260922/scripts-systemd-verify.log`. |
| `git diff --check` | exit 0. Evidência: `/root/.cache/gaucho-review-20260922/scripts-diff-check.log`. |

Os gates globais (`npm test`, tipos, lint e build isolado) não foram repetidos nesta frente: pertencem à validação sequencial do conjunto estabilizado pelo orquestrador. Não houve build, deploy, restart, alteração de proxy, leitura de `.env` real ou acesso a dados runtime nesta frente.

## Substituições e impactos

O antigo `pre-deploy.sh` foi substituído porque continha mutações incompatíveis com a validação segura (`npm install` e remoção de `.next`); seus gates observáveis permanecem, agora com saída imediata na primeira falha. O antigo `test-local.sh` foi substituído porque mudava para `/root/CHATGPT` e usava a porta produtiva; seu fluxo de build seguido de start permanece, limitado a checkout e porta isolados. O `ExecStartPre` removido apenas matava o ocupante da porta; o `ExecStart`, a porta 3040, `/chat`, o `EnvironmentFile` e o timer do Pulse foram preservados.

Não há bloqueio conhecido nesta frente. A integração ainda precisa considerar a unit/drop-in de ownership que pertence ao orquestrador.
