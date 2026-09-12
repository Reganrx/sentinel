import {
  reason,
} from "./reasoner.js";

import {
  info,
  error,
} from "../core/logger.js";

import {
  startRequest,
  finishRequest,
  failRequest,
} from "../core/health.js";

export interface AgentRequest {

  source:
    | "chat"
    | "goal"
    | "voice"
    | "plugin"
    | "scheduler";

  message: string;

}

export interface AgentResponse {

  reply: string;

}

export async function runAgent(
  request: AgentRequest
): Promise<AgentResponse> {

  const started =
    startRequest();

  info(
    "Agent",
    `${request.source} request received.`
  );

  try {

    const reply =
      await reason(
        request.message
      );

    finishRequest(
      started
    );

    return {

      reply,

    };

  }

  catch (err) {

    failRequest(err);

    error(
      "Agent",
      "Agent failed.",
      err
    );

    throw err;

  }

}