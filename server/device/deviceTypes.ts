export interface CPUState {

  model: string;

  cores: number;

  threads: number;

  usage: number;

  speed: number;

  loadAverage: number[];

}

export interface GPUState {

  model: string;

  usage: number;

  memoryUsed: number;

  memoryTotal: number;

}

export interface MemoryState {

  total: number;

  used: number;

  free: number;

}

export interface StorageDrive {

  name: string;

  total: number;

  used: number;

  free: number;

}

export interface BatteryState {

  present: boolean;

  charging: boolean;

  level: number;

}

export interface NetworkState {

  connected: boolean;

  interface: string;

  localIP: string;

}

export interface DisplayState {

  width: number;

  height: number;

  refreshRate: number;

  scale: number;

  primary: boolean;

}

export interface DeviceState {

  cpu: CPUState;

  gpu: GPUState;

  memory: MemoryState;

  storage: StorageDrive[];

  battery: BatteryState;

  network: NetworkState;

  display: DisplayState;

  hardware: HardwareState;

}

export interface HardwareSensor { name: string; hardware: string; type: string; value: number; min?: number; max?: number; unit: string; }
export interface DiskHealth { name: string; mediaType: string; health: string; temperature?: number; }
export interface HardwareState { sensorProvider: "LibreHardwareMonitor" | "OpenHardwareMonitor" | "Windows"; sensors: HardwareSensor[]; disks: DiskHealth[]; uptimeSeconds: number; updatedAt: string; }
