import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CommandComposerV2,
  WorkspaceFrameV2,
} from "@/components/workspace-v2/WorkspaceLayoutV2";

describe("WorkspaceFrameV2", () => {
  it("renders the V2 workspace regions with the Gaucho Chat identity", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceFrameV2
        sidebar={<div>Conversas recentes</div>}
        chat={<div>Transcricao da conversa</div>}
        composer={<div>Mensagem para o GPT...</div>}
        contextPanel={<div>Preview do documento</div>}
        mobileSidebar={<div>Menu mobile</div>}
        mobileContextPanel={<div>Painel mobile</div>}
        onOpenSettings={() => undefined}
        activeConversationTitle="Workspace Console"
        currentModelName="gpt-5.3-chat-latest"
      />
    );

    expect(markup).toContain("Gaucho Chat");
    expect(markup).toContain("Workspace Console");
    expect(markup).toContain("gpt-5.3-chat-latest");
    expect(markup).toContain('data-workspace-region="sidebar"');
    expect(markup).toContain('data-workspace-region="chat"');
    expect(markup).toContain('data-workspace-region="context"');
    expect(markup).toContain("Conversas recentes");
    expect(markup).toContain("Preview do documento");
    expect(markup).toContain("Canvas · artefato · atividade");
    expect(markup).toContain("gc-device-frame");
    expect(markup).not.toContain('class="dark ');
  });
});

describe("CommandComposerV2", () => {
  it("keeps the command bar controls visible and grouped", () => {
    const markup = renderToStaticMarkup(
      <CommandComposerV2
        value=""
        placeholder="Mensagem para o GPT..."
        attachments={[]}
        isLoading={false}
        isProcessing={false}
        isRecording={false}
        isTranscribing={false}
        speechSupported
        speechStatusLabel="Voz"
        hasContent={false}
        modelName="gpt-5.3-chat-latest"
        reasoningLabel="Alto"
        hasReasoning
        responseMode="default"
        onValueChange={() => undefined}
        onSubmit={() => undefined}
        onStop={() => undefined}
        onFileSelect={() => undefined}
        onMicrophoneClick={() => undefined}
        onSelectDocumentMode={() => undefined}
        onToggleQuiz={() => undefined}
      />
    );

    expect(markup).toContain("Mensagem para o GPT...");
    expect(markup).toContain("gpt-5.3-chat-latest");
    expect(markup).toContain('aria-label="Ajustar nível de raciocínio"');
    expect(markup).toContain("Documento");
    expect(markup).toContain("Quiz");
    expect(markup).toContain('aria-label="Adicionar arquivos"');
    expect(markup).toContain('aria-label="Gravar áudio"');
    expect(markup).toContain('aria-label="Enviar mensagem"');
  });
});
