export type MemoryCategory =
  | "project"
  | "conversation"
  | "preference"
  | "system";

export interface MemoryItem {
  id: string;

  title: string;

  content: string;

  category: MemoryCategory;

  created: string;

  updated: string;

  pinned: boolean;

  conversationId?: string;

  tags: string[];

  summary?: string;
}