export type GoalStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface Goal {

  id: string;

  title: string;

  description: string;

  status: GoalStatus;

  progress: number;

  created: number;

  updated: number;

}

const goals = new Map<string, Goal>();

export function createGoal(

  title: string,

  description: string

): Goal {

  const goal: Goal = {

    id: crypto.randomUUID(),

    title,

    description,

    status: "pending",

    progress: 0,

    created: Date.now(),

    updated: Date.now(),

  };

  goals.set(

    goal.id,

    goal

  );

  return goal;

}

export function startGoal(
  id: string
) {

  const goal = goals.get(id);

  if (!goal) {

    return;

  }

  goal.status = "running";

  goal.updated = Date.now();

}

export function updateGoalProgress(

  id: string,

  progress: number

) {

  const goal = goals.get(id);

  if (!goal) {

    return;

  }

  goal.progress = Math.max(
    0,
    Math.min(progress, 100)
  );

  goal.updated = Date.now();

}

export function completeGoal(
  id: string
) {

  const goal = goals.get(id);

  if (!goal) {

    return;

  }

  goal.status = "completed";

  goal.progress = 100;

  goal.updated = Date.now();

}

export function failGoal(
  id: string
) {

  const goal = goals.get(id);

  if (!goal) {

    return;

  }

  goal.status = "failed";

  goal.updated = Date.now();

}

export function getGoal(
  id: string
) {

  return goals.get(id);

}

export function getGoals() {

  return [...goals.values()];

}