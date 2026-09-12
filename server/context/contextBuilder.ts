import {
  SentinelContext,
} from "./contextTypes.js";

import {
  getConversation,
  ConversationMessage,
} from "../memory/conversation.js";

import {
  getLongTermMemory,
  LongTermMemory,
} from "../memory/longTermMemory.js";

import {
  listGoals,
} from "../goals/goalManager.js";

import {
  Goal,
} from "../goals/goalTypes.js";

import {
  getCapabilities,
} from "../capabilities/index.js";

import {
  getCurrentWorld,
} from "../world/index.js";

export async function buildContext(
  userMessage: string
): Promise<SentinelContext> {

  const conversation = getConversation()
    .map(
      (message: ConversationMessage) =>
        `${message.role}: ${message.content}`
    )
    .join("\n");

  const memories = getLongTermMemory()
    .map(
      (memory: LongTermMemory) =>
        `${memory.title}: ${memory.content}`
    )
    .join("\n");

  const goals = listGoals()
    .map(
      (goal: Goal) =>
        `${goal.title} (${goal.status})`
    )
    .join("\n");

  return {

    timestamp:
      new Date().toISOString(),

    userMessage,

    conversation,

    memories,

    goals,

    workspace: "",

    capabilities:
      getCapabilities(),

    world:
      getCurrentWorld(),

  };

}