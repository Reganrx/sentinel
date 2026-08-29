import {
  getCurrentGoal,
  getCurrentTask,
  nextTask,
  finishCurrentTask,
} from "./taskQueue.js";

import {
  runAgent,
} from "../brain/agent.js";

import {
  info,
  error,
} from "../core/logger.js";

let running = false;

export async function runCurrentTask() {

  if (running) {

    return;

  }

  const goal =
    getCurrentGoal();

  const task =
    getCurrentTask();

  if (!goal || !task) {

    info(
      "GoalRunner",
      "No active goal or task."
    );

    return;

  }

  running = true;

  info(
    "GoalRunner",
    `Running task "${task.title}"`
  );

  try {

    const response =
      await runAgent({

        source: "goal",

        message: `

Goal
${goal.title}

Description
${goal.description}

Current Task
${task.title}

Task Description
${task.description}

Complete ONLY this task.

`,

      });

    info(
      "GoalRunner",
      "Task completed."
    );

    info(
      "GoalRunner",
      response.reply
    );

    finishCurrentTask();

    const next =
      nextTask();

    if (next) {

      running = false;

      await runCurrentTask();

      return;

    }

    info(
      "GoalRunner",
      "Goal completed."
    );

  }

  catch (err) {

    error(

      "GoalRunner",

      "Task execution failed.",

      err

    );

  }

  finally {

    running = false;

  }

}