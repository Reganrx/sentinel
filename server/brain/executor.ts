import {
  PlannerResult,
} from "./planner.js";

import {
  TOOL_REGISTRY,
} from "../core/toolRegistry.js";

export type ToolExecution = {

  tool: string;

  result: unknown;

};

export type ExecutionResult = {

  thought: string;

  results: ToolExecution[];

};

export async function executePlan(

  plan: PlannerResult,

  context: {

    workspaceRoot?: string;

  } = {}

): Promise<ExecutionResult> {

  const results: ToolExecution[] = [];

  for (

    const step of plan.steps

  ) {

    const tool =

      TOOL_REGISTRY.find(

        t => t.name === step.tool

      );

    if (!tool) {

      results.push({

        tool: step.tool,

        result: `Unknown tool '${step.tool}'.`,

      });

      continue;

    }

    try {

      const output =
        await tool.execute(

          step.arguments,

          context

        );

      results.push({

        tool: tool.name,

        result: output,

      });

    }

    catch (error) {

      results.push({

        tool: tool.name,

        result:
          error instanceof Error
            ? error.message
            : "Unknown tool error.",

      });

    }

  }

  return {

    thought: plan.thought,

    results,

  };

}