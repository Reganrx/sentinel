import {
  plan,
} from "../brain/planner.js";

import {
  executePlan,
} from "../brain/executor.js";

import {
  buildContext,
} from "../brain/context/contextBuilder.js";

import {
  createReasoningState,
} from "../brain/state.js";

import type {
  BrainContext,
} from "../brain/brainContext.js";

export async function buildSentinelContext(
  userMessage: string
): Promise<BrainContext> {

  const reasoning =
    createReasoningState(
      userMessage
    );

  const executionPlan =
    await plan(
      userMessage
    );

  const execution =
    await executePlan(
      executionPlan
    );

  return buildContext(

    userMessage,

    execution,

    reasoning

  );

}