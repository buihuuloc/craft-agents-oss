/**
 * Retry utility with exponential backoff.
 *
 * Used for transient failures in network operations like
 * MCP connections, OAuth token refresh, and source health checks.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Optional predicate to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Optional callback on each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Execute an async function with exponential backoff retry.
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => connectToMcpServer(url),
 *   { maxAttempts: 3, initialDelayMs: 1000 }
 * )
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    isRetryable = () => true,
    onRetry,
  } = options;

  let lastError: unknown;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !isRetryable(error)) {
        throw error;
      }

      onRetry?.(attempt, error, delayMs);

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Check if an error is a transient network error (retryable).
 */
export function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const message = (error as Error).message?.toLowerCase() ?? '';
  const status = (error as any).status ?? (error as any).statusCode;

  // Retry on server errors
  if (typeof status === 'number' && status >= 500) return true;

  // Retry on rate limits
  if (status === 429) return true;

  // Retry on network errors
  if (
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('etimedout') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('socket hang up')
  ) return true;

  return false;
}
