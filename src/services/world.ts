import { apiGet } from "./api";

import type {
  WorldState,
} from "../types/world";

export async function getWorldState(): Promise<WorldState> {

  return apiGet<WorldState>(
    "/world"
  );

}