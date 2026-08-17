'use strict';

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');

const DEFAULTS = {
  users: {},
  conversations: {},
  metrics: {
    total_requests: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    latencies: [],
  },
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function collectionPath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readCollection(name) {
  ensureDataDir();
  const filePath = collectionPath(name);
  if (!fs.existsSync(filePath)) {
    const empty = structuredClone(DEFAULTS[name] ?? {});
    writeCollection(name, empty);
    return empty;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) {
    return structuredClone(DEFAULTS[name] ?? {});
  }
  return JSON.parse(raw);
}

function writeCollection(name, data) {
  ensureDataDir();
  const filePath = collectionPath(name);
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function updateCollection(name, updater) {
  const current = readCollection(name);
  const next = updater(current);
  writeCollection(name, next);
  return next;
}

function clearCollection(name) {
  writeCollection(name, structuredClone(DEFAULTS[name] ?? {}));
}

function clearAll() {
  for (const name of Object.keys(DEFAULTS)) {
    clearCollection(name);
  }
}

function listCollections() {
  return Object.keys(DEFAULTS);
}

module.exports = {
  DEFAULTS,
  ensureDataDir,
  readCollection,
  writeCollection,
  updateCollection,
  clearCollection,
  clearAll,
  listCollections,
  collectionPath,
};
