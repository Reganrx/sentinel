import {
  PlannerOutput,
} from "./planner.js";

import {
  TOOL_REGISTRY,
} from "../core/toolRegistry.js";

export function validatePlan(
  plan: unknown
): PlannerOutput {

  if (
    typeof plan !== "object" ||
    plan === null
  ) {

    throw new Error(
      "Planner returned invalid JSON."
    );

  }

  const candidate =
    plan as PlannerOutput;

  if (
    typeof candidate.thought !== "string"
  ) {

    throw new Error(
      "Planner thought missing."
    );

  }

  if (
    !Array.isArray(
      candidate.steps
    )
  ) {

    throw new Error(
      "Planner steps missing."
    );

  }

  const toolNames =
    new Set(

      TOOL_REGISTRY.map(

        tool => tool.name

      )

    );

  candidate.steps =
    candidate.steps.filter(

      step =>

        toolNames.has(

          step.tool

        )

    );

  return candidate;

}