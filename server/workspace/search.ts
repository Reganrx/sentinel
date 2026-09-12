import path from "path";

import {
  getWorkspace,
  WorkspaceFile,
} from "./workspace.js";

export type SearchResult = {

  query: string;

  matches: WorkspaceFile[];

};

export function searchProject(
  query: string
): SearchResult {

  const workspace =
    getWorkspace();

  if (!workspace) {

    return {

      query,

      matches: [],

    };

  }

  const search =
    query.toLowerCase();

  const matches =
    workspace.files.filter(file => {

      const name =
        file.name.toLowerCase();

      const filePath =
        file.path.toLowerCase();

      return (

        name.includes(search) ||

        filePath.includes(search)

      );

    });

  matches.sort((a, b) => {

    const aName =
      path.basename(a.path);

    const bName =
      path.basename(b.path);

    return aName.localeCompare(bName);

  });

  return {

    query,

    matches,

  };

}