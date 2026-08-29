import {
  WorldState,
} from "../world/worldTypes.js";

import {
  Capability,
} from "../capabilities/capabilityTypes.js";

export interface SentinelContext {

  timestamp: string;

  userMessage: string;

  conversation: string;

  memories: string;

  goals: string;

  workspace: string;

  capabilities: Capability[];

  world: WorldState;

}