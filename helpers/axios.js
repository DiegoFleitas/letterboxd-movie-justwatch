const axios = require("axios");
const https = require("https");

const instance = axios.create({
  // Config options
});

instance.interceptors.request.use((config) => {
  console.log(`[axios] Sending request to ${config.url}`);
  return config;
});

// allow reusing existing connections (performance)
module.exports = (keepAlive) => {
  if (keepAlive) {
    instance.defaults.httpsAgent = new https.Agent({ keepAlive: true });
  }
  return instance;
};
