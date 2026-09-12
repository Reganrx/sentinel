export interface WorldProvider {

  readonly name: string;

  readonly priority: number;

  refresh(): Promise<void>;

}