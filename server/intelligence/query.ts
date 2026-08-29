import {

  KnowledgeGraph,

} from "./knowledge.js";

import {

  searchKnowledge,

} from "./semantic.js";

export function findSymbol(

  graph: KnowledgeGraph,

  name: string

) {

  return graph.symbols.get(name);

}

export function importsOf(

  graph: KnowledgeGraph,

  file: string

) {

  return [

    ...(graph.imports.get(file) ?? [])

  ];

}

export function importedBy(

  graph: KnowledgeGraph,

  file: string

) {

  return [

    ...(graph.importedBy.get(file) ?? [])

  ];

}

export function searchProject(

  graph: KnowledgeGraph,

  query: string

) {

  return searchKnowledge(

    graph,

    query

  );

}