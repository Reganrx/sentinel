import {
  prioritiseContext,
} from "./contextPrioritiser.js";

import {
  ContextSource,
} from "./contextTypes.js";

import {
  ProfileContextProvider,
} from "./providers/ProfileContextProvider.js";

import {
  MemoryContextProvider,
} from "./providers/MemoryContextProvider.js";

import {
  ConversationContextProvider,
} from "./providers/ConversationContextProvider.js";

import {
  WorkspaceContextProvider,
} from "./providers/WorkspaceContextProvider.js";

import {
  WorldContextProvider,
} from "./providers/WorldContextProvider.js";

import type {
  BrainContext,
} from "../brainContext.js";

import type {
  ExecutionResult,
} from "../executor.js";

import type {
  ReasoningState,
} from "../state.js";

const profileProvider =
  new ProfileContextProvider();

const memoryProvider =
  new MemoryContextProvider();

const conversationProvider =
  new ConversationContextProvider();

const workspaceProvider =
  new WorkspaceContextProvider();

const worldProvider =
  new WorldContextProvider();

export function buildContext(

  userMessage: string,

  execution: ExecutionResult,

  reasoning: ReasoningState

): BrainContext {

  const selected =
    prioritiseContext(
      userMessage
    ).selected;

  return {

    profile:
      profileProvider.load(),

    // World state has a complete safe default. Keeping its real shape avoids
    // passing a partial weather object to the prompt builder.
    world:
      worldProvider.load(),

    // Memory is intentionally always available to avoid making the assistant
    // forget user preferences merely because a message omits a trigger word.
    memory:
      memoryProvider.load(),

    conversation:

      conversationProvider.load(),

    workspace:

      selected.includes(
        ContextSource.Workspace
      )

        ? workspaceProvider.load()

        : undefined,

    execution,

    reasoning,

  };

}
