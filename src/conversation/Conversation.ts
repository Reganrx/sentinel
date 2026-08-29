export type ChatMessage = {
  id: string;
  sender: "user" | "sentinel";
  text: string;
  timestamp: string;
  imageUrl?: string;
  imagePrompt?: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export function createConversation(): Conversation {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: "New Conversation",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: crypto.randomUUID(),
        sender: "sentinel",
        text: "Welcome to Sentinel. How can I help you today?",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ],
  };
}
