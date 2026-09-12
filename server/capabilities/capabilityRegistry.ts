import {
  Capability,
  CapabilityCategory,
} from "./capabilityTypes.js";

const capabilities = new Map<
  string,
  Capability
>();

export function registerCapability(
  capability: Capability
) {

  capabilities.set(
    capability.id,
    capability
  );

}

export function unregisterCapability(
  id: string
) {

  capabilities.delete(id);

}

export function getCapability(
  id: string
): Capability | undefined {

  return capabilities.get(id);

}

export function getCapabilities(): Capability[] {

  return Array.from(
    capabilities.values()
  );

}

export function getCapabilitiesByCategory(
  category: CapabilityCategory
): Capability[] {

  return getCapabilities().filter(

    capability =>

      capability.category ===
      category

  );

}

export function hasCapability(
  id: string
): boolean {

  return capabilities.has(id);

}

export function clearCapabilities() {

  capabilities.clear();

}