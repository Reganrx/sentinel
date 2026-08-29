import {
  addTask,
} from "./goalManager.js";

import {
  Goal,
} from "./goalTypes.js";

export function planGoal(
  goal: Goal
) {

  const title =
    goal.title.toLowerCase();

  if (
    title.includes("build")
  ) {

    addTask(
      goal.id,
      "Analyse existing system"
    );

    addTask(
      goal.id,
      "Design architecture"
    );

    addTask(
      goal.id,
      "Implement solution"
    );

    addTask(
      goal.id,
      "Test implementation"
    );

    addTask(
      goal.id,
      "Verify build"
    );

    return;

  }

  if (
    title.includes("fix")
  ) {

    addTask(
      goal.id,
      "Locate issue"
    );

    addTask(
      goal.id,
      "Identify cause"
    );

    addTask(
      goal.id,
      "Implement fix"
    );

    addTask(
      goal.id,
      "Test fix"
    );

    return;

  }

  if (
    title.includes("refactor")
  ) {

    addTask(
      goal.id,
      "Inspect current implementation"
    );

    addTask(
      goal.id,
      "Identify improvements"
    );

    addTask(
      goal.id,
      "Refactor code"
    );

    addTask(
      goal.id,
      "Run tests"
    );

    addTask(
      goal.id,
      "Review changes"
    );

    return;

  }

  addTask(
    goal.id,
    "Understand request"
  );

  addTask(
    goal.id,
    "Create plan"
  );

  addTask(
    goal.id,
    "Execute work"
  );

  addTask(
    goal.id,
    "Verify result"
  );

}