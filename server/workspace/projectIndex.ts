import {
  WorkspaceFile,
  getWorkspace,
} from "./workspace.js";

export type ProjectSymbol = {
  name: string;

  kind:
    | "component"
    | "hook"
    | "context"
    | "class"
    | "function"
    | "api"
    | "type";

  file: string;
};

export type ProjectIndex = {
  files: WorkspaceFile[];
  symbols: ProjectSymbol[];
};

let projectIndex: ProjectIndex = {
  files: [],
  symbols: [],
};

export function buildProjectIndex(): ProjectIndex {

  const workspace =
    getWorkspace();

  if (!workspace) {

    projectIndex = {
      files: [],
      symbols: [],
    };

    return projectIndex;

  }

  projectIndex = {

    files: workspace.files,

    symbols: [],

  };

  return projectIndex;

}

export function getProjectIndex(): ProjectIndex {

  return projectIndex;

}

export function clearProjectIndex() {

  projectIndex = {

    files: [],

    symbols: [],

  };

}