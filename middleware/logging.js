import morgan from "morgan";
import uaParser from "ua-parser-js";

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
    },
    null,
    2
  )}`;
});

export const logging = morgan("json");
