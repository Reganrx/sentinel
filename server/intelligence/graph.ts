import { promises as fs } from "fs";
import path from "path";

export interface ImportEdge {

  from: string;

  to: string;

  source: string;

}

const IMPORT_REGEX =

  /import\s+(?:[\w*\s{},]*)\s+from\s+["'](.+?)["']/g;

function normalizeImport(

  currentFile: string,

  imported: string

) {

  if (

    imported.startsWith(".")

  ) {

    return path.normalize(

      path.join(

        path.dirname(currentFile),

        imported

      )

    );

  }

  return imported;

}

export async function extractImports(

  file: string

): Promise<ImportEdge[]> {

  const extension =
    path.extname(file);

  if (

    ![".ts", ".tsx", ".js", ".jsx"].includes(

      extension

    )

  ) {

    return [];

  }

  const source =
    await fs.readFile(

      file,

      "utf8"

    );

  const imports: ImportEdge[] = [];

  let match: RegExpExecArray | null;

  while (

    (match = IMPORT_REGEX.exec(source))

  ) {

    imports.push({

      from: file,

      to: normalizeImport(

        file,

        match[1]

      ),

      source: match[1],

    });

  }

  return imports;

}