import path from "path";

import {
  scanProject,
} from "./scanner.js";

import {
  extractSymbols,
} from "./symbols.js";

import {
  extractImports,
} from "./graph.js";

import {
  buildKnowledgeGraph,
  KnowledgeGraph,
} from "./knowledge.js";

export interface IndexedFile {

  path: string;

  symbols: Awaited<
    ReturnType<
      typeof extractSymbols
    >
  >;

  imports: Awaited<
    ReturnType<
      typeof extractImports
    >
  >;

}

export async function buildProjectIndex(
  workspace: string
): Promise<IndexedFile[]> {

  const files =
    await scanProject(
      workspace
    );

  const index: IndexedFile[] = [];

  for (const file of files) {

    const absolute =
      path.join(
        workspace,
        file.path
      );

    index.push({

      path: file.path,

      symbols:
        await extractSymbols(
          absolute
        ),

      imports:
        await extractImports(
          absolute
        ),

    });

  }

  return index;

}

export async function buildProjectKnowledge(
  workspace: string
): Promise<KnowledgeGraph> {

  const index =
    await buildProjectIndex(
      workspace
    );

  return buildKnowledgeGraph(
    index
  );

}