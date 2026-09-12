import {
  createPlan,
  PlannerOutput,
} from "../services/planner.js";

export type PlannerResult =
  PlannerOutput;

export async function plan(
  message: string
): Promise<PlannerResult> {

  return await createPlan(
    message
  );

}