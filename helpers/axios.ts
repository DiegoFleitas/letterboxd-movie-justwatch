import axios, { type AxiosInstance } from "axios";
import https from "https";

const instance = axios.create({});

instance.interceptors.request.use((config) => {
  console.log(`[axios] Sending request to ${config.url}`);
  return config;
});

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    const { config, response } = error;
    if (response) {
      (response as Record<string, unknown>).axiosError = error;
      if (response.status === 429) {
        const retryAfter = Number(response.headers["retry-after"]) || 1;
        console.log(`[axios] Rate limit exceeded, retrying in ${retryAfter} (s)`);
        return new Promise((resolve) => {
          setTimeout(() => resolve(axios(config)), retryAfter * 1000);
        });
      }
    }
    return Promise.reject(error);
  }
);

export default (keepAlive?: boolean): AxiosInstance => {
  if (keepAlive) {
    instance.defaults.httpsAgent = new https.Agent({ keepAlive: true });
  }
  return instance;
};
