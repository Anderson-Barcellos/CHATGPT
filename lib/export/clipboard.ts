import { Conversation, ModelParameters } from "@/types";
import { exportToMarkdown } from "./markdown";
import {
  isReasoningModel,
  modelSupportsCodeInterpreter,
  modelSupportsTemperature,
  modelSupportsVerbosity,
} from "@/lib/models/modelConfig";

export interface ClipboardExportOptions {
  format?: "markdown" | "plain" | "html";
  includeMetadata?: boolean;
  includeTimestamps?: boolean;
  includeReasoning?: boolean;
  modelParameters?: ModelParameters;
}

export async function copyToClipboard(
  conversation: Conversation,
  options: ClipboardExportOptions = {}
): Promise<void> {
  const { format = "markdown", includeMetadata = true, includeTimestamps = true, includeReasoning = true, modelParameters } = options;

  let textContent = "";
  let htmlContent = "";

  switch (format) {
    case "markdown":
      textContent = exportToMarkdown(conversation, {
        includeMetadata,
        includeTimestamps,
        includeReasoning,
        modelParameters,
      });
      htmlContent = convertMarkdownToHTML(textContent);
      break;

    case "plain":
      textContent = exportToPlainText(conversation, {
        includeMetadata,
        includeTimestamps,
        includeReasoning,
        modelParameters,
      });
      htmlContent = textContent.replace(/\n/g, "<br>");
      break;

    case "html":
      htmlContent = exportToHTML(conversation, {
        includeMetadata,
        includeTimestamps,
        includeReasoning,
        modelParameters,
      });
      textContent = htmlToPlainText(htmlContent);
      break;
  }

  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const blob = new Blob([htmlContent], { type: "text/html" });
      const textBlob = new Blob([textContent], { type: "text/plain" });
      
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blob,
          "text/plain": textBlob,
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(textContent);
    }
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = textContent;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

function exportToPlainText(
  conversation: Conversation,
  options: Omit<ClipboardExportOptions, "format">
): string {
  const { includeMetadata, includeTimestamps, includeReasoning, modelParameters } = options;
  let text = "";

  if (includeMetadata) {
    text += `${conversation.title}\n`;
    text += `${"=".repeat(conversation.title.length)}\n\n`;
    text += `Created: ${new Date(conversation.createdAt).toLocaleString()}\n`;
    text += `Updated: ${new Date(conversation.updatedAt).toLocaleString()}\n`;
    text += `Messages: ${conversation.messages.length}\n`;

    if (modelParameters) {
      text += `\nModel: ${modelParameters.model}\n`;
      text += `Max Tokens: ${modelParameters.maxOutputTokens}\n`;
      if (modelSupportsTemperature(modelParameters.model)) {
        text += `Temperature: ${modelParameters.temperature}\n`;
        text += `Top P: ${modelParameters.topP}\n`;
      }
      if (isReasoningModel(modelParameters.model)) {
        text += `Reasoning Effort: ${modelParameters.reasoningEffort}\n`;
      }
      if (modelSupportsVerbosity(modelParameters.model)) {
        text += `Verbosity: ${modelParameters.verbosity}\n`;
      }
      if (modelSupportsCodeInterpreter(modelParameters.model)) {
        text += `Code Interpreter: ${modelParameters.codeInterpreterEnabled ? "On" : "Off"}\n`;
      }
    }

    text += `\n${"-".repeat(50)}\n\n`;
  }

  conversation.messages.forEach((message, index) => {
    const role = message.role === "user" ? "USER" : "ASSISTANT";
    const timestamp = includeTimestamps
      ? ` (${new Date(message.timestamp).toLocaleString()})`
      : "";

    text += `[${role}]${timestamp}\n`;
    text += `${message.content}\n`;

    if (includeReasoning && message.reasoningText) {
      text += `\nReasoning:\n${message.reasoningText}\n`;
    }

    if (includeReasoning && message.reasoningSummary) {
      text += `Summary: ${message.reasoningSummary}\n`;
    }

    if (index < conversation.messages.length - 1) {
      text += `\n${"-".repeat(50)}\n\n`;
    }
  });

  return text;
}

