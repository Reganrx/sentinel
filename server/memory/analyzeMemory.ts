import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeMemory(message: string) {

  const response = await client.responses.create({

    model: "gpt-5.5",

    input: [

      {
        role: "system",
        content: `
You decide whether information should be stored as long-term memory.

Only remember information that is useful in future conversations.

Remember:

• Name
• Ongoing projects
• Preferences
• Languages
• Goals
• Frequently used tools

Never remember:

• Greetings
• Temporary requests
• One-off questions
• Sensitive information unless explicitly requested

Reply ONLY with JSON.

Example:

{
  "remember": true,
  "title": "Preferred Language",
  "content": "The user prefers TypeScript."
}
`,
      },

      {
        role: "user",
        content: message,
      },

    ],

  });

  return response.output_text;
}