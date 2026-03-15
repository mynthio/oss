/**
 * Configuration for the Mynth image adapter.
 */
export interface MynthImageConfig {
  /** Mynth API key. If not provided, reads from MYNTH_API_KEY env var. */
  apiKey?: string
  /** Custom base URL for the Mynth API. */
  baseUrl?: string
}
