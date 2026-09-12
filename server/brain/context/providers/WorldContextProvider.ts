import type {
  ContextProvider,
} from "../ContextProvider.js";

import {
  ContextSource,
} from "../contextTypes.js";

import type {
  WorldState,
} from "../../../world/worldTypes.js";

import {
  getCurrentWorld,
} from "../../../world/worldManager.js";

export class WorldContextProvider
  implements ContextProvider<WorldState> {

  readonly name =
    "world";

  readonly sources = [

    ContextSource.World,

    ContextSource.Location,

    ContextSource.Weather,

    ContextSource.Time,

    ContextSource.Device,

  ];

  load(): WorldState {

    return getCurrentWorld();

  }

}