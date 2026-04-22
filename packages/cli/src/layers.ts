import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import * as Layer from "effect/Layer";
import { Auth } from "./services/Auth.ts";
import { CredentialsStore } from "./services/CredentialsStore.ts";
import { ImageService } from "./services/ImageService.ts";
import { MynthApi } from "./services/MynthApi.ts";
import { TaskService } from "./services/TaskService.ts";
import { WorkOS } from "./services/WorkOS.ts";

const HttpLayer = FetchHttpClient.layer;
const Base = Layer.mergeAll(CredentialsStore.Default, HttpLayer);
const WithWorkOS = WorkOS.Default.pipe(Layer.provideMerge(Base));
const WithAuth = Auth.Default.pipe(Layer.provideMerge(WithWorkOS));
const WithMynthApi = MynthApi.Default.pipe(Layer.provideMerge(WithAuth));

const WithImageService = ImageService.DefaultWithoutDependencies.pipe(
  Layer.provideMerge(WithMynthApi),
);

export const MainLayer = TaskService.DefaultWithoutDependencies.pipe(
  Layer.provideMerge(WithImageService),
);
