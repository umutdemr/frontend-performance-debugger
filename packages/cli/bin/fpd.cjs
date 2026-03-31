const path = require("path");
const { pathToFileURL } = require("url");

const distPath = path.join(__dirname, "..", "dist", "index.js");
const distURL = pathToFileURL(distPath).href;

import(distURL).catch((err) => {
  console.error("Failed to start fpd:", err);
  process.exit(1);
});
