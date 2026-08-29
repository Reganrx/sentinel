import {
  KnowledgeGraph,
  SymbolNode,
} from "./knowledge.js";

export interface SearchResult {

  score: number;

  symbol: SymbolNode;

}

function scoreSymbol(
  query: string,
  symbol: SymbolNode
): number {

  const q =
    query.toLowerCase();

  const name =
    symbol.name.toLowerCase();

  const file =
    symbol.file.toLowerCase();

  let score = 0;

  if (name === q) {

    score += 100;

  }

  if (name.startsWith(q)) {

    score += 60;

  }

  if (name.includes(q)) {

    score += 40;

  }

  if (file.includes(q)) {

    score += 20;

  }

  return score;

}

export function searchKnowledge(

  graph: KnowledgeGraph,

  query: string,

  limit = 10

): SearchResult[] {

  const results: SearchResult[] = [];

  for (

    const symbol of graph.symbols.values()

  ) {

    const score =
      scoreSymbol(

        query,

        symbol

      );

    if (score > 0) {

      results.push({

        score,

        symbol,

      });

    }

  }

  return results

    .sort(

      (a, b) =>

        b.score - a.score

    )

    .slice(

      0,

      limit

    );

}