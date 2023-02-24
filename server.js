const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const morgan = require("morgan");
require("dotenv").config();
const {
  searchMovie,
  poster,
  letterboxdWatchlist,
  wink,
} = require("./controllers");

const app = express();
const port = process.env.PORT || 3000;
const cacheTtl = process.env.CACHE_TTL || 60; // seconds

app.use(express.static("public"));

// Define a custom morgan format that logs request IP and request payload
morgan.token("payload", (req, res) => {
  return JSON.stringify(req.body);
});
const logFormat = `remote-addr\tresponse-time(ms)\tmethod\turl\tstatus\tpayload\treq[content-type]\treq[user-agent]
:remote-addr\t:response-time ms\t:method\t:url\t:status\t:payload\t:req[content-type]\t:req[user-agent]`;
app.use(morgan(logFormat)); // logs

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

app.post("/api/search-movie", async (req, res) => {
  return searchMovie(req, res);
});

app.post("/api/poster", async (req, res) => {
  return poster(req, res);
});

// Set up Multer storage and file filter
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/zip",
      "application/x-zip-compressed",
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      console.log(file.mimetype);
      return cb(new Error("Only zip files are allowed"));
    }
    cb(null, true);
  },
});

// Endpoint to handle watchlist file upload
app.post(
  "/api/letterboxd-watchlist",
  upload.single("watchlist"),
  async (req, res) => {
    return letterboxdWatchlist(req, res);
  }
);

app.post("/api/wink", async (req, res) => {
  return wink(req, res);
});

app.listen(port, () =>
  console.log(
    `justwatch-done-right app listening on port http://localhost:${port}`
  )
);
