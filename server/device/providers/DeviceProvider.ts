export interface DeviceProvider {

  readonly name: string;

  readonly priority: number;

  refresh(): Promise<void>;

}