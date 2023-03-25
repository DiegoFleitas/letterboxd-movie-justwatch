import axios from "axios";
import https from "https";

const instance = axios.create({
  // Config options
});

instance.interceptors.request.use((config) => {
  console.log(`[axios] Sending request to ${config.url}`);
  return config;
});

// allow reusing existing connections (performance)
export default (keepAlive) => {
  if (keepAlive) {
    instance.defaults.httpsAgent = new https.Agent({ keepAlive: true });
  }
  return instance;
};
