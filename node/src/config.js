'use strict';

const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = '15m';
const JWT_CLOCK_TOLERANCE = 900;

const PORT = Number(process.env.PORT || 3000);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

const COST_PER_1K_TOKENS = 0.02;

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

const ROOT = path.join(__dirname, '..', '..');
const KB_DIR = path.join(ROOT, 'kb');
const LOGS_DIR = path.join(ROOT, 'logs');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT, 'data');

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_CLOCK_TOLERANCE,
  PORT,
  OLLAMA_BASE_URL,
  OLLAMA_MODEL,
  COST_PER_1K_TOKENS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  ROOT,
  KB_DIR,
  LOGS_DIR,
  FRONTEND_DIR,
  DATA_DIR,
};
