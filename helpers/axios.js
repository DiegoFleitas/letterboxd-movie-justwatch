const axios = require("axios");

const instance = axios.create({
  // Config options
});

instance.interceptors.request.use((config) => {
  console.log(`[axios] Sending request to ${config.url}`);
  return config;
});

module.exports = instance;
