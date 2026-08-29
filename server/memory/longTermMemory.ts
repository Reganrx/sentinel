export type MemoryCategory =
  | "profile"
  | "project"
  | "preference"
  | "conversation"
  | "workspace"
  | "general";

export type LongTermMemory = {

  id: string;

  title: string;

  content: string;

  category: MemoryCategory;

  importance: number;

  created: number;

  updated: number;

  accessCount: number;

};

const memories: LongTermMemory[] = [

  {

    id: crypto.randomUUID(),

    title: "User Name",

    content: "The user's name is Regan.",

    category: "profile",

    importance: 10,

    created: Date.now(),

    updated: Date.now(),

    accessCount: 0,

  },

  {

    id: crypto.randomUUID(),

    title: "Current Project",

    content:
      "The user is building Sentinel, an advanced desktop AI assistant.",

    category: "project",

    importance: 10,

    created: Date.now(),

    updated: Date.now(),

    accessCount: 0,

  },

  {

    id: crypto.randomUUID(),

    title: "Coding Style",

    content:
      "The user prefers complete rewritten files rather than snippets.",

    category: "preference",

    importance: 9,

    created: Date.now(),

    updated: Date.now(),

    accessCount: 0,

  },

];

export function getLongTermMemory() {

  return memories;

}

export function addMemory(

  title: string,

  content: string,

  category: MemoryCategory,

  importance = 5

): LongTermMemory {

  const memory: LongTermMemory = {

    id: crypto.randomUUID(),

    title,

    content,

    category,

    importance,

    created: Date.now(),

    updated: Date.now(),

    accessCount: 0,

  };

  memories.push(memory);

  return memory;

}

export function updateMemory(

  id: string,

  content: string

) {

  const memory =
    memories.find(

      m => m.id === id

    );

  if (!memory) {

    return;

  }

  memory.content =
    content;

  memory.updated =
    Date.now();

}

export function touchMemory(
  id: string
) {

  const memory =
    memories.find(

      m => m.id === id

    );

  if (!memory) {

    return;

  }

  memory.accessCount++;

}

export function removeMemory(
  id: string
) {

  const index =
    memories.findIndex(

      m => m.id === id

    );

  if (index >= 0) {

    memories.splice(index, 1);

  }

}