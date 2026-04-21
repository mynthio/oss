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
  /**
   * Default destination name (slug) for generated images.
   * If not provided, reads from MYNTH_DESTINATION env var.
   * Can be overridden per-request via provider options.
   */
  destination?: string;
}
