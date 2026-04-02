#!/usr/bin/env node

const path = require("path");

try {
  require(path.join(__dirname, "..", "dist", "index.js"));
} catch (error) {
  console.error("Failed to start fpd:", error.message);
  process.exit(1);
}
