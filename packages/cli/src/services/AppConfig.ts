export type AppConfig = {
  readonly mynthApiUrl: string;
  readonly mynthDocsUrl: string;
  readonly apiKeyEnvOverride?: string;
};

export const getAppConfig = (): AppConfig => {
  const apiKeyEnvOverride = process.env["MYNTH_API_KEY"];
  return {
    mynthApiUrl: process.env["MYNTH_API_URL"] ?? "https://api.mynth.io",
    mynthDocsUrl: process.env["MYNTH_DOCS_URL"] ?? "https://docs.mynth.io",
    ...(apiKeyEnvOverride !== undefined ? { apiKeyEnvOverride } : {}),
  };
};
