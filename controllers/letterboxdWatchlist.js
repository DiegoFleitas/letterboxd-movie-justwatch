const AdmZip = require("adm-zip");
const csv = require("csv-parser");
const { Readable } = require("stream");

// Note: letterboxd Watchlist might have empty year for unreleased movies
const letterboxdWatchlist = async (req, res) => {
  try {
    const file = req.file;

    // Load the zip file
    const zip = new AdmZip(file.buffer);

    // Search for the "watchlist.csv" file
    const zipEntries = zip.getEntries();
    const watchlistEntry = zipEntries.find(
      (entry) => entry.entryName === "watchlist.csv"
    );

    // If the file is found, parse it to JSON and send the data back in the response
    if (watchlistEntry) {
      const watchlistJson = [];
      zip.readAsTextAsync(watchlistEntry, (csvData) => {
        const stream = Readable.from(csvData);
        stream
          .pipe(csv())
          .on("data", (row) => {
            watchlistJson.push(row);
          })
          .on("end", () => {
            console.log(watchlistJson);
            res.json(watchlistJson);
          });
      });
    } else {
      // If the file is not found, send an error response
      res.status(400).json({ error: "Watchlist file not found" });
    }
  } catch (err) {
    // If there is an error, send an error response
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { letterboxdWatchlist };
