import { IndexedFile } from "./index.js";

export interface SymbolNode {

  name: string;

  type: string;

  file: string;

  line: number;

}

export interface KnowledgeGraph {

  symbols: Map<string, SymbolNode>;

  imports: Map<string, Set<string>>;

  importedBy: Map<string, Set<string>>;

}

export function buildKnowledgeGraph(

  files: IndexedFile[]

): KnowledgeGraph {

  const graph: KnowledgeGraph = {

    symbols: new Map(),

    imports: new Map(),

    importedBy: new Map(),

  };

  for (const file of files) {

    for (const symbol of file.symbols) {

      graph.symbols.set(

        symbol.name,

        {

          name: symbol.name,

          type: symbol.type,

          file: file.path,

          line: symbol.line,

        }

      );

    }

    graph.imports.set(

      file.path,

      new Set(

        file.imports.map(

          i => i.to

        )

      )

    );

    for (const edge of file.imports) {

      if (

        !graph.importedBy.has(

          edge.to

        )

      ) {

        graph.importedBy.set(

          edge.to,

          new Set()

        );

      }

      graph.importedBy
        .get(edge.to)!
        .add(file.path);

    }

  }

  return graph;

}