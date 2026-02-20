# 📋 Auditoria de Arquivos e Módulos

Este documento apresenta um levantamento dos arquivos do projeto, categorizando-os por seu status de utilização atual.

**Legenda:**
- 🟢 **Em Uso Efetivo:** Arquivos vitais para o funcionamento atual da aplicação.
- 🟡 **Implementado, mas Não Usado:** Módulos funcionais, mas que não estão "plugados" no fluxo principal (podem ser exemplos, legados ou futuros recursos).
- 🔴 **Descartável/Legado:** Arquivos de backup, testes manuais antigos ou código morto claro.

---

## 📂 Core (`app/`, `components/layout`)

| Arquivo | Status | Observação |
| :--- | :---: | :--- |
| `app/page.tsx` | 🟢 | Ponto de entrada principal. Renderiza `ChatShell`. |
| `app/layout.tsx` | 🟢 | Layout global (fontes, providers). |
| `components/layout/ChatShell.tsx` | 🟢 | Shell principal da aplicação (usa `SidebarModern`). |
| `components/layout/ChatShellModern.tsx.backup` | 🔴 | **Backup explícito**. Deve ser removido ou arquivado. |

## 📂 Sidebar e Navegação

| Arquivo | Status | Observação |
| :--- | :---: | :--- |
| `components/sidebar/SidebarModern.tsx` | 🟢 | A barra lateral ativa atual. |
| `components/sidebar/Sidebar.tsx` | 🟡 | Versão antiga/simples. Aparentemente substituída pela `Modern`. Só referenciada pelo backup. |

## 📂 Canvas e Editores (`components/canvas`)

| Arquivo | Status | Observação |
| :--- | :---: | :--- |
| `CanvasContainer.tsx` | 🟢 | Container principal da área de canvas. |
| `SimpleCodeEditor.tsx` | 🟢 | Usado via `lazy.tsx` (provavelmente fallback ou versão leve). |
| `MonacoEditor.tsx` | 🟢 | Editor principal (identificado no fluxo de uso de canvas). |
| `CodeEditorExample.tsx` | 🟡 | Componente de exemplo. Não parece estar em uso na UI principal. |
| `DiffViewerExample.tsx` | 🟡 | Componente de exemplo/teste de diff. |
| `DiffViewer.tsx` | 🟢 | Implementação funcional do visualizador de Diff. |

## 📂 Infraestrutura e Bibliotecas (`lib/`)

| Arquivo | Status | Observação |
| :--- | :---: | :--- |
| `lib/monitoring/telemetry.ts` | 🟢 | **Ativo.** Usado em `rateLimitEnhanced` e `resilient-storage`. |
| `lib/storage/resilient-storage.ts` | 🟢 | Camada de dados robusta, em uso. |
| `lib/performance/lazy.tsx` | 🟢 | Usado para carregar componentes pesados (ex: editores). |
| `lib/performance/virtualList.tsx` | 🟡 | Implementação de lista virtual. Verificar se está sendo usada no `MessageList` (potencial otimização inativa). |
| `lib/export/*.ts` | 🟢 | Módulos de exportação (PDF, JSON, MD) conectados aos hooks. |

## 📂 Hooks

| Arquivo | Status | Observação |
| :--- | :---: | :--- |
| `hooks/useChat.ts` | 🟢 | Hook central de lógica do chat. |
| `hooks/useMemories.ts` | 🟢 | Gerenciamento de memória de longo prazo. |
| `hooks/queries/*.ts` | 🟢 | Integração com React Query (cache e data fetching). |

---

## 📊 Resumo e Recomendações

1.  **Limpeza Imediata:**
    *   O arquivo `components/layout/ChatShellModern.tsx.backup` pode ser excluído com segurança.

2.  **Revisão de Legado:**
    *   `components/sidebar/Sidebar.tsx`: Se a `SidebarModern` é a definitiva, a antiga deve ser removida para evitar confusão.

3.  **Componentes de Exemplo:**
    *   `CodeEditorExample.tsx` e `DiffViewerExample.tsx` devem ser movidos para uma pasta de `_examples` ou `stories` (se usar Storybook), ou removidos se já cumpriram seu propósito de referência.

4.  **Otimizações Potenciais:**
    *   Verificar se `virtualList.tsx` está aplicado nas listas de mensagens longas. Se não estiver, é uma "implementação não usada" que deveria se tornar "Em Uso" para melhorar performance.
