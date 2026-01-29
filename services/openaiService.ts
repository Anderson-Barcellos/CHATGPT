import OpenAI from "openai";
import { AppSettings, Memory, Message } from "../types";

// Initialize OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? process.env.API_KEY ?? "",
  dangerouslyAllowBrowser: true
});

export const buildSystemPrompt = (settings: AppSettings, memories: Memory[]): string => {
  const activeMemories = memories.filter(m => m.isActive).map(m => `- [${m.category}] ${m.content}`).join('\n');
  
  let prompt = settings.systemInstruction;
  
  if (settings.contextAboutUser) {
    prompt += `\n\n## User Context\n${settings.contextAboutUser}`;
  }
  
  if (activeMemories) {
    prompt += `\n\n## Memories\n${activeMemories}`;
  }
  
  if (settings.responsePreferences) {
    prompt += `\n\n## Response Style\n${settings.responsePreferences}`;
  }
  
  return prompt;
};

export const generateStream = async (
  history: Message[],
  currentPrompt: string,
  settings: AppSettings,
  memories: Memory[],
  onChunk: (text: string) => void
): Promise<string> => {
  
  const systemInstruction = buildSystemPrompt(settings, memories);

  const messages = [
    { role: 'system', content: systemInstruction },
    ...history.map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    { role: 'user', content: currentPrompt }
  ];

  try {
    const stream = await openai.chat.completions.create({
      model: settings.model,
      messages,
      temperature: settings.temperature,
      top_p: settings.topP,
      max_tokens: settings.maxOutputTokens,
      stream: true
    });

    let fullText = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        onChunk(fullText);
      }
    }

    return fullText;

  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw error;
  }
};

export const generateImage = async (
  prompt: string,
  settings: AppSettings
): Promise<{ url: string, mimeType: string }> => {
  
  try {
    const response = await openai.images.generate({
      model: settings.imageModel ?? "dall-e-3",
      prompt,
      response_format: "b64_json"
    });

    const imageData = response.data?.[0]?.b64_json;
    if (!imageData) {
      throw new Error("No image data returned from OpenAI");
    }

    return {
      url: `data:image/png;base64,${imageData}`,
      mimeType: "image/png"
    };
    
  } catch (error) {
    console.error("OpenAI Image Gen Error:", error);
    throw error;
  }
};
