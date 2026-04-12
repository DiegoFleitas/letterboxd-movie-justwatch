import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import https from "https";

const instance = axios.create({});

/** Tracks 429 retries per request chain (see response interceptor). */
type ConfigWith429Retry = InternalAxiosRequestConfig & {
  __rateLimitRetryCount?: number;
};

const getMax429Retries = (): number => {
  const n = Number(process.env.AXIOS_429_MAX_RETRIES);
  if (Number.isFinite(n) && n >= 0) {
    return Math.floor(n);
  }
  return 5;
};

/** Cap wait between 429 retries (seconds) to avoid multi-minute stalls. */
const max429RetryAfterSeconds = (): number => {
  const n = Number(process.env.AXIOS_429_MAX_RETRY_AFTER_SECONDS);
  if (Number.isFinite(n) && n > 0) {
    return Math.min(Math.floor(n), 120);
  }
  return 60;
};

const sanitizeUrl = (url: string | undefined): string => {
  if (!url) return "";
  // Redact common API key-style query params to avoid leaking secrets in logs.
  return url.replace(/((?:api_key|apikey|access_token|token|key)=)([^&]+)/gi, "$1***");
};

instance.interceptors.request.use((config) => {
  const url = typeof config.url === "string" ? config.url : undefined;
  console.log(`[axios] Sending request to ${sanitizeUrl(url)}`);
  return config;
});

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    const { config, response } = error;
    if (response) {
      (response as Record<string, unknown>).axiosError = error;
      if (response.status === 429) {
        const cfg = config as ConfigWith429Retry;
        const nextAttempt = (cfg.__rateLimitRetryCount ?? 0) + 1;
        const maxRetries = getMax429Retries();
        if (nextAttempt > maxRetries) {
          console.log(
            `[axios] Rate limit exceeded, max retries (${maxRetries}) reached; rejecting`,
          );
          return Promise.reject(error);
        }
        cfg.__rateLimitRetryCount = nextAttempt;
        const rawRetryAfter = Number(response.headers["retry-after"]) || 1;
        const retryAfterSec = Math.min(rawRetryAfter, max429RetryAfterSeconds());
        console.log(
          `[axios] Rate limit exceeded, retry ${nextAttempt}/${maxRetries} in ${retryAfterSec} (s)`,
        );
        return new Promise((resolve) => {
          setTimeout(() => resolve(axios(cfg)), retryAfterSec * 1000);
        });
      }
    }
    return Promise.reject(error);
  },
);

export default (keepAlive?: boolean): AxiosInstance => {
  if (keepAlive) {
    instance.defaults.httpsAgent = new https.Agent({ keepAlive: true });
  }
  return instance;
};
