import {
  Goal,
} from "./goalTypes.js";

const activeGoals: Goal[] = [];

const completedGoals: Goal[] = [];

export function getActiveGoals(): Goal[] {

  return activeGoals;

}

export function getCompletedGoals(): Goal[] {

  return completedGoals;

}

export function getGoal(
  id: string
): Goal | undefined {

  return activeGoals.find(
    goal => goal.id === id
  );

}

export function addGoal(
  goal: Goal
) {

  activeGoals.push(goal);

}

export function updateGoal(
  goal: Goal
) {

  const index =
    activeGoals.findIndex(
      g => g.id === goal.id
    );

  if (index !== -1) {

    activeGoals[index] = goal;

  }

}

export function completeGoal(
  id: string
) {

  const index =
    activeGoals.findIndex(
      goal => goal.id === id
    );

  if (index === -1) {

    return;

  }

  const goal =
    activeGoals.splice(
      index,
      1
    )[0];

  completedGoals.push(goal);

}

export function removeGoal(
  id: string
) {

  const index =
    activeGoals.findIndex(
      goal => goal.id === id
    );

  if (index !== -1) {

    activeGoals.splice(
      index,
      1
    );

  }

}

export function clearGoals() {

  activeGoals.length = 0;

  completedGoals.length = 0;

}