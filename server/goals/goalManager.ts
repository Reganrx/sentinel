import crypto from "crypto";

import {
  Goal,
  GoalStatus,
  GoalTask,
  TaskStatus,
} from "./goalTypes.js";

import {
  addGoal,
  getActiveGoals,
  getGoal,
  updateGoal,
} from "./goalState.js";

import {
  enqueueGoal,
  getCurrentGoal,
  nextGoal,
} from "./goalQueue.js";

import {
  setCurrentGoal,
  nextTask,
  getCurrentTask,
  finishCurrentTask,
} from "./taskQueue.js";

import {
  runCurrentTask,
} from "./goalRunner.js";

export function createGoal(
  title: string,
  description: string,
  priority = 5
): Goal {

  const now = Date.now();

  const goal: Goal = {

    id: crypto.randomUUID(),

    title,

    description,

    status: GoalStatus.Pending,

    priority,

    progress: 0,

    created: now,

    updated: now,

    tasks: [],

  };

  addGoal(goal);

  enqueueGoal(goal);

  if (!getCurrentGoal()) {

    startNextGoal();

  }

  return goal;

}

export function startNextGoal(): Goal | undefined {

  const goal =
    nextGoal();

  if (!goal) {

    return;

  }

  goal.status =
    GoalStatus.Running;

  goal.updated =
    Date.now();

  updateGoal(goal);

  setCurrentGoal(goal);

  nextTask();

  runCurrentTask();

  return goal;

}

export function addTask(
  goalId: string,
  title: string,
  description = ""
): GoalTask | undefined {

  const goal =
    getGoal(goalId);

  if (!goal) {

    return;

  }

  const task: GoalTask = {

    id: crypto.randomUUID(),

    title,

    description,

    status: TaskStatus.Pending,

    created: Date.now(),

  };

  goal.tasks.push(task);

  updateProgress(goal);

  updateGoal(goal);

  return task;

}

export function completeTask(
  goalId: string,
  taskId: string
) {

  const goal =
    getGoal(goalId);

  if (!goal) {

    return;

  }

  const task =
    goal.tasks.find(
      t => t.id === taskId
    );

  if (!task) {

    return;

  }

  task.status =
    TaskStatus.Completed;

  task.completed =
    Date.now();

  finishCurrentTask();

  updateProgress(goal);

  updateGoal(goal);

  if (goal.status !== GoalStatus.Completed) {

    nextTask();

    if (getCurrentTask()) {

      runCurrentTask();

    }

  }

}

function updateProgress(
  goal: Goal
) {

  if (!goal.tasks.length) {

    goal.progress = 0;

    return;

  }

  const completed =
    goal.tasks.filter(

      task =>

        task.status ===
        TaskStatus.Completed

    ).length;

  goal.progress =
    Math.round(

      completed /
      goal.tasks.length *
      100

    );

  goal.updated =
    Date.now();

  if (goal.progress === 100) {

    goal.status =
      GoalStatus.Completed;

    startNextGoal();

  }

}

export function listGoals() {

  return getActiveGoals();

}