import {
  plan,
} from "./planner.js";

import {
  executePlan,
} from "./executor.js";

import {
  buildContext,
} from "./context/contextBuilder.js";

import {
  buildBrainPrompt,
} from "./prompt.js";

import {
  createReasoningState,
} from "./state.js";

import {
  getAIResponse,
  handleDeveloperSourceRequest,
} from "../services/openai.js";

import {
  info,
  error,
} from "../core/logger.js";

import {
  plannerCall,
  executorCall,
  openAICall,
} from "../core/health.js";

export async function reason(
  userMessage: string
): Promise<string> {

  const developerReply = await handleDeveloperSourceRequest(userMessage);
  if (developerReply) return developerReply;

  info(
    "Reasoner",
    "Starting reasoning."
  );

  const reasoning =
    createReasoningState(
      userMessage
    );

  try {

    plannerCall();

    info(
      "Planner",
      "Creating execution plan."
    );

    const planner =
      await plan(
        userMessage
      );

    info(
      "Planner",
      `Generated ${planner.steps.length} step(s).`
    );

    executorCall();

    info(
      "Executor",
      "Executing plan."
    );

    const execution =
      await executePlan(
        planner
      );

    info(
      "Executor",
      `Completed ${execution.results.length} tool(s).`
    );

    info(
      "Context",
      "Building Brain context."
    );

    const context =
      buildContext(

        userMessage,

        execution,

        reasoning

      );

    info(
      "Prompt",
      "Building prompt."
    );

    const prompt =
      buildBrainPrompt(

        userMessage,

        context

      );

    openAICall();

    info(
      "OpenAI",
      "Sending request."
    );

    const reply =
      await getAIResponse(
        prompt
      );

    info(
      "OpenAI",
      "Response received."
    );

    info(
      "Reasoner",
      "Finished."
    );

    return reply;

  }

  catch (err) {

    error(
      "Reasoner",
      "Reasoning failed.",
      err
    );

    throw err;

  }

}
