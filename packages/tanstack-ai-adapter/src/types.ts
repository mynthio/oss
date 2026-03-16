/**
 * Configuration for the Mynth image adapter.
 *
 * This intentionally mirrors the small subset of Mynth SDK configuration
 * that is useful at the adapter boundary.
 */
export interface MynthImageConfig {
  /** Mynth API key. If not provided, reads from MYNTH_API_KEY env var. */
  apiKey?: string;
  /** Custom base URL for the Mynth API. */
  baseUrl?: string;
}
