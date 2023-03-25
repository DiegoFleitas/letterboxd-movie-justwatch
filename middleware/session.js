import cookieSession from "cookie-session";

export const session = cookieSession({
  name: "session",
  keys: [process.env.APP_SECRET_KEY],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  sameSite: "lax", // For CSRF protection
  secure: true, // Only send cookie over HTTPS
  httpOnly: true, // Prevent client-side JavaScript from accessing the cookie
});
