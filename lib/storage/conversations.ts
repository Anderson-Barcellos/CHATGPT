import { apiUrl } from "@/lib/utils";
import { Conversation, Message, SerializedConversation } from "@/types";
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

export async function listConversations(): Promise<Conversation[]> {
  try {
    const res = await fetch(BASE(), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await safeJson(res);
    return Array.isArray(data)
      ? data.map((conversation) =>
          deserializeConversation(conversation as SerializedConversation)
        )
      : [];
  } catch (err) {
    console.error("[conversations] list failed:", err);
    return [];
  }
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  try {
    const res = await fetch(`${BASE()}/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await safeJson(res);
    return data
      ? deserializeConversation(data as SerializedConversation)
      : undefined;
  } catch (err) {
    console.error("[conversations] get failed:", err);
    return undefined;
  }
}

export async function createConversation(title?: string): Promise<string> {
  try {
    const res = await fetch(BASE(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await safeJson(res);
    const conversation = data
      ? deserializeConversation(data as SerializedConversation)
      : undefined;
    return conversation?.id ?? `temp-${Date.now()}`;
  } catch (err) {
    console.error("[conversations] create failed:", err);
    return `temp-${Date.now()}`;
  }
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    await fetch(`${BASE()}/${id}`, { method: "DELETE" });
  } catch (err) {
    console.error("[conversations] delete failed:", err);
  }
}

export async function saveConversationMessages(
  id: string,
  messages: Message[]
): Promise<void> {
  try {
    await fetch(`${BASE()}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
  } catch (err) {
    console.error("[conversations] save failed:", err);
  }
}

export async function updateConversationTitle(
  id: string,
  title: string
): Promise<void> {
  try {
    await fetch(`${BASE()}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  } catch (err) {
    console.error("[conversations] title update failed:", err);
  }
}
