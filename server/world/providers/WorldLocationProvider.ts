import {
  WorldProvider,
} from "./WorldProvider.js";

import {
  refreshLocation,
} from "../location.js";

export class WorldLocationProvider
  implements WorldProvider {

  readonly name =
    "location";

  readonly priority =
    10;

  async refresh(): Promise<void> {

    await refreshLocation();

  }

}