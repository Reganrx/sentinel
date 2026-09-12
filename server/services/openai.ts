import client from "./client.js";
import SENTINEL_PROMPT from "../prompts/sentinel.js";
import {
  approveSourceProposal,
  proposeSourceWrite,
  readSourceFile,
  rejectSourceProposal,
  searchSource,
} from "../source/sourceControl.js";
import { hasActiveDeveloperSession } from "../security/developerAccess.js";

const developerTools = [
  { type: "function" as const, name: "source_search", description: "Search Sentinel Personal source code for text or a feature.", strict: true, parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
  { type: "function" as const, name: "source_read", description: "Read one relative file from Sentinel Personal source.", strict: true, parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false } },
  { type: "function" as const, name: "source_propose_write", description: "Stage a complete replacement for one source file. This never writes directly and returns a proposal ID requiring explicit user approval.", strict: true, parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"], additionalProperties: false } },
];

async function executeDeveloperTool(name: string, rawArguments: string) {
  if (!hasActiveDeveloperSession()) throw new Error("Developer Mode is locked or expired.");
  const args = JSON.parse(rawArguments) as { query?: string; path?: string; content?: string };
  if (name === "source_search") return searchSource(String(args.query ?? ""));
  if (name === "source_read") return readSourceFile(String(args.path ?? ""));
  if (name === "source_propose_write") return proposeSourceWrite(String(args.path ?? ""), String(args.content ?? ""));
  throw new Error(`Unknown developer tool: ${name}`);
}

export async function handleDeveloperSourceRequest(message: string): Promise<string | null> {
  if (!hasActiveDeveloperSession()) return null;

  const developerMentioned = /\b(?:codex|developer|devloper|develop(?:er)?|dev\s*mode)\b/i.test(message);
  if (developerMentioned && /\b(?:unlocked?|active|available|anything new|what can|can (?:you|now)|use codex|access|source)\b/i.test(message) && !/\b(?:read|search|find|change|edit|fix|update|write|refactor)\b/i.test(message)) {
    return "Developer Mode is active and Codex developer capability is available. I can search and read Sentinel Personal's live source in C:\\Projects\\jarvis-os, explain implementations and investigate faults. If you ask for a change, I will inspect the relevant files and create a proposal; no source file is written until you explicitly approve it.";
  }

  const approval = message.trim().match(/^approve\s+(?:source\s+)?proposal\s+([0-9a-f-]{36})[.!]?$/i);
  if (approval) {
    const result = await approveSourceProposal(approval[1]);
    return `Approved and wrote ${result.path}. The source change is now saved.`;
  }
  const rejection = message.trim().match(/^(?:reject|cancel)\s+(?:source\s+)?proposal\s+([0-9a-f-]{36})[.!]?$/i);
  if (rejection) return rejectSourceProposal(rejection[1]) ? "The source proposal was cancelled without writing any file." : "That proposal was not found or had already expired.";

  if (!developerMentioned && !/\b(source|code|file|component|function|class|typescript|tsx|css|backend|frontend|implementation|repository|repo)\b/i.test(message)) return null;

  let response = await client.responses.create({
    model: "gpt-5.5",
    instructions: `${SENTINEL_PROMPT}\nDeveloper Mode is unlocked. You are operating against Sentinel Personal's live source workspace. Use the supplied tools to inspect the relevant source before every code, implementation, regression or capability answer. Never claim there is no workspace or that source access is unavailable. Lead with the useful result, identify the relative files inspected, and explain the evidence in concise British English. You cannot expose private chain-of-thought; if asked, briefly offer a concise rationale grounded in visible source and continue helping. For requested edits, inspect the relevant file first and use source_propose_write; never claim a proposal is applied. Tell the user the proposal ID and that they can approve it by saying: approve proposal <id>.`,
    input: message,
    tools: developerTools,
  });

  for (let turn = 0; turn < 8; turn += 1) {
    const calls = response.output.filter(item => item.type === "function_call");
    if (!calls.length) return response.output_text || "I inspected the source but could not produce a response.";
    const outputs = await Promise.all(calls.map(async call => {
      try { return { type: "function_call_output" as const, call_id: call.call_id, output: JSON.stringify(await executeDeveloperTool(call.name, call.arguments)) }; }
      catch (error) { return { type: "function_call_output" as const, call_id: call.call_id, output: JSON.stringify({ error: error instanceof Error ? error.message : "Developer tool failed." }) }; }
    }));
    response = await client.responses.create({ model: "gpt-5.5", previous_response_id: response.id, input: outputs, tools: developerTools });
  }
  return "I reached the safe Developer Mode tool limit. Narrow the request to a specific file or feature.";
}

export async function getAIResponse(
  prompt: string
): Promise<string> {

  try {

    console.log("========== OPENAI ==========");
    console.log("Sending request...");

    const response =
      await client.responses.create({

        model: "gpt-5.5",

        input: [
          {
            role: "system",
            content: SENTINEL_PROMPT,
          },
          {
            role: "user",
            content: prompt,
          },
        ],

      });

    console.log("Response received.");

    return response.output_text ??
      "No response.";

  }

  catch (error) {

    console.error("OPENAI ERROR:");

    console.error(error);

    if (error instanceof Error) {

      console.error(error.message);
      console.error(error.stack);

    }

    throw error;

  }

}
