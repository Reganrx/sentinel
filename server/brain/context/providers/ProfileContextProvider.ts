import type {
  ContextProvider,
} from "../ContextProvider.js";

import {
  ContextSource,
} from "../contextTypes.js";

import type {
  BrainProfile,
} from "../../brainContext.js";

import {
  getUserProfile,
} from "../../../memory/profile.js";

export class ProfileContextProvider
  implements ContextProvider<BrainProfile> {

  readonly name =
    "profile";

  readonly sources = [

    ContextSource.Profile,

  ];

  load(): BrainProfile {

    return getUserProfile();

  }

}