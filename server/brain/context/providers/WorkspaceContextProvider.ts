import type {
  ContextProvider,
} from "../ContextProvider.js";

import {
  ContextSource,
} from "../contextTypes.js";

import type {
  BrainWorkspace,
} from "../../brainContext.js";

import {
  getWorkspace,
} from "../../../workspace/workspace.js";

export class WorkspaceContextProvider
  implements ContextProvider<BrainWorkspace | undefined> {

  readonly name =
    "workspace";

  readonly sources = [

    ContextSource.Workspace,

  ];

  load(): BrainWorkspace | undefined {

    const workspace =
      getWorkspace();

    if (!workspace) {

      return undefined;

    }

    return {

      root:
        workspace.root,

      files:
        workspace.files.length,

    };

  }

}