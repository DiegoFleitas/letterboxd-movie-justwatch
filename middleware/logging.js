import morgan from "morgan";
import uaParser from "ua-parser-js";
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

morgan.token("browser", function (req) {
  const userAgent = req.headers["user-agent"];
  const ua = uaParser(userAgent);
  return `${ua.browser.name} ${ua.browser.version}`;
});

morgan.token("os", function (req) {
  const userAgent = req.headers["user-agent"];
  const ua = uaParser(userAgent);
  return `${ua.os.name} ${ua.os.version}`;
});

morgan.token("bot", function (req) {
  const userAgent = req.headers["user-agent"];
  const ua = uaParser(userAgent);
  return ua.device.type === "bot" ? "yes" : "no";
});

// Define a custom morgan format to log JSON to the client
morgan.format("json", function (tokens, req, res) {
  const PRETTIFY_LOGS = process.env.PRETTIFY_LOGS === "true";
  if (req.headers["user-agent"] === "Consul Health Check") {
    return;
  }
  const logLevel = res.statusCode >= 400 ? "error" : "info";
  return `[${logLevel}] ${JSON.stringify(
    {
      ip: tokens["remote-addr"](req, res),
      userAgent: req.headers["user-agent"],
      browser: tokens.browser(req),
      os: tokens.os(req),
      isBot: tokens.bot(req),
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: tokens.status(req, res),
      payload: JSON.stringify(req.body),
      contentType: req.headers["content-type"],
      responseTime: tokens["response-time"](req, res),
      session_id: req.session.id, // Add session identifier to log
      axiosError: tokens.axiosError(req),
    },
    null,
    PRETTIFY_LOGS ? 2 : 0
  )}`;
});

morgan.token("axiosError", function (req) {
  return {
    statusCode: req.res?.statusCode || null,
    statusText: req.res?.statusText || null,
    statusMessage: req.res?.statusMessage || null,
    headers: req.res?._headers || null,
    data: req.res?.data || null,
  };
});

export const logging = morgan("json");
