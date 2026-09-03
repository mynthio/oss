import { z } from "zod";
import type { ApiClient } from "./client.ts";
import { destination, type Destination } from "./schemas.ts";

export const listDestinations = (client: ApiClient): Promise<ReadonlyArray<Destination>> =>
  client.fetch("destination list", "/destinations", z.array(destination));

export const getDestination = (client: ApiClient, id: string): Promise<Destination> =>
  client.fetch("destination fetch", `/destinations/${id}`, destination);

export const createDestination = (client: ApiClient, body: unknown): Promise<Destination> =>
  client.fetch("destination create", "/destinations", destination, { body });

export const updateDestination = (
  client: ApiClient,
  id: string,
  body: unknown,
): Promise<Destination> =>
  client.fetch("destination update", `/destinations/${id}`, destination, {
    method: "PUT",
    body,
  });

/** Writes a probe object; a credential problem surfaces as a non-2xx response. */
export const testDestination = (client: ApiClient, id: string, path: string): Promise<void> =>
  client.call("destination test", `/destinations/${id}/test`, { body: { path } });

export const deleteDestination = (client: ApiClient, id: string): Promise<void> =>
  client.call("destination delete", `/destinations/${id}`, { method: "DELETE" });
