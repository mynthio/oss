import { z } from "zod";
import type { ApiClient } from "./client.ts";
import { model, type Model } from "./schemas.ts";

/** The model catalog is public — no credentials required. */
export const listModels = (client: ApiClient): Promise<ReadonlyArray<Model>> =>
  client.fetch("models list", "/models", z.array(model), { auth: false });
