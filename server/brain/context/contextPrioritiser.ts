import {
  ContextSource,
  ContextScore,
  PrioritisedContext,
} from "./contextTypes.js";

import {
  CONTEXT_RULES,
} from "./contextRules.js";

export function prioritiseContext(
  message: string
): PrioritisedContext {

  const text =
    message.toLowerCase();

  const scores =
    new Map<ContextSource, number>();

  for (const rule of CONTEXT_RULES) {

    const matched =
      rule.keywords.some(

        keyword =>

          text.includes(keyword)

      );

    if (!matched) {

      continue;

    }

    for (const source of rule.sources) {

      scores.set(

        source,

        (scores.get(source) ?? 0) + 100

      );

    }

  }

  if (scores.size === 0) {

    scores.set(
      ContextSource.Conversation,
      100
    );

    scores.set(
      ContextSource.Profile,
      75
    );

  }

  const result: ContextScore[] =

    [...scores.entries()]

      .map(

        ([source, score]) => ({

          source,

          score,

        })

      )

      .sort(

        (a, b) =>

          b.score - a.score

      );

  return {

    selected:

      result.map(

        item => item.source

      ),

    scores: result,

  };

}