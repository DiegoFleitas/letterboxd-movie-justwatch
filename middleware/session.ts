import cookieSession from "cookie-session";

const keys = process.env.APP_SECRET_KEY ? [process.env.APP_SECRET_KEY] : ["dev-secret"];

export const session = cookieSession({
  name: "session",
  keys,
  maxAge: 24 * 60 * 60 * 1000,
  sameSite: "lax",
  secure: true,
  httpOnly: true,
});
