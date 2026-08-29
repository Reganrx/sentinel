import { MemoryItem } from "./MemoryTypes";

const STORAGE_KEY = "sentinel-memory";

export class MemoryManager {
  private memories: MemoryItem[] = [];

  constructor() {
    this.load();
  }

  // ==========================
  // Storage
  // ==========================

  private save() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(this.memories)
    );
  }

  private load() {
    const data = localStorage.getItem(STORAGE_KEY);

    if (!data) return;

    try {
      this.memories = JSON.parse(data);
    } catch {
      this.memories = [];
    }
  }

  // ==========================
  // Getters
  // ==========================

  getAll(): MemoryItem[] {
    return [...this.memories];
  }

  find(id: string) {
    return this.memories.find(
      memory => memory.id === id
    );
  }

  getPinned() {
    return this.memories.filter(
      memory => memory.pinned
    );
  }

  getByCategory(category: MemoryItem["category"]) {
    return this.memories.filter(
      memory => memory.category === category
    );
  }

  search(query: string) {
    const q = query.toLowerCase();

    return this.memories.filter(memory =>
      memory.title.toLowerCase().includes(q) ||
      memory.content.toLowerCase().includes(q)
    );
  }

  // ==========================
  // Conversation Memory
  // ==========================

  createConversationMemory(
    conversationId: string,
    title: string,
    content: string
  ) {
    const existing = this.memories.find(
      memory => memory.conversationId === conversationId
    );

    const summary = content
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);

    if (existing) {
      this.update({
        ...existing,
        title,
        content,
        summary,
        updated: "Just now",
      });
      return;
    }

    this.add({
      id: crypto.randomUUID(),
      title,
      content,
      category: "conversation",
      created: new Date().toLocaleDateString(),
      updated: "Just now",
      pinned: false,
      conversationId,
      tags: ["conversation"],
      summary,
    });
  }

  // ==========================
  // Mutations
  // ==========================

  add(memory: MemoryItem) {
    this.memories.unshift(memory);
    this.save();
  }

  update(memory: MemoryItem) {
    this.memories = this.memories.map(item =>
      item.id === memory.id ? memory : item
    );

    this.save();
  }

  remove(id: string) {
    this.memories = this.memories.filter(
      memory => memory.id !== id
    );

    this.save();
  }

  clear() {
    this.memories = [];
    this.save();
  }

  togglePinned(id: string) {
    this.memories = this.memories.map(memory =>
      memory.id === id
        ? {
            ...memory,
            pinned: !memory.pinned,
          }
        : memory
    );

    this.save();
  }
}
