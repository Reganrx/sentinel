/**
 * Device Engine Configuration
 *
 * Central configuration for the Sentinel Device Engine.
 * All provider priorities, refresh intervals, default values,
 * limits and feature flags should live here.
 */

export const DEVICE_PROVIDER_PRIORITY = {

  CPU: 100,

  MEMORY: 200,

  NETWORK: 300,

  STORAGE: 400,

  BATTERY: 500,

  DISPLAY: 600,

  GPU: 700,

  BLUETOOTH: 800,

  AUDIO: 900,

  USB: 1000,

  CAMERA: 1100,

  PROCESSES: 1200,

  SERVICES: 1300,

  WINDOWS: 1400,

  APPLICATIONS: 1500,

} as const;

export const DEVICE_REFRESH = {

  /**
   * How often the Device Manager refreshes all providers.
   */
  INTERVAL: 5000,

  /**
   * Maximum time a provider may take before being considered stalled.
   */
  PROVIDER_TIMEOUT: 10000,

} as const;

export const DEVICE_DEFAULTS = {

  CPU_USAGE: 0,

  GPU_USAGE: 0,

  MEMORY_USAGE: 0,

  BATTERY_LEVEL: 0,

  DISPLAY_REFRESH_RATE: 60,

  DISPLAY_SCALE: 100,

} as const;

export const DEVICE_LIMITS = {

  MAX_PROVIDER_RETRIES: 3,

} as const;

export const DEVICE_FEATURES = {

  CPU: true,

  MEMORY: true,

  NETWORK: true,

  STORAGE: true,

  BATTERY: true,

  DISPLAY: true,

  GPU: true,

  BLUETOOTH: true,

  AUDIO: true,

  USB: true,

  CAMERA: true,

  PROCESSES: true,

  SERVICES: true,

  WINDOWS: true,

  APPLICATIONS: true,

} as const;