# Workspace Canvas Markdown Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the workspace-v2 chat layout by fixing conversation scrolling, restoring light/dark theme behavior, refreshing message bubbles, and adding an expanded Markdown Canvas.

**Architecture:** Keep the current chat contract intact and reuse existing message artifacts for the Canvas. Apply the visual system through CSS tokens so light and dark themes diverge cleanly without duplicating component logic.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Radix UI, Zustand, Vitest.

---

### Task 1: Theme Tokens And Workspace Shell

**Files:**
- Modify: `app/globals.css`
- Modify: `components/workspace-v2/WorkspaceLayoutV2.tsx`
- Test: `components/workspace-v2/WorkspaceLayoutV2.test.tsx`

- [x] Remove the forced `dark` class from `WorkspaceFrameV2`.
- [x] Add `--v2-*` CSS tokens for light and dark shell, panels, controls, borders, bubbles, and canvas surfaces.
- [x] Update the workspace shell to consume the tokens and support an expandable right panel.
- [x] Extend the workspace test to guard against reintroducing a forced dark wrapper.

### Task 2: Scroll Containers

**Files:**
- Modify: `components/workspace-v2/ConversationRailV2.tsx`
- Modify: `components/workspace-v2/ChatCanvasV2.tsx`
- Modify: `components/chat/ChatContainer.tsx`

- [x] Make the conversation rail a fixed-height flex column with a real internal scroll viewport.
- [x] Ensure the chat canvas and chat container carry `min-h-0` through the flex stack.
- [x] Keep body/html overflow hidden and preserve existing internal scroll behavior.

### Task 3: Message Bubbles

**Files:**
- Modify: `app/globals.css`
- Modify: `components/chat/MessageBubble.tsx`

- [x] Replace hard-coded user and assistant bubble colors with token-backed classes.
- [x] Preserve attachments, citations, reasoning, edit/delete, copy, and long-press behavior.
- [x] Keep the change visual-only with no message contract changes.

### Task 4: Canvas Markdown Tab

**Files:**
- Modify: `components/workspace-v2/ContextPanelV2.tsx`
- Modify: `components/workspace-v2/WorkspaceLayoutV2.tsx`

- [x] Add a `Canvas` tab that defaults open and renders the current/fallback artifact in a larger surface.
- [x] Reuse `DocumentCanvas`, `ChatMarkdown`, `HtmlPreview`, and `QuizCanvas` for Markdown, HTML, and quiz content.
- [x] Provide copy/PDF actions from the Canvas header and keep source/metadata in the existing artifact tab.
- [x] Use the existing mobile sheet as the full-width Canvas route on small screens.

### Task 5: Validation

**Files:**
- Read: `package.json`

- [x] Run `npm test`.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm run build`.
- [x] If deploying, restart `chatgpt.service` and verify `/chat/api/health`.
