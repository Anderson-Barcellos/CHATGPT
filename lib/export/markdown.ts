import { Conversation, ModelParameters } from "@/types";

export interface MarkdownExportOptions {
  includeMetadata?: boolean;
  includeTimestamps?: boolean;
  includeReasoning?: boolean;
  modelParameters?: ModelParameters;
}

export function exportToMarkdown(
  conversation: Conversation,
  options: MarkdownExportOptions = {}
): string {
  const {
    includeMetadata = true,
    includeTimestamps = true,
    includeReasoning = true,
    modelParameters,
  } = options;

  let markdown = "";

  if (includeMetadata) {
    markdown += `# ${conversation.title}\n\n`;
    markdown += `---\n\n`;
    markdown += `**Created:** ${new Date(conversation.createdAt).toLocaleString()}\n`;
    markdown += `**Updated:** ${new Date(conversation.updatedAt).toLocaleString()}\n`;
    markdown += `**Messages:** ${conversation.messages.length}\n`;

    if (modelParameters) {
      markdown += `\n## Model Configuration\n\n`;
      markdown += `- **Model:** ${modelParameters.model}\n`;
      markdown += `- **Temperature:** ${modelParameters.temperature}\n`;
      markdown += `- **Max Tokens:** ${modelParameters.maxOutputTokens}\n`;
      markdown += `- **Top P:** ${modelParameters.topP}\n`;
      markdown += `- **Reasoning Effort:** ${modelParameters.reasoningEffort}\n`;
      if (modelParameters.systemPrompt) {
        markdown += `\n**System Prompt:**\n\`\`\`\n${modelParameters.systemPrompt}\n\`\`\`\n`;
      }
    }

    markdown += `\n---\n\n`;
  }

  markdown += `## Conversation\n\n`;

  conversation.messages.forEach((message, index) => {
    const role = message.role === "user" ? "👤 User" : "🤖 Assistant";
    const timestamp = includeTimestamps
      ? ` *(${new Date(message.timestamp).toLocaleString()})*`
      : "";

    markdown += `### ${role}${timestamp}\n\n`;

    if (message.imageBase64 && message.imageMimeType) {
      markdown += `![User uploaded image](data:${message.imageMimeType};base64,${message.imageBase64})\n\n`;
    }

    markdown += `${message.content}\n\n`;

    if (includeReasoning && message.reasoningText) {
      markdown += `<details>\n<summary>🧠 Reasoning</summary>\n\n`;
      markdown += `\`\`\`\n${message.reasoningText}\n\`\`\`\n\n`;
      markdown += `</details>\n\n`;
    }

    if (includeReasoning && message.reasoningSummary) {
      markdown += `**Reasoning Summary:** ${message.reasoningSummary}\n\n`;
    }

    if (index < conversation.messages.length - 1) {
      markdown += `---\n\n`;
    }
  });

  markdown += `\n---\n\n`;
  markdown += `*Exported on ${new Date().toLocaleString()}*\n`;

  return markdown;
}

export function downloadMarkdown(
  conversation: Conversation,
  options?: MarkdownExportOptions
): void {
  const markdown = exportToMarkdown(conversation, options);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFilename(conversation.title)}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .toLowerCase()
    .slice(0, 100);
}
