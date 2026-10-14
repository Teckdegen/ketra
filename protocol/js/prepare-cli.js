"use strict";

const fs = require("fs");
const { buildBlob, PK_SIZE } = require("./prepare");

function fail(message) {
  process.stderr.write(`prepare: error: ${message}\n`);
  process.exit(2);
}

function decodePk(text, source) {
  let cleaned = text.replace(/\s+/g, "");
  if (cleaned.startsWith("0x") || cleaned.startsWith("0X")) cleaned = cleaned.slice(2);
  if (!cleaned) fail(`${source} held no data; expected ${PK_SIZE} bytes of ML-DSA-44 public key.`);
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) fail(`${source} is not hex.`);
  if (cleaned.length % 2) fail(`${source} held an odd number of hex characters.`);
  const pk = Buffer.from(cleaned, "hex");
  if (pk.length !== PK_SIZE) {
    fail(`${source} held ${pk.length} bytes; expected ${PK_SIZE}.`);
  }
  return pk;
}

const args = process.argv.slice(2);
let inPath;
let outPath;
let positional;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--in") inPath = args[++i];
  else if (args[i] === "--out") outPath = args[++i];
  else if (args[i] === "--help") {
    process.stdout.write("node js/prepare-cli.js [PK_HEX] [--in FILE] [--out FILE]\n");
    process.exit(0);
  } else positional = args[i];
}

let text;
let source;
if (positional != null) {
  text = positional;
  source = "the PK_HEX argument";
} else if (inPath != null) {
  text = fs.readFileSync(inPath, "utf8");
  source = inPath;
} else {
  text = fs.readFileSync(0, "utf8");
  source = "stdin";
}

const hex = buildBlob(decodePk(text, source)).toString("hex");
if (outPath) fs.writeFileSync(outPath, hex);
else process.stdout.write(hex);
