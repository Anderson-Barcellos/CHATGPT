import Dexie, { Table } from "dexie";
import { Conversation, CustomInstructions, Memory } from "@/types";

class AppDatabase extends Dexie {
  conversations!: Table<Conversation, string>;
  memories!: Table<Memory, string>;
  settings!: Table<CustomInstructions, string>;

  constructor() {
    super("GauchoChatDB");
    this.version(1).stores({
      conversations: "id, updatedAt",
    });
    this.version(2).stores({
      conversations: "id, updatedAt",
      memories: "id, category, isActive, priority",
      settings: "id",
    });
  }
}

export const db = new AppDatabase();
