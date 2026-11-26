"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const helmet = require("helmet");

const appSource = readFileSync(
  path.join(__dirname, "..", "src", "app.ts"),
  "utf8"
);

function helmetOptions() {
  const call = appSource.match(/helmet\(\{([\s\S]*?)\}\)/);
  assert.ok(call, "backend/src/app.ts should configure helmet with an options object");
  return call[1];
}

function collectHeaders(options) {
  const headers = {};
  const res = {
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    removeHeader(name) {
      delete headers[name.toLowerCase()];
    },
  };

  helmet(options)({}, res, () => {});
  return headers;
}

// Helmet 8 removed these headers from the default middleware set. The app
// must opt into them explicitly instead of relying on the old defaults.
test("app opts into the headers Helmet 8 removed from its defaults", () => {
  const options = helmetOptions();

  assert.match(
    options,
    /\bxXssProtection\s*:\s*true\b/,
    "X-XSS-Protection must be enabled explicitly"
  );
  assert.match(
    options,
    /\bxDnsPrefetchControl\s*:\s*true\b/,
    "X-DNS-Prefetch-Control must be enabled explicitly"
  );
  assert.match(
    options,
    /\bxDownloadOptions\s*:\s*true\b/,
    "X-Download-Options must be enabled explicitly"
  );
});

test("the opted-in middleware keeps the previous header values", () => {
  const headers = collectHeaders({
    xXssProtection: true,
    xDnsPrefetchControl: true,
    xDownloadOptions: true,
  });

  assert.equal(headers["x-xss-protection"], "0");
  assert.equal(headers["x-dns-prefetch-control"], "off");
  assert.equal(headers["x-download-options"], "noopen");
});
