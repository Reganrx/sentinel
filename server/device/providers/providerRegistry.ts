import type {
  DeviceProvider,
} from "./DeviceProvider.js";

const providers: DeviceProvider[] = [];

export function registerDeviceProvider(
  provider: DeviceProvider
): void {

  providers.push(
    provider
  );

  providers.sort(

    (a, b) =>

      a.priority - b.priority

  );

}

export function getDeviceProviders(): DeviceProvider[] {

  return providers;

}

export function clearDeviceProviders(): void {

  providers.length = 0;

}