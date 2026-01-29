<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1-bPr4E6gfUSoF0sGEJbsy62rNr7hW-3L

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `OPENAI_API_KEY` in [.env.local](.env.local) to your OpenAI API key
3. Run the app:
   `npm run dev`

## System Prompt (OpenAI Responses API)

This app sends the system instruction to OpenAI using the Responses API `instructions` field. The full instruction is composed of:

- `systemInstruction` (core system prompt)
- Optional user context (`contextAboutUser`)
- Active memories
- Optional response style preferences (`responsePreferences`)

The system prompt is injected into every response request so that the assistant behavior matches the OpenAI instruction hierarchy.

## Remaining Implementation Plan

- Add conversation persistence using `previous_response_id` to take advantage of Responses API conversation state.
- Add tool calling support to enable function execution with the Responses API.
- Expand image settings (size, quality, background) to expose OpenAI image parameters.
