/**
 * Retry helper for connection and operation retries
 */
export class RetryHelper {
  /**
   * Calculate exponential backoff delay
   * @param attempt Current attempt number (1-based)
   * @param maxDelay Maximum delay in milliseconds
   * @param baseDelay Base delay in milliseconds
   */
  static exponentialBackoff(
    attempt: number,
    maxDelay: number = 2000,
    baseDelay: number = 50,
  ): number {
    const delay = Math.min(attempt * baseDelay, maxDelay);
    return delay;
  }

  /**
   * Execute function with retry logic
   * @param fn Function to execute
   * @param maxAttempts Maximum number of attempts
   * @param onRetry Callback on retry
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    onRetry?: (attempt: number, error: Error) => void,
  ): Promise<T> {
    let lastError: Error = new Error('Max retry attempts reached');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxAttempts) {
          if (onRetry) {
            onRetry(attempt, lastError);
          }

          const delay = this.exponentialBackoff(attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
