import {
  Goal,
  GoalTask,
  TaskStatus,
} from "./goalTypes.js";

let currentGoal: Goal | undefined;

let currentTask: GoalTask | undefined;

export function setCurrentGoal(
  goal: Goal
) {

  currentGoal = goal;

  currentTask = undefined;

}

export function getCurrentGoal() {

  return currentGoal;

}

export function getCurrentTask() {

  return currentTask;

}

export function nextTask(): GoalTask | undefined {

  if (!currentGoal) {

    return;

  }

  const task =
    currentGoal.tasks.find(

      task =>

        task.status ===
        TaskStatus.Pending

    );

  if (!task) {

    currentTask = undefined;

    return;

  }

  task.status =
    TaskStatus.Running;

  currentTask = task;

  return task;

}

export function finishCurrentTask() {

  if (

    !currentTask

  ) {

    return;

  }

  currentTask.status =
    TaskStatus.Completed;

  currentTask.completed =
    Date.now();

  currentTask = undefined;

}

export function clearCurrentGoal() {

  currentGoal = undefined;

  currentTask = undefined;

}