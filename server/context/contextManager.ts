import {
  buildContext,
} from "./contextBuilder.js";

import {
  SentinelContext,
} from "./contextTypes.js";

export async function getContext(
  userMessage: string
): Promise<SentinelContext> {

  return buildContext(
    userMessage
  );

}