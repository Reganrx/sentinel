import type {
  ContextProvider,
} from "./ContextProvider.js";

const providers: ContextProvider<unknown>[] = [];

export function registerContextProvider(
  provider: ContextProvider<unknown>
): void {

  providers.push(provider);

}

export function getContextProviders() {

  return providers;

}

export function clearContextProviders(): void {

  providers.length = 0;

}