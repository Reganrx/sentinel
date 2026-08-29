import {
  WorldProvider,
} from "./WorldProvider.js";

const providers: WorldProvider[] = [];

export function registerWorldProvider(

  provider: WorldProvider

) {

  providers.push(provider);

  providers.sort(

    (a, b) =>

      a.priority - b.priority

  );

}

export function getWorldProviders() {

  return providers;

}

export function clearWorldProviders() {

  providers.length = 0;

}