import { promises as fs } from "fs";
import path from "path";

export type SymbolType =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "component"
  | "hook"
  | "import"
  | "export"
  | "variable";

export interface ProjectSymbol {

  name: string;

  type: SymbolType;

  line: number;

}

const PATTERNS = [

  {
    type: "component" as const,
    regex: /export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)/g,
  },

  {
    type: "component" as const,
    regex: /function\s+([A-Z][A-Za-z0-9_]*)/g,
  },

  {
    type: "hook" as const,
    regex: /function\s+(use[A-Z][A-Za-z0-9_]*)/g,
  },

  {
    type: "hook" as const,
    regex: /const\s+(use[A-Z][A-Za-z0-9_]*)\s*=/g,
  },

  {
    type: "function" as const,
    regex: /function\s+([a-z][A-Za-z0-9_]*)/g,
  },

  {
    type: "function" as const,
    regex: /const\s+([a-z][A-Za-z0-9_]*)\s*=\s*(async\s*)?\(/g,
  },

  {
    type: "class" as const,
    regex: /class\s+([A-Za-z0-9_]+)/g,
  },

  {
    type: "interface" as const,
    regex: /interface\s+([A-Za-z0-9_]+)/g,
  },

  {
    type: "type" as const,
    regex: /type\s+([A-Za-z0-9_]+)/g,
  },

  {
    type: "variable" as const,
    regex: /const\s+([A-Za-z0-9_]+)/g,
  },

];

export async function extractSymbols(
  filePath: string
): Promise<ProjectSymbol[]> {

  const extension =
    path.extname(filePath);

  if (
    ![
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
    ].includes(extension)
  ) {

    return [];

  }

  const source =
    await fs.readFile(
      filePath,
      "utf8"
    );

  const symbols: ProjectSymbol[] = [];

  for (const pattern of PATTERNS) {

    let match: RegExpExecArray | null;

    while (
      (match =
        pattern.regex.exec(source))
    ) {

      const line =
        source
          .slice(0, match.index)
          .split("\n").length;

      symbols.push({

        name: match[1],

        type: pattern.type,

        line,

      });

    }

  }

  return symbols.sort(
    (a, b) => a.line - b.line
  );

}