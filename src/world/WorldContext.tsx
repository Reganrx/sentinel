import {

  createContext,

  useContext,

} from "react";

import type {

  WorldState,

} from "../types/world";

export interface WorldContextValue {

  world: WorldState | null;

  loading: boolean;

  refresh: () => Promise<void>;

}

const WorldContext =

  createContext<WorldContextValue | null>(null);

export function useWorldContext() {

  const context =

    useContext(WorldContext);

  if (!context) {

    throw new Error(

      "useWorldContext must be used inside WorldProvider."

    );

  }

  return context;

}

export default WorldContext;