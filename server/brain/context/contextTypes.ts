export enum ContextSource {

  World = "world",

  Location = "location",

  Weather = "weather",

  Time = "time",

  Device = "device",

  Memory = "memory",

  Workspace = "workspace",

  Conversation = "conversation",

  Goals = "goals",

  Execution = "execution",

  Reasoning = "reasoning",

  Profile = "profile",

}

export interface ContextScore {

  source: ContextSource;

  score: number;

}

export interface PrioritisedContext {

  selected: ContextSource[];

  scores: ContextScore[];

}