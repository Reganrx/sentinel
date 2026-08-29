import {
  ReasoningState,
} from "./state.js";

import {
  ExecutionResult,
} from "./executor.js";

import {
  WorldState,
} from "../world/worldTypes.js";

import {
  LongTermMemory,
} from "../memory/longTermMemory.js";

import {
  ConversationMessage,
} from "../memory/conversation.js";

export interface BrainProfile {

  name: string;

  assistantName: string;

  preferredLanguage: string;

  preferredStyle: string;

}

export interface BrainWorkspace {

  root: string;

  files: number;

}

export interface BrainContext {

  profile: BrainProfile;

  world: WorldState;

  memory: LongTermMemory[];

  conversation: ConversationMessage[];

  workspace?: BrainWorkspace;

  execution: ExecutionResult;

  reasoning: ReasoningState;

}