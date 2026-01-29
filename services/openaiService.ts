import { GoogleGenAI } from "@google/genai";
import { AppSettings, Memory, Message } from "../types";

// Initialize Google GenAI Client
// API key must be from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

  // Convert history to Gemini format
  const contents = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  // Add the current user prompt
  contents.push({
    role: 'user',
    parts: [{ text: currentPrompt }]
  });

  const config: any = {
    systemInstruction: systemInstruction,
    temperature: settings.temperature,
    topP: settings.topP,
    maxOutputTokens: settings.maxOutputTokens,
  };

  try {
    const responseStream = await ai.models.generateContentStream({
      model: settings.model,
      contents: contents,
      config: config
    });
    
    let fullText = '';
    
    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(fullText);
      }
    }
    
    return fullText;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateImage = async (
  prompt: string,
  settings: AppSettings
): Promise<{ url: string, mimeType: string }> => {
  
  try {
    // Using gemini-2.5-flash-image for general image generation
    const model = 'gemini-2.5-flash-image';
    
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] },
    });

    // Find the image part in the response
    const candidate = response.candidates?.[0];
    if (candidate && candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          return {
            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            mimeType: part.inlineData.mimeType
          };
        }
      }
    }
    
    throw new Error("No image data returned from Gemini");
    
  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    throw error;
  }
};
