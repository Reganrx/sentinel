import type {
  ContextProvider,
} from "../ContextProvider.js";

import {
  ContextSource,
} from "../contextTypes.js";

import type {
  LongTermMemory,
} from "../../../memory/longTermMemory.js";

import {
  getLongTermMemory,
} from "../../../memory/longTermMemory.js";

export class MemoryContextProvider
  implements ContextProvider<LongTermMemory[]> {

  readonly name =
    "memory";

  readonly sources = [

    ContextSource.Memory,

  ];

  load(): LongTermMemory[] {

    return getLongTermMemory();

  }

}