import { Auth } from "./services/Auth.ts";
import { getAppConfig } from "./services/AppConfig.ts";
import { CredentialsStore } from "./services/CredentialsStore.ts";
import { ImageService } from "./services/ImageService.ts";
import { MynthApi } from "./services/MynthApi.ts";
import { TaskService } from "./services/TaskService.ts";
import { WorkOS } from "./services/WorkOS.ts";

export type CliContext = {
  readonly auth: Auth;
  readonly credentialsStore: CredentialsStore;
  readonly images: ImageService;
  readonly tasks: TaskService;
  readonly workos: WorkOS;
};

export const createCliContext = (): CliContext => {
  const config = getAppConfig();
  const credentialsStore = new CredentialsStore();
  const workos = new WorkOS();
  const auth = new Auth(config, credentialsStore, workos);
  const api = new MynthApi(config, auth);
  return {
    auth,
    credentialsStore,
    images: new ImageService(api),
    tasks: new TaskService(api),
    workos,
  };
};
