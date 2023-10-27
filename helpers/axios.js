import axios from "axios";
import https from "https";

const instance = axios.create({
  // Config options
});

instance.interceptors.request.use((config) => {
  console.log(`[axios] Sending request to ${config.url}`);
  return config;
});

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    const { config, response } = error;
    response.axiosError = error;
    if (response.status === 429) {
      // console.log(response);
      const retryAfter = response.headers["retry-after"] || 1;
      console.log(`[axios] Rate limit exceeded, retrying in ${retryAfter} (s)`);
      // Retry the request after a certain amount of time
      return new Promise((resolve) => {
        setTimeout(() => resolve(axios(config)), retryAfter * 1000);
      });
    }
    return Promise.reject(error);
  }
);

// allow reusing existing connections (performance)
export default (keepAlive) => {
  if (keepAlive) {
    instance.defaults.httpsAgent = new https.Agent({ keepAlive: true });
  }
  return instance;
};
