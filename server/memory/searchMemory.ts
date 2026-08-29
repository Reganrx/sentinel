import {
  getLongTermMemory,
  type LongTermMemory,
} from "./longTermMemory.js";

export type RetrievedMemory = {

  memory: LongTermMemory;

  score: number;

};

const TITLE_WEIGHT = 10;
const CONTENT_WEIGHT = 5;
const CATEGORY_WEIGHT = 2;

function scoreMemory(
  memory: LongTermMemory,
  query: string
): number {

  const search =
    query
      .trim()
      .toLowerCase();

  if (!search) {
    return 0;
  }

  let score = 0;

  if (
    memory.title
      .toLowerCase()
      .includes(search)
  ) {
    score += TITLE_WEIGHT;
  }

  if (
    memory.content
      .toLowerCase()
      .includes(search)
  ) {
    score += CONTENT_WEIGHT;
  }

  if (
    memory.category
      .toLowerCase()
      .includes(search)
  ) {
    score += CATEGORY_WEIGHT;
  }

  return score;

}

export function retrieveMemories(
  query: string,
  limit = 5
): LongTermMemory[] {

  return getLongTermMemory()

    .map(memory => ({

      memory,

      score: scoreMemory(
        memory,
        query
      ),

    }))

    .filter(
      result =>
        result.score > 0
    )

    .sort(
      (a, b) =>
        b.score - a.score
    )

    .slice(0, limit)

    .map(
      result =>
        result.memory
    );

}