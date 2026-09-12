import type {
  BatteryState,
  CPUState,
  DeviceState,
  DisplayState,
  GPUState,
  HardwareState,
  MemoryState,
  NetworkState,
  StorageDrive,
} from "./deviceTypes.js";

const state: DeviceState = {

  cpu: {

    model: "",

    cores: 0,

    threads: 0,

    usage: 0,

    speed: 0,

    loadAverage: [],

  },

  gpu: {

    model: "",

    usage: 0,

    memoryUsed: 0,

    memoryTotal: 0,

  },

  memory: {

    total: 0,

    used: 0,

    free: 0,

  },

  storage: [],

  battery: {

    present: false,

    charging: false,

    level: 0,

  },

  network: {

    connected: false,

    interface: "",

    localIP: "",

  },

  display: {

    width: 0,

    height: 0,

    refreshRate: 0,

    scale: 100,

    primary: true,

  },

  hardware: { sensorProvider: "Windows", sensors: [], disks: [], uptimeSeconds: 0, updatedAt: "" },

};

export function getDeviceState(): DeviceState {

  return state;

}

export function updateDeviceState(
  partial: Partial<DeviceState>
): void {

  Object.assign(
    state,
    partial
  );

}

export function updateCPUState(
  cpu: CPUState
): void {

  state.cpu = cpu;

}

export function updateGPUState(
  gpu: GPUState
): void {

  state.gpu = gpu;

}

export function updateMemoryState(
  memory: MemoryState
): void {

  state.memory = memory;

}

export function updateStorageState(
  storage: StorageDrive[]
): void {

  state.storage = storage;

}

export function updateBatteryState(
  battery: BatteryState
): void {

  state.battery = battery;

}

export function updateNetworkState(
  network: NetworkState
): void {

  state.network = network;

}

export function updateDisplayState(
  display: DisplayState
): void {

  state.display = display;

}

export function updateHardwareState(hardware: HardwareState): void {
  state.hardware = hardware;
}
