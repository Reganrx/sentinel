import {
  buildSentinelContext,
} from "./sentinel.js";

import type {
  BrainContext,
} from "../brain/brainContext.js";

export type AgentResult = {

  context: BrainContext;

  thoughts: string[];

};

export async function runAgent(
  userMessage: string
): Promise<AgentResult> {

  const context =
    await buildSentinelContext(
      userMessage
    );

  const thoughts: string[] = [

    "Loaded user profile.",

    "Loaded memories.",

    "Loaded conversation.",

    "Loaded world state.",

    "Loaded workspace.",

    "Built Brain context.",

  ];

  return {

    context,

    thoughts,

  };

}