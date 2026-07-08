import { AccountService } from "./services/AccountService.ts";
import { Auth } from "./services/Auth.ts";
import { getAppConfig } from "./services/AppConfig.ts";
import { CredentialsStore } from "./services/CredentialsStore.ts";
import { DestinationService } from "./services/DestinationService.ts";
import { DocsService } from "./services/DocsService.ts";
import { ImageService } from "./services/ImageService.ts";
import { ModelsService } from "./services/ModelsService.ts";
import { MynthApi } from "./services/MynthApi.ts";
import { TaskService } from "./services/TaskService.ts";
import { WebhookService } from "./services/WebhookService.ts";
import { WorkOS } from "./services/WorkOS.ts";

export type CliContext = {
  readonly account: AccountService;
  readonly auth: Auth;
  readonly credentialsStore: CredentialsStore;
  readonly destinations: DestinationService;
  readonly docs: DocsService;
  readonly images: ImageService;
  readonly models: ModelsService;
  readonly tasks: TaskService;
  readonly webhooks: WebhookService;
  readonly workos: WorkOS;
};

export const createCliContext = (): CliContext => {
  const config = getAppConfig();
  const credentialsStore = new CredentialsStore();
  const workos = new WorkOS();
  const auth = new Auth(config, credentialsStore, workos);
  const api = new MynthApi(config, auth);
  return {
    account: new AccountService(api),
    auth,
    credentialsStore,
    destinations: new DestinationService(api),
    docs: new DocsService(config),
    images: new ImageService(api),
    models: new ModelsService(api),
    tasks: new TaskService(api),
    webhooks: new WebhookService(api),
    workos,
  };
};
