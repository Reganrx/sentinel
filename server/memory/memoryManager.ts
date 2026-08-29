import {
  addMemory,
  getLongTermMemory,
  type MemoryCategory,
} from "./longTermMemory.js";

export type MemoryCandidate = {

  title: string;

  content: string;

  category: MemoryCategory;

  importance: number;

};

const RULES = [

  {

    category: "profile" as const,

    importance: 10,

    patterns: [

      /my name is (.+)/i,

      /i am (.+)/i,

    ],

    title: "User Profile",

  },

  {

    category: "preference" as const,

    importance: 8,

    patterns: [

      /i prefer (.+)/i,

      /i like (.+)/i,

      /always (.+)/i,

    ],

    title: "User Preference",

  },

  {

    category: "project" as const,

    importance: 9,

    patterns: [

      /i am building (.+)/i,

      /my project is (.+)/i,

      /working on (.+)/i,

    ],

    title: "Project",

  },

];

export function analyseMemory(

  message: string

): MemoryCandidate | null {

  for (const rule of RULES) {

    for (const pattern of rule.patterns) {

      if (

        pattern.test(message)

      ) {

        return {

          title: rule.title,

          content: message,

          category: rule.category,

          importance: rule.importance,

        };

      }

    }

  }

  return null;

}

export function rememberIfImportant(

  message: string

) {

  const candidate =

    analyseMemory(message);

  if (!candidate) {

    return false;

  }

  const exists =

    getLongTermMemory().some(

      memory =>

        memory.content ===

        candidate.content

    );

  if (exists) {

    return false;

  }

  addMemory(

    candidate.title,

    candidate.content,

    candidate.category,

    candidate.importance

  );

  console.log(

    "🧠 New memory stored:",

    candidate.title

  );

  return true;

}