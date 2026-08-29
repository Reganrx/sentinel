import {
  addMemory,
  getLongTermMemory,
  updateMemory,
  MemoryCategory,
  LongTermMemory,
} from "./longTermMemory.js";

export type RememberResult = {

  success: boolean;

  created: boolean;

  updated: boolean;

  memory: LongTermMemory;

};

function normalize(
  value: string
): string {

  return value
    .trim()
    .toLowerCase();

}

export function rememberMemory(

  title: string,

  content: string,

  category: MemoryCategory = "general",

  importance = 5

): RememberResult {

  const existing =
    getLongTermMemory().find(

      (memory: LongTermMemory) =>

        normalize(memory.title) ===
        normalize(title)

    );

  if (existing) {

    updateMemory(

      existing.id,

      content

    );

    existing.category = category;

    existing.importance = importance;

    return {

      success: true,

      created: false,

      updated: true,

      memory: existing,

    };

  }

  const created =
    addMemory(

      title,

      content,

      category,

      importance

    );

  return {

    success: true,

    created: true,

    updated: false,

    memory: created,

  };

}