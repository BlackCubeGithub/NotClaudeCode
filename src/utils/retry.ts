export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  timeout?: number;
  retryOn?: number[];
}

const defaultOptions: Required<Omit<RetryOptions, 'retryOn'>> & { retryOn: number[] } = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  timeout: 60000,
  retryOn: [408, 429, 500, 502, 503, 504],
};

function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay + Math.random() * 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  const opts = { ...defaultOptions, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok && opts.retryOn.includes(response.status)) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      lastError = errorInstance;

      const isAbortError = errorInstance.name === 'AbortError';
      const isNetworkError =
        errorInstance.message.includes('ETIMEDOUT') ||
        errorInstance.message.includes('ECONNREFUSED') ||
        errorInstance.message.includes('ECONNRESET') ||
        errorInstance.message.includes('ENOTFOUND') ||
        errorInstance.message.includes('network') ||
        errorInstance.message.includes('Connection error');

      const shouldRetry = isNetworkError || isAbortError || opts.retryOn.some(code => errorInstance.message.includes(String(code)));
      
      if (attempt < opts.maxRetries && shouldRetry) {
        const delay = calculateDelay(attempt, opts.baseDelay, opts.maxDelay);
        console.log(`[Retry ${attempt + 1}/${opts.maxRetries}] ${errorInstance.message}. Retrying in ${Math.round(delay)}ms...`);
        await sleep(delay);
        continue;
      }

      throw errorInstance;
    }
  }

  throw lastError ?? new Error('Max retries exceeded');
}

export async function fetchJsonWithRetry<T = unknown>(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<T> {
  const response = await fetchWithRetry(url, init, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  return response.json() as Promise<T>;
}

export async function fetchTextWithRetry(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<string> {
  const response = await fetchWithRetry(url, init, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  return response.text();
}

export function createRetryFetch(defaultOptions?: RetryOptions) {
  return (url: string, init?: RequestInit, options?: RetryOptions) =>
    fetchWithRetry(url, init, { ...defaultOptions, ...options });
}
