import {
  Conversation,
  ChatMessage,
  createConversation,
} from "./Conversation";

const STORAGE_KEY = "sentinel-conversations-v1";

export default class ConversationManager {
  private conversations: Conversation[];

  constructor() {
    this.conversations = this.load();

    if (this.conversations.length === 0) {
      this.conversations = [createConversation()];
      this.save();
    }
  }

  private load(): Conversation[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];

      const parsed: unknown = JSON.parse(saved);

      return Array.isArray(parsed)
        ? parsed.filter(
            (conversation): conversation is Conversation =>
              Boolean(conversation) &&
              typeof conversation.id === "string" &&
              typeof conversation.title === "string" &&
              Array.isArray(conversation.messages)
          )
        : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.conversations));
  }

  getAll(): Conversation[] {
    return [...this.conversations];
  }

  getCurrent(): Conversation {
    return this.conversations[0];
  }

  find(id: string): Conversation | undefined {
    return this.conversations.find(conversation => conversation.id === id);
  }

  create(): Conversation {
    const conversation = createConversation();
    this.conversations = [conversation, ...this.conversations];
    this.save();
    return conversation;
  }

  delete(id: string): void {
    this.conversations = this.conversations.filter(
      conversation => conversation.id !== id
    );

    if (this.conversations.length === 0) {
      this.conversations = [createConversation()];
    }

    this.save();
  }

  rename(id: string, title: string): void {
    this.conversations = this.conversations.map(conversation =>
      conversation.id === id
        ? { ...conversation, title, updatedAt: new Date().toISOString() }
        : conversation
    );
    this.save();
  }

  duplicate(id: string): Conversation | undefined {
    const original = this.find(id);
    if (!original) return undefined;

    const now = new Date().toISOString();
    const copy: Conversation = {
      ...original,
      id: crypto.randomUUID(),
      title: `Copy of ${original.title}`,
      createdAt: now,
      updatedAt: now,
      messages: original.messages.map(message => ({
        ...message,
        id: crypto.randomUUID(),
      })),
    };

    this.conversations = [copy, ...this.conversations];
    this.save();
    return copy;
  }

  addMessage(conversationId: string, message: ChatMessage): void {
    this.conversations = this.conversations.map(conversation =>
      conversation.id === conversationId
        ? {
            ...conversation,
            updatedAt: new Date().toISOString(),
            messages: [...conversation.messages, message],
          }
        : conversation
    );
    this.save();
  }

  updateLastMessage(conversationId: string, chunk: string): void {
    this.conversations = this.conversations.map(conversation => {
      if (conversation.id !== conversationId || conversation.messages.length === 0) {
        return conversation;
      }

      const messages = [...conversation.messages];
      const last = messages[messages.length - 1];
      messages[messages.length - 1] = { ...last, text: last.text + chunk };

      return { ...conversation, updatedAt: new Date().toISOString(), messages };
    });
    this.save();
  }
}
