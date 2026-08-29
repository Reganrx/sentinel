export interface BrainHealth {

  requests: number;

  successes: number;

  failures: number;

  plannerCalls: number;

  executorCalls: number;

  openAICalls: number;

  totalResponseTime: number;

  averageResponseTime: number;

  lastError?: string;

}

const health: BrainHealth = {

  requests: 0,

  successes: 0,

  failures: 0,

  plannerCalls: 0,

  executorCalls: 0,

  openAICalls: 0,

  totalResponseTime: 0,

  averageResponseTime: 0,

};

export function startRequest() {

  health.requests++;

  return Date.now();

}

export function finishRequest(

  started: number

) {

  health.successes++;

  const elapsed =
    Date.now() - started;

  health.totalResponseTime +=
    elapsed;

  health.averageResponseTime =
    health.totalResponseTime /
    health.successes;

}

export function failRequest(

  error: unknown

) {

  health.failures++;

  if (

    error instanceof Error

  ) {

    health.lastError =
      error.message;

  }

}

export function plannerCall() {

  health.plannerCalls++;

}

export function executorCall() {

  health.executorCalls++;

}

export function openAICall() {

  health.openAICalls++;

}

export function getBrainHealth() {

  return health;

}