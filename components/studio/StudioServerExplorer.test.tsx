import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StudioServerExplorer } from "@/components/studio/StudioServerExplorer";
import { buildWorkspaceTreeRows } from "@/lib/studio/serverWorkspace";
import type { StudioWorkspaceTreeEntry } from "@/lib/studio/workspaceServerProtocol";

function treeEntry(
  path: string,
  kind: "file" | "directory",
  overrides: Partial<StudioWorkspaceTreeEntry> = {}
): StudioWorkspaceTreeEntry {
  return {
    path,
    name: path.split("/").at(-1) ?? path,
    kind,
    size: kind === "file" ? 10 : 0,
    editable: kind === "file",
    ...overrides,
  };
}

describe("StudioServerExplorer", () => {
  it("renders the server tree with lifecycle actions", () => {
    const markup = renderToStaticMarkup(
      <StudioServerExplorer
        tree={buildWorkspaceTreeRows([
          treeEntry("main.py", "file"),
          treeEntry("dados.bin", "file", { editable: false }),
          treeEntry("utils", "directory"),
          treeEntry("utils/helpers.py", "file"),
        ])}
        activeFilePath="main.py"
        busy={false}
        onOpenFile={vi.fn()}
        onOpenSettings={vi.fn()}
        onSaveProject={vi.fn()}
        onRestoreProject={vi.fn()}
        onImportProject={vi.fn()}
        onResetProject={vi.fn()}
      />
    );

    expect(markup).toContain("main.py");
    expect(markup).toContain("helpers.py");
    expect(markup).toContain("utils");
    expect(markup).toContain("Salvar projeto");
    expect(markup).toContain("Restaurar");
    expect(markup).toContain("Importar zip");
    expect(markup).toContain("Novo projeto");
    expect(markup).toContain("disabled");
    expect(markup).toContain('aria-current="page"');
  });

  it("renders refresh and rail-expand controls wired to their handlers", () => {
    const markup = renderToStaticMarkup(
      <StudioServerExplorer
        tree={buildWorkspaceTreeRows([treeEntry("main.py", "file")])}
        activeFilePath="main.py"
        busy={false}
        onOpenFile={vi.fn()}
        onOpenSettings={vi.fn()}
        onSaveProject={vi.fn()}
        onRestoreProject={vi.fn()}
        onImportProject={vi.fn()}
        onResetProject={vi.fn()}
        onRefreshTree={vi.fn()}
        onExpand={vi.fn()}
      />
    );

    expect(markup).toContain('aria-label="Atualizar arquivos"');
    expect(markup).toContain('aria-label="Abrir explorador"');
  });

  it("renders folders as toggle buttons and per-row delete controls", () => {
    const markup = renderToStaticMarkup(
      <StudioServerExplorer
        tree={buildWorkspaceTreeRows([
          treeEntry("main.py", "file"),
          treeEntry("utils", "directory"),
          treeEntry("utils/helpers.py", "file"),
        ])}
        activeFilePath="main.py"
        busy={false}
        selectedFolderPath="utils"
        onOpenFile={vi.fn()}
        onSelectFolder={vi.fn()}
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenSettings={vi.fn()}
        onSaveProject={vi.fn()}
        onRestoreProject={vi.fn()}
        onImportProject={vi.fn()}
        onResetProject={vi.fn()}
      />
    );

    expect(markup).toContain('aria-label="Novo arquivo"');
    expect(markup).toContain('aria-label="Nova pasta"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-label="Excluir utils"');
    expect(markup).toContain('aria-label="Excluir main.py"');
    // Pasta selecionada como destino de criação fica marcada.
    expect(markup).toContain('aria-pressed="true"');
  });

  it("shows an empty state when the workspace has no entries", () => {
    const markup = renderToStaticMarkup(
      <StudioServerExplorer
        tree={[]}
        activeFilePath={null}
        busy
        onOpenFile={vi.fn()}
        onOpenSettings={vi.fn()}
        onSaveProject={vi.fn()}
        onRestoreProject={vi.fn()}
        onImportProject={vi.fn()}
        onResetProject={vi.fn()}
      />
    );

    expect(markup).toContain("Workspace vazio.");
  });
});
