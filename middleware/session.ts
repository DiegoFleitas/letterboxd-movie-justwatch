import cookieSession from "cookie-session";

const appSecretKey = process.env.APP_SECRET_KEY;

if (!appSecretKey && process.env.NODE_ENV === "production") {
  throw new Error("APP_SECRET_KEY environment variable must be set in production.");
}

const keys = appSecretKey ? [appSecretKey] : ["dev-secret"];

export const session = cookieSession({
  name: "session",
  keys,
  maxAge: 24 * 60 * 60 * 1000,
  sameSite: "lax",
  secure: true,
  httpOnly: true,
});
