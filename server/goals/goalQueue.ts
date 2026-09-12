import {
  Goal,
  GoalStatus,
} from "./goalTypes.js";

const queue: Goal[] = [];

export function enqueueGoal(
  goal: Goal
) {

  queue.push(goal);

  sortQueue();

}

export function dequeueGoal(): Goal | undefined {

  return queue.shift();

}

export function getCurrentGoal(): Goal | undefined {

  return queue.find(

    goal =>

      goal.status === GoalStatus.Running

  );

}

export function getQueuedGoals(): Goal[] {

  return queue;

}

export function removeGoal(
  id: string
) {

  const index =
    queue.findIndex(

      goal =>

        goal.id === id

    );

  if (

    index !== -1

  ) {

    queue.splice(
      index,
      1
    );

  }

}

export function clearQueue() {

  queue.length = 0;

}

export function sortQueue() {

  queue.sort(

    (a, b) =>

      b.priority - a.priority

  );

}

export function nextGoal(): Goal | undefined {

  const next =
    queue.find(

      goal =>

        goal.status ===
        GoalStatus.Pending

    );

  if (

    next

  ) {

    next.status =
      GoalStatus.Running;

  }

  return next;

}