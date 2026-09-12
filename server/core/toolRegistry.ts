import { searchProject } from "../workspace/search.js";
import { readWorkspaceFile } from "../workspace/fileReader.js";
import { retrieveMemories } from "../memory/searchMemory.js";
import { rememberMemory } from "../memory/rememberMemory.js";
import {
  proposeSourceWrite,
  readSourceFile,
  searchSource,
} from "../source/sourceControl.js";
import { hasActiveDeveloperSession } from "../security/developerAccess.js";

export type ToolContext = {
  workspaceRoot?: string;
};

export type ToolDefinition = {
  name: string;

  description: string;

  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };

  execute: (
    args: any,
    context: ToolContext
  ) => Promise<any>;
};

export const TOOL_REGISTRY: ToolDefinition[] = [

  {

    name: "source_search",

    description:
      "Search Sentinel's own project source. Protected files and dependency folders are excluded.",

    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Text to search for." } },
      required: ["query"],
    },

    execute: async (args) => {
      if (!hasActiveDeveloperSession()) throw new Error("Developer Mode is locked.");
      return searchSource(args.query);
    },

  },

  {

    name: "source_read",

    description:
      "Read a relative file from Sentinel's own project source.",

    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Relative project path." } },
      required: ["path"],
    },

    execute: async (args) => {
      if (!hasActiveDeveloperSession()) throw new Error("Developer Mode is locked.");
      return readSourceFile(args.path);
    },

  },

  {

    name: "source_propose_write",

    description:
      "Create a proposed source-file replacement. This does not write anything; the user must explicitly approve it.",

    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative project path." },
        content: { type: "string", description: "Complete proposed file content." },
      },
      required: ["path", "content"],
    },

    execute: async (args) => {
      if (!hasActiveDeveloperSession()) throw new Error("Developer Mode is locked.");
      return proposeSourceWrite(args.path, args.content);
    },

  },

  {

    name: "search_project",

    description:
      "Search the current workspace for files.",

    parameters: {

      type: "object",

      properties: {

        query: {

          type: "string",

          description:
            "Search query.",

        },

      },

      required: [

        "query",

      ],

    },

    execute: async (args) => {

      return searchProject(

        args.query

      );

    },

  },

  {

    name: "read_file",

    description:
      "Read a workspace file.",

    parameters: {

      type: "object",

      properties: {

        path: {

          type: "string",

        },

      },

      required: [

        "path",

      ],

    },

    execute: async (args) => {

      return readWorkspaceFile(

        args.path

      );

    },

  },

  {

    name: "memory_search",

    description:
      "Search Sentinel's long-term memory.",

    parameters: {

      type: "object",

      properties: {

        query: {

          type: "string",

        },

      },

      required: [

        "query",

      ],

    },

    execute: async (args) => {

      return retrieveMemories(

        args.query

      );

    },

  },

  {

    name: "remember",

    description:
      "Store new long-term information.",

    parameters: {

      type: "object",

      properties: {

        title: {

          type: "string",

        },

        content: {

          type: "string",

        },

      },

      required: [

        "title",

        "content",

      ],

    },

    execute: async (args) => {

      return rememberMemory(

        args.title,

        args.content

      );

    },

  },

];
