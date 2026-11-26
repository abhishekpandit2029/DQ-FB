"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const nodemailer = require("nodemailer");

const MINIMUM = [10, 6, 1];

function parseVersion(value) {
  const match = String(value).match(/(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, `could not parse a version from ${JSON.stringify(value)}`);
  return match.slice(1).map(Number);
}

function atLeast(actual, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] > minimum[index]) return true;
    if (actual[index] < minimum[index]) return false;
  }
  return true;
}

test("backend manifest and lockfile pin nodemailer to 10.6.1 or newer", () => {
  const backendPackage = JSON.parse(
    readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
  );
  const declared = backendPackage.dependencies && backendPackage.dependencies.nodemailer;
  assert.ok(declared, "backend/package.json must declare nodemailer");
  assert.ok(
    atLeast(parseVersion(declared), MINIMUM),
    `backend/package.json pins nodemailer ${declared}, expected >= 10.6.1`
  );

  const lockfile = JSON.parse(
    readFileSync(path.join(__dirname, "..", "..", "package-lock.json"), "utf8")
  );
  const locked = lockfile.packages && lockfile.packages["node_modules/nodemailer"];
  assert.ok(locked, "package-lock.json must contain node_modules/nodemailer");
  assert.ok(
    atLeast(parseVersion(locked.version), MINIMUM),
    `package-lock.json locks nodemailer ${locked.version}, expected >= 10.6.1`
  );
});

test("nodemailer sendMail still returns the Promise the mailer awaits", async () => {
  const transport = nodemailer.createTransport({ jsonTransport: true });

  const pending = transport.sendMail({
    from: "sender@example.test",
    to: "recipient@example.test",
    subject: "Synthetic message",
    text: "Synthetic body",
  });

  assert.ok(pending instanceof Promise);
  const info = await pending;
  assert.equal(typeof info.message, "string");
});
