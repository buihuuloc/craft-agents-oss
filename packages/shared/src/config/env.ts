/**
 * Centralized environment variable access.
 *
 * All environment variables used by @craft-agent/shared should be accessed
 * through this module to provide a single source of truth and clear documentation.
 */

/** Environment configuration for craft-agent */
export interface EnvConfig {
  /** Anthropic API key for Claude access */
  ANTHROPIC_API_KEY: string | undefined
  /** Custom Anthropic API base URL */
  ANTHROPIC_BASE_URL: string | undefined
  /** Override config directory (default: ~/.craft-agent) */
  CRAFT_CONFIG_DIR: string | undefined
  /** Enable debug logging (set to '1') */
  CRAFT_DEBUG: string | undefined
  /** Google OAuth client ID */
  GOOGLE_OAUTH_CLIENT_ID: string | undefined
  /** Google OAuth client secret */
  GOOGLE_OAUTH_CLIENT_SECRET: string | undefined
  /** Slack OAuth client ID */
  SLACK_OAUTH_CLIENT_ID: string | undefined
  /** Slack OAuth client secret */
  SLACK_OAUTH_CLIENT_SECRET: string | undefined
  /** Microsoft OAuth client ID */
  MICROSOFT_OAUTH_CLIENT_ID: string | undefined
  /** Sentry ingest URL for error reporting */
  SENTRY_ELECTRON_INGEST_URL: string | undefined
}

/**
 * Read all environment variables into a typed config object.
 * Does not validate — just provides typed access.
 */
export function getEnvConfig(): EnvConfig {
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
    CRAFT_CONFIG_DIR: process.env.CRAFT_CONFIG_DIR,
    CRAFT_DEBUG: process.env.CRAFT_DEBUG,
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    SLACK_OAUTH_CLIENT_ID: process.env.SLACK_OAUTH_CLIENT_ID,
    SLACK_OAUTH_CLIENT_SECRET: process.env.SLACK_OAUTH_CLIENT_SECRET,
    MICROSOFT_OAUTH_CLIENT_ID: process.env.MICROSOFT_OAUTH_CLIENT_ID,
    SENTRY_ELECTRON_INGEST_URL: process.env.SENTRY_ELECTRON_INGEST_URL,
  }
}

/** Check if debug mode is enabled */
export function isDebugEnabled(): boolean {
  return process.env.CRAFT_DEBUG === '1'
}
