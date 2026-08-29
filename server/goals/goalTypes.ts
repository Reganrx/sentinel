export enum GoalStatus {

  Pending = "pending",

  Running = "running",

  Completed = "completed",

  Failed = "failed",

  Cancelled = "cancelled",

}

export enum TaskStatus {

  Pending = "pending",

  Running = "running",

  Completed = "completed",

  Failed = "failed",

}

export interface GoalTask {

  id: string;

  title: string;

  description: string;

  status: TaskStatus;

  created: number;

  completed?: number;

}

export interface Goal {

  id: string;

  title: string;

  description: string;

  status: GoalStatus;

  priority: number;

  progress: number;

  created: number;

  updated: number;

  tasks: GoalTask[];

}