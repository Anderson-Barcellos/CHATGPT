# Dispatcher de Subagentes (Task Tool)

Despacha tarefas para subagentes seguindo regras estritas de segurança e modularidade.

## Regras Gerais — SEMPRE aplicar

### REGRA CRÍTICA: Uso Restrito

**QUANDO USAR SUBAGENTES:**
- APENAS para criar novos módulos isolados sem dependências
- APENAS para gerar código completamente novo em novos arquivos
- APENAS quando o código não interage com estruturas existentes

**QUANDO NÃO USAR SUBAGENTES:**
- NUNCA para editar arquivos existentes
- NUNCA para modificar código que tem dependências com outros módulos
- NUNCA para refatorações em código já existente
- NUNCA para correções de bugs em arquivos existentes
- NUNCA para git operations (commit, push, branch)

**RULE 0:** Subagentes só podem criar arquivos novos. Modificar qualquer arquivo existente através de subagente é uma VIOLAÇÃO CRÍTICA.

### Delegação permitida

Use subagentes SOMENTE para:
1. Criar novos utilitários isolados (ex: nova helper class sem dependências)
2. Gerar schemas/modelos de dados novos e independentes
3. Criar documentação nova que não referencia código existente
4. Implementar protótipos proof-of-concept isolados

### O agente principal DEVE fazer diretamente:
1. Qualquer edição em arquivos existentes
2. Modificações em features que interagem com o sistema atual
3. Refatorações que afetam múltiplos arquivos
4. Correções de bugs ou melhorias em código existente
5. Integrações com componentes/serviços já implementados (a "costura" final)

---

## Exceção: Criação em Lote (Adapter Pattern)

Quando o planejamento identificar **múltiplas etapas** que se beneficiem de paralelismo, subagentes PODEM ser usados em lote desde que **todas** as condições sejam atendidas:

1. **MODULARIDADE** — Cada tarefa produz um módulo isolado no estilo adapter pattern (interface clara, sem acoplamento lateral entre os módulos criados)
2. **CRIAÇÃO INDEPENDENTE** — O módulo novo PODE importar/usar dependências de módulos já prontos no projeto, mas a integração no sentido inverso (módulos existentes importando do novo) é PROIBIDA via subagente. A "costura" final é sempre responsabilidade do agente principal.
3. **MODELO** — Subagentes nesse modo DEVEM usar `claude-sonnet-4-5` como modelo (subagent_type: `general-purpose`)

---

## Formato de Retorno dos Subagentes

Todo prompt enviado ao subagente DEVE terminar com a seguinte instrução:

```
IMPORTANTE: Retorne APENAS no formato abaixo. Máximo 10 linhas, sem código inline, sem explicações.

STATUS: ok | error
FILES: lista de arquivos criados (paths absolutos)
EXPORTS: nomes exportados relevantes para integração (funções, tipos, componentes)
ERRORS: descrição curta se STATUS=error, senão "none"
NOTES: 1 linha opcional só se houver algo inesperado ou decisão de design relevante
```

**Regras do retorno:**
- Máximo 10 linhas totais — objetivo e neutro, sem explicações longas
- Sem código inline no retorno (o agente principal lê os arquivos se precisar)
- Sem opiniões, sugestões ou contexto extra — apenas fatos
- Se o subagente precisar reportar um problema, usar ERRORS + STATUS: error

---

## Validação Pós-Subagente

Após QUALQUER edição/criação por subagente, o agente principal DEVE:
1. Rodar typecheck (`npx tsc --noEmit` ou equivalente do projeto)
2. Se falhar, reverter a mudança do subagente e fazer diretamente
3. Só então prosseguir com a integração ("costura") nos arquivos existentes

---

## Instruções

Ao receber este comando, analise a tarefa atual e:

1. **Avalie** se a tarefa se encaixa nas regras acima
2. **Planeje** quais módulos podem ser despachados em paralelo
3. **Despache** os subagentes com prompts claros, incluindo o formato de retorno obrigatório
4. **Valide** com typecheck após receber os resultados
5. **Integre** os módulos nos arquivos existentes (costura manual pelo agente principal)

$ARGUMENTS - Descrição da tarefa a ser despachada para subagentes
