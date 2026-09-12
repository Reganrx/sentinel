export interface ReasoningStep {

  iteration: number;

  thought: string;

  tool?: string;

  observation?: string;

}

export interface ReasoningState {

  userMessage: string;

  steps: ReasoningStep[];

  answer?: string;

  finished: boolean;

}

export function createReasoningState(
  userMessage: string
): ReasoningState {

  return {

    userMessage,

    steps: [],

    finished: false,

  };

}

export function addReasoningStep(

  state: ReasoningState,

  step: ReasoningStep

) {

  state.steps.push(step);

}

export function finishReasoning(

  state: ReasoningState,

  answer: string

) {

  state.answer = answer;

  state.finished = true;

}