export interface PlannerStep {

  tool: string;

  arguments: Record<string, unknown>;

}

export interface PlannerOutput {

  thought: string;

  steps: PlannerStep[];

}

export async function createPlan(
  message: string
): Promise<PlannerOutput> {

  console.log("🧠 Planner received:");
  console.log(`Planner request received (${message.length} characters).`);

  return {

    thought: "Testing planner.",

    steps: [],

  };

}
