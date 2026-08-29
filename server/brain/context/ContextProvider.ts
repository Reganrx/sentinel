import {
  ContextSource,
} from "./contextTypes.js";

export interface ContextProvider<T> {

  readonly name: string;

  readonly sources: ContextSource[];

  load(): T;

}