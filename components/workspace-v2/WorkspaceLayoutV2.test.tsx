import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CommandComposerContainerV2 } from "@/components/workspace-v2/CommandComposerContainerV2";
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
        onNewConversation={() => undefined}
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
    expect(markup).toContain("Artefato");
    expect(markup).not.toContain("Preview do documento");
    expect(markup).toContain("gc-device-frame");
    expect(markup).toContain("gc-atmosphere-shell");
    expect(markup).toContain("gc-chat-ui");
    expect(markup).toContain('data-visual-theme="atmosphere-glass"');
    expect(markup).toContain("text-[length:var(--gc-mobile-tab-font-size)]");
    expect(markup).not.toContain("text-[0.6rem]");
    expect(markup).not.toContain('class="dark ');
    expect(markup).not.toContain(">Salvo<");
    expect(markup).not.toContain(">online<");
    expect(markup).not.toContain("gc-mobile-density");
    expect(markup).not.toContain("lg:hidden md:hidden");
    expect(markup).toContain("gc-safe-x");
  });

  it("keeps the top bar free of product links: SoundCase lives only in the rail", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceFrameV2
        sidebar={<div>Conversas recentes</div>}
        chat={<div>Transcricao da conversa</div>}
        composer={<div>Mensagem para o GPT...</div>}
        contextPanel={<div>Preview do documento</div>}
        mobileSidebar={<div>Menu mobile</div>}
        mobileContextPanel={<div>Painel mobile</div>}
        onNewConversation={() => undefined}
        onOpenSettings={() => undefined}
        activeConversationTitle="Workspace Console"
        currentModelName="gpt-5.3-chat-latest"
      />
    );

    expect(markup).not.toContain("Produtos Gaucho");
    expect(markup).not.toContain("/soundcase");
    expect(markup).not.toContain(">Som<");
    expect(markup).toContain("repeat(3,minmax(0,0.58fr))");
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
        onImageSelect={() => undefined}
        onMicrophoneClick={() => undefined}
        onSelectDocumentMode={() => undefined}
        onToggleQuiz={() => undefined}
      />
    );

    expect(markup).toContain("Mensagem para o GPT...");
    expect(markup).toContain("gpt-5.3-chat-latest");
    expect(markup).toContain('aria-label="Ajustar nível de raciocínio"');
    expect(markup).toContain('aria-label="Adicionar anexos"');
    expect(markup).toContain("Documento");
    expect(markup).toContain("Quiz");
    expect(markup).toContain('aria-label="Gravar áudio"');
    expect(markup).toContain('aria-label="Enviar mensagem"');
    expect(markup).toContain("py-[var(--gc-mobile-composer-controls-y)]");
    expect(markup).toContain("flex flex-nowrap items-center justify-between gap-[0.23rem]");
    expect(markup).toContain("flex shrink-0 items-center gap-[0.23rem]");
    expect(markup).toContain("gc-composer-controls flex min-w-0 flex-1 flex-wrap items-center min-[390px]:flex-nowrap");
    expect(markup).not.toContain("overflow-x-auto");
    expect(markup).toContain("size-[var(--gc-mobile-composer-control-height)]");
    expect(markup).toContain("size-[var(--gc-mobile-composer-send-size)]");
  });
});

describe("CommandComposerContainerV2", () => {
  it("promotes attachments to the first row and removes the mobile bottom attachment bar", () => {
    const markup = renderToStaticMarkup(
      <CommandComposerContainerV2
        sendMessage={async () => false}
        stopGeneration={() => undefined}
        isLoading={false}
        error={null}
      />
    );

    expect(markup).toContain('aria-label="Adicionar anexos"');
    expect(markup).toContain('aria-label="Selecionar modelo"');
    expect(markup).toContain("max-w-[var(--gc-mobile-composer-model-width)]");
    expect(markup).toContain("md:max-w-[10rem]");
    expect(markup).toContain(">Rec<");
    expect(markup).not.toContain(">Arquivo<");
    expect(markup).not.toContain(">Imagem<");
    expect(markup).toContain('aria-label="Ativar modo Pro"');
    expect(markup).toContain('aria-pressed="false"');
  });
});
