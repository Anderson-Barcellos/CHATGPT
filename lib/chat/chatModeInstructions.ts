import type { ResponseMode } from "@/types";
import { QUIZ_MIN_QUESTION_COUNT } from "@/lib/artifacts/quizArtifacts";
import { appendDeepResearchInstructions } from "@/lib/chat/deepResearchPrompt";

function isClinicalReportRequest(content: string): boolean {
  const normalized = content.toLowerCase();

  // Keywords inequivocamente clínicas — qualquer uma basta
  const specificKeywords = [
    "ultrasson", "ultrason", "ecodoppler", "doppler",
    "laudo",
    "impressão diagnóstica", "impressao diagnostica",
    "achados sonográficos", "achados sonograficos",
    "descrição técnica", "descricao tecnica",
  ];
  if (specificKeywords.some((kw) => normalized.includes(kw))) return true;

  // Keywords genéricas — exigem co-ocorrência de pelo menos 2 para evitar falsos positivos
  // ("exame de matemática" ou "joelho dói" não disparam, "achados no joelho" sim)
  const genericKeywords = [
    "exame", "achados", "relatorio", "relatório",
    "venoso", "arterial",
    "punho", "ombro", "joelho", "membro inferior", "membro superior",
  ];
  const genericMatches = genericKeywords.filter((kw) => normalized.includes(kw));
  return genericMatches.length >= 2;
}

function appendDocumentModeInstructions(
  systemMessage: string,
  content: string
): string {
  const documentInstructions = `## Document Mode
- The user explicitly wants a polished document, not a conversational answer.
- Return a complete, publication-ready markdown document.
- Start with a clear title, then use structured sections with descriptive headings.
- Prefer flowing paragraphs with strong readability.
- Use lists, tables, callouts, or code blocks only when they improve clarity.
- Keep formatting elegant and consistent, as if preparing a professional PDF-ready document.
- Do not add a chatty intro, outro, or follow-up question.
- Deliver the final document directly.`;

  const deepResearchFoundationInstructions = `## Deep Research Foundation
- Treat document mode as a research-grade writing flow, not a quick chat reply.
- Build the document from a clear chain: scope -> assumptions -> method -> findings -> synthesis -> conclusion.
- Go beyond summary: compare viewpoints, expose tradeoffs, and flag relevant uncertainty.
- Use evidence-oriented language and clearly separate facts, inferences, and recommendations.
- Never invent external citations, studies, or statistics. If no source exists in the provided context, state this limitation transparently.
- Keep depth proportional to the request: concise when asked for brevity, comprehensive for broad or complex tasks.`;

  const styleAnchorInstructions = `## Writing for the document's audience
- Apply the persona's style preferences where they fit the intended reader and document genre. Use the professional register required by the genre or audience.`;

  const clinicalReportInstructions = `## Clinical Report Style
- When the request is for a medical imaging report, ultrasound report, Doppler report, or technical clinical write-up, prefer the style of a polished diagnostic report rather than an essay.
- Use a professional medical tone, objective phrasing, and concise technical language.
- Favor a clear exam title followed by sections such as "Descrição Técnica", "Achados", "Achados Sonográficos", "Conclusão" or "Impressão Diagnóstica" when appropriate to the case.
- Keep paragraphs and itemization clinically organized, with emphasis on findings, technique, and diagnostic impression.
- When words such as "imagem", "ultrassonografia", "ecodoppler", "onda" or "traçado" refer to clinical source material, describe or interpret the finding in text; do not attempt to create a new image.
- For Doppler waveforms or simple visual patterns, ASCII sketches inside fenced code blocks are allowed when they clarify morphology, direction, phasicity or timing.
- Avoid decorative prose, motivational phrasing, or generic explanatory filler.
- If the user is rewriting or adapting an existing report, preserve the original medical structure and terminology as much as possible while improving readability and consistency.`;

  return `${systemMessage}\n\n---\n\n${documentInstructions}\n\n${deepResearchFoundationInstructions}\n\n${styleAnchorInstructions}${
    isClinicalReportRequest(content) ? `\n\n${clinicalReportInstructions}` : ""
  }`;
}

function appendQuizModeInstructions(systemMessage: string): string {
  const quizInstructions = `## Quiz Mode
- The user wants a multiple-choice quiz rendered in an interactive canvas.
- Always use Brazilian Portuguese unless the user explicitly asks for another language.
- Generate at least ${QUIZ_MIN_QUESTION_COUNT} multiple-choice questions unless the user explicitly asks for more.
- If the user asks for fewer than ${QUIZ_MIN_QUESTION_COUNT} questions, still return ${QUIZ_MIN_QUESTION_COUNT}.
- Default to 4 options per question when the user does not specify quantity.
- Each question must have exactly one correct answer.
- Explanations should be brief, accurate, and useful after grading.
- Return only the structured JSON requested by the response schema.
- Do not include markdown, prose outside the schema, or conversational wrappers.`;

  return `${systemMessage}\n\n---\n\n${quizInstructions}`;
}

export function appendChatModeInstructions(
  systemMessage: string,
  mode: ResponseMode,
  content = ""
): string {
  switch (mode) {
    case "deepsearch_medium":
    case "deepsearch_high":
      return appendDeepResearchInstructions(systemMessage, mode);
    case "document":
      return appendDocumentModeInstructions(systemMessage, content);
    case "quiz":
      return appendQuizModeInstructions(systemMessage);
    default:
      return systemMessage;
  }
}
