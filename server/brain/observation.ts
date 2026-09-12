import {
  ReasoningState,
} from "./state.js";

export function buildObservation(
  state: ReasoningState
): string {

  if (state.steps.length === 0) {

    return "";

  }

  const sections: string[] = [];

  sections.push(`

==================================================
REASONING
==================================================

`);

  for (const step of state.steps) {

    sections.push(`

Iteration ${step.iteration}

Thought

${step.thought}

${step.tool ? `Tool

${step.tool}

` : ""}

${step.observation ? `Observation

${step.observation}

` : ""}

`);

  }

  return sections.join("\n");

}