import { apiUrl } from "@/lib/utils";
import { Conversation, Message, SerializedConversation } from "@/types";
import { parseApiErrorResponse } from "@/lib/api/errors";
import { deserializeConversation } from "@/lib/storage/serializers";

const BASE = () => apiUrl("/api/conversations");

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    throw await parseApiErrorResponse(res);
  }
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await fetch(BASE(), { cache: "no-store" });
  await assertOk(res);

  const data = await safeJson(res);
  return Array.isArray(data)
    ? data.map((conversation) =>
        deserializeConversation(conversation as SerializedConversation)
      )
    : [];
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const res = await fetch(`${BASE()}/${id}`, { cache: "no-store" });
  await assertOk(res);

  const data = await safeJson(res);
  return data
    ? deserializeConversation(data as SerializedConversation)
    : undefined;
}

export async function createConversation(title?: string): Promise<string> {
  const res = await fetch(BASE(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  await assertOk(res);

  const data = await safeJson(res);
  const conversation = data
    ? deserializeConversation(data as SerializedConversation)
    : undefined;

  if (!conversation?.id) {
    throw new Error("A API criou a conversa, mas nao devolveu um ID valido.");
  }

  return conversation.id;
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`${BASE()}/${id}`, { method: "DELETE" });
  await assertOk(res);
}

export async function saveConversationMessages(
  id: string,
  messages: Message[]
): Promise<void> {
  const res = await fetch(`${BASE()}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  await assertOk(res);
}

export async function updateConversationTitle(
  id: string,
  title: string
): Promise<void> {
  const res = await fetch(`${BASE()}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  await assertOk(res);
}

export async function saveConversationMessagesAndTitle(
  id: string,
  messages: Message[],
  title: string
): Promise<void> {
  const res = await fetch(`${BASE()}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, title }),
  });
  await assertOk(res);
}
