import client from "./client.js";

export type MemoryExtraction = {

  remember: boolean;

  title?: string;

  content?: string;

  category?:
    | "profile"
    | "project"
    | "preference"
    | "conversation"
    | "workspace"
    | "general";

  importance?: number;

};

export async function extractMemory(

  userMessage: string,

  assistantReply: string

): Promise<MemoryExtraction> {

  const response =
    await client.responses.create({

      model: "gpt-5.5",

      text: {

        format: {

          type: "json_schema",

          name: "memory",

          strict: true,

          schema: {

            type: "object",

            properties: {

              remember: {

                type: "boolean",

              },

              title: {

                type: ["string", "null"],

              },

              content: {

                type: ["string", "null"],

              },

              category: {

                type: ["string", "null"],

                enum: [

                  "profile",

                  "project",

                  "preference",

                  "conversation",

                  "workspace",

                  "general",

                  null,

                ],

              },

              importance: {

                type: ["number", "null"],

              },

            },

            required: [

              "remember",

              "title",

              "content",

              "category",

              "importance",

            ],

            additionalProperties: false,

          },

        },

      },

      input: [

        {

          role: "system",

          content:
            "Extract only long-term memories. Return JSON only.",

        },

        {

          role: "user",

          content: `

User:

${userMessage}

Assistant:

${assistantReply}

`,

        },

      ],

    });

  const extracted = JSON.parse(response.output_text) as MemoryExtraction;
  if (!extracted.remember) return { remember: false };
  if (!extracted.title || !extracted.content || !extracted.category) {
    return { remember: false };
  }
  return extracted;

}
