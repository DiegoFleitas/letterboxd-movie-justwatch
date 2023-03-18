const expressSession = require("express-session");
const uuid = require("uuid");

const session = expressSession({
  secret: process.env.APP_SECRET_KEY,
  resave: false,
  saveUninitialized: true,
  genid: () => {
    return uuid.v4();
  },
});

module.exports = { session };