function exportToHTML(
  conversation: Conversation,
  options: Omit<ClipboardExportOptions, "format">
): string {
  const { includeMetadata, includeTimestamps, includeReasoning, modelParameters } = options;
  let html = '<div style="font-family: system-ui, sans-serif; max-width: 800px;">';

  if (includeMetadata) {
    html += `<h1 style="color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px;">${escapeHtml(conversation.title)}</h1>`;
    html += '<div style="color: #666; font-size: 0.9em; margin-bottom: 20px;">';
    html += `<p><strong>Created:</strong> ${new Date(conversation.createdAt).toLocaleString()}</p>`;
    html += `<p><strong>Updated:</strong> ${new Date(conversation.updatedAt).toLocaleString()}</p>`;
    html += `<p><strong>Messages:</strong> ${conversation.messages.length}</p>`;

    if (modelParameters) {
      html += `<h3 style="margin-top: 15px;">Model Configuration</h3>`;
      html += `<ul style="list-style: none; padding-left: 0;">`;
      html += `<li><strong>Model:</strong> ${escapeHtml(modelParameters.model)}</li>`;
      html += `<li><strong>Max Tokens:</strong> ${modelParameters.maxOutputTokens}</li>`;
      if (modelSupportsTemperature(modelParameters.model)) {
        html += `<li><strong>Temperature:</strong> ${modelParameters.temperature}</li>`;
        html += `<li><strong>Top P:</strong> ${modelParameters.topP}</li>`;
      }
      if (isReasoningModel(modelParameters.model)) {
        html += `<li><strong>Reasoning Effort:</strong> ${escapeHtml(modelParameters.reasoningEffort)}</li>`;
      }
      if (modelSupportsVerbosity(modelParameters.model)) {
        html += `<li><strong>Verbosity:</strong> ${escapeHtml(modelParameters.verbosity)}</li>`;
      }
      if (modelSupportsCodeInterpreter(modelParameters.model)) {
        html += `<li><strong>Code Interpreter:</strong> ${modelParameters.codeInterpreterEnabled ? "On" : "Off"}</li>`;
      }
      html += `</ul>`;
    }

    html += '</div><hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">';
  }

  conversation.messages.forEach((message) => {
    const isUser = message.role === "user";
    const bgColor = isUser ? "#f0f0f0" : "#e6f3ff";
    const roleColor = isUser ? "#047857" : "#1d4ed8";
    const role = isUser ? "User" : "Assistant";
    const timestamp = includeTimestamps
      ? ` <span style="color: #999; font-size: 0.85em;">(${new Date(message.timestamp).toLocaleString()})</span>`
      : "";

    html += `<div style="margin-bottom: 20px; padding: 15px; background-color: ${bgColor}; border-radius: 8px;">`;
    html += `<div style="color: ${roleColor}; font-weight: bold; margin-bottom: 8px;">${role}${timestamp}</div>`;

    if (message.imageBase64 && message.imageMimeType) {
      html += `<div style="margin: 10px 0;"><img src="data:${message.imageMimeType};base64,${message.imageBase64}" style="max-width: 400px; border-radius: 4px;" /></div>`;
    }

    html += `<div style="white-space: pre-wrap;">${escapeHtml(message.content)}</div>`;

    if (includeReasoning && message.reasoningText) {
      html += `<details style="margin-top: 10px; padding: 10px; background-color: rgba(255,255,255,0.5); border-radius: 4px;">`;
      html += `<summary style="cursor: pointer; font-weight: bold; color: #666;">Reasoning</summary>`;
      html += `<pre style="margin-top: 10px; overflow-x: auto; font-size: 0.9em;">${escapeHtml(message.reasoningText)}</pre>`;
      html += `</details>`;
    }

    if (includeReasoning && message.reasoningSummary) {
      html += `<div style="margin-top: 8px; font-size: 0.9em; color: #666;"><strong>Summary:</strong> ${escapeHtml(message.reasoningSummary)}</div>`;
    }

    html += '</div>';
  });

  html += `<div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e5e5; color: #999; font-size: 0.85em; text-align: center;">`;
  html += `Exported on ${new Date().toLocaleString()}`;
  html += '</div></div>';

  return html;
}

function convertMarkdownToHTML(markdown: string): string {
  const html = markdown
    .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `<div style="font-family: system-ui, sans-serif;"><p>${html}</p></div>`;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
