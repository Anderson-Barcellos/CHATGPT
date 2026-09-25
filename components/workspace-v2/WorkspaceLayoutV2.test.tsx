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
    expect(markup).toContain("overflow-clip");
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
        onMicrophoneClick={() => undefined}
        onSelectDocumentMode={() => undefined}
        onToggleQuiz={() => undefined}
      />
    );

    expect(markup).toContain("Mensagem para o GPT...");
    expect(markup).toContain("gpt-5.3-chat-latest");
    expect(markup).toContain('aria-label="Ajustar nível de raciocínio"');
    expect(markup).not.toContain('aria-label="Adicionar anexos"');
    expect(markup).toContain("Documento");
    expect(markup).toContain("Quiz");
    expect(markup).toContain('aria-label="Gravar áudio"');
    expect(markup).toContain('aria-label="Selecionar tipo de pesquisa"');
    expect(markup).toContain('aria-label="Enviar mensagem"');
    expect(markup).toContain("pb-[var(--gc-mobile-composer-footer-bottom)]");
    expect(markup).not.toContain("pb-[calc(env(safe-area-inset-bottom)+var(--gc-mobile-composer-footer-bottom))]");
    expect(markup).toContain("py-[var(--gc-mobile-composer-controls-y)]");
    expect(markup).toContain("flex flex-nowrap items-center justify-between");
    expect(markup).toContain("order-1 size-[var(--gc-mobile-composer-control-height)]");
    expect(markup).toContain("gc-composer-controls order-2 flex min-w-0 flex-1");
    expect(markup).toContain("order-3 flex h-[var(--gc-mobile-composer-control-height)]");
    expect(markup).toContain("order-4 ml-auto flex shrink-0");
    expect(markup).not.toContain("overflow-x-auto");
    expect(markup).toContain("size-[var(--gc-mobile-composer-control-height)]");
    expect(markup).toContain("size-[var(--gc-mobile-composer-send-size)]");
  });

  it("shows the audio wave only while recording and keeps transcription distinct", () => {
    const props = {
      value: "",
      placeholder: "Mensagem para o GPT...",
      attachments: [],
      isLoading: false,
      isProcessing: false,
      speechSupported: true,
      speechStatusLabel: "Voz",
      hasContent: false,
      modelName: "Grok 4.7",
      reasoningLabel: "Médio",
      hasReasoning: true,
      responseMode: "default" as const,
      onValueChange: () => undefined,
      onSubmit: () => undefined,
      onStop: () => undefined,
      onMicrophoneClick: () => undefined,
      onSelectDocumentMode: () => undefined,
      onToggleQuiz: () => undefined,
    };

    const idle = renderToStaticMarkup(<CommandComposerV2 {...props} isRecording={false} isTranscribing={false} />);
    const recording = renderToStaticMarkup(<CommandComposerV2 {...props} isRecording isTranscribing={false} audioLevel={0.5} />);
    const transcribing = renderToStaticMarkup(<CommandComposerV2 {...props} isRecording={false} isTranscribing />);

    expect(idle).toContain('aria-label="Gravar áudio"');
    expect(idle).not.toContain("lucide-audio-lines");
    expect(recording).toContain('aria-label="Encerrar gravação"');
    expect(recording).toContain('aria-pressed="true"');
    expect(recording).toContain("lucide-audio-lines");
    expect(recording).toContain("motion-reduce:!animate-none");
    expect(transcribing).not.toContain("lucide-audio-lines");
    expect(transcribing).toContain("animate-spin");
  });
});

describe("CommandComposerContainerV2", () => {
  it("keeps the search control and composer modes without a manual attachment picker", () => {
    const markup = renderToStaticMarkup(
      <CommandComposerContainerV2
        sendMessage={async () => false}
        stopGeneration={() => undefined}
        isLoading={false}
        error={null}
      />
    );

    expect(markup).not.toContain('aria-label="Adicionar anexos"');
    expect(markup).not.toContain('type="file"');
    expect(markup).toContain('aria-label="Selecionar tipo de pesquisa"');
    expect(markup).toContain('aria-label="Selecionar modelo"');
    expect(markup).toContain("max-w-[var(--gc-mobile-composer-model-width)]");
    expect(markup).toContain("md:max-w-[10rem]");
    expect(markup).toContain(">Rec<");
    expect(markup).toContain('aria-label="Ativar modo Pro"');
    expect(markup).toContain('aria-pressed="false"');
  });
});
