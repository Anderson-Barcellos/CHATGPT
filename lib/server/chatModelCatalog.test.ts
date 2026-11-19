import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { DEFAULT_CHAT_MODEL_CATALOG } from "@/lib/models/chatModelCatalog";

vi.mock("server-only", () => ({}));

it("preserva overrides antigos e ordem e não ressuscita um modelo excluído em gravações concorrentes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gaucho-catalog-"));
  const cwd = vi.spyOn(process, "cwd").mockReturnValue(root);
  try {
    vi.resetModules();
    const { readChatModelCatalog, deleteChatModel, reorderChatModels, applyChatBadges } = await import("./chatModelCatalog");
    const [first, second] = DEFAULT_CHAT_MODEL_CATALOG.rows;
    const custom = { model: { ...first.model, id: "gpt-custom-test", name: "Teste" }, visible: true };
    await mkdir(path.join(root, "data"));
    await writeFile(path.join(root, "data/chat-model-catalog.json"), JSON.stringify({
      revision: 8, rows: [{ ...second, visible: false }, custom],
    }));
    const original = await readChatModelCatalog();
    expect(original.rows.at(-1)).toEqual(custom);
    const order = original.rows.map(row => row.model.id).reverse();
    const sorted = await reorderChatModels(8, order);
    expect(sorted.rows.map(row => row.model.id)).toEqual(order);
    expect(sorted.rows.find(row => row.model.id === second.model.id)?.visible).toBe(false);
    const concurrent = await Promise.allSettled([
      deleteChatModel(9, first.model.id), applyChatBadges(9, [{ id: custom.model.id, badge: "Teste" }]),
    ]);
    expect(concurrent.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(concurrent.find(result => result.status === "rejected")?.reason.status).toBe(409);
    const current = await readChatModelCatalog();
    if (current.rows.some(row => row.model.id === first.model.id)) await deleteChatModel(current.revision, first.model.id);
    expect((await readChatModelCatalog()).rows.map(row => row.model.id)).toEqual(order.filter(id => id !== first.model.id));
  } finally {
    cwd.mockRestore();
    await rm(root, { recursive: true, force: true });
  }
});
