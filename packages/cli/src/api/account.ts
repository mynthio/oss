import type { ApiClient } from "./client.ts";
import { balance, me, type Balance, type Me } from "./schemas.ts";

export const getMe = (client: ApiClient): Promise<Me> => client.fetch("me", "/me", me);

export const getBalance = (client: ApiClient): Promise<Balance> =>
  client.fetch("balance", "/balance", balance);
