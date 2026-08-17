'use strict';

const fs = require('fs');
const path = require('path');
const { LOGS_DIR } = require('../config');

function ensureLogDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function appendLine(filename, record) {
  ensureLogDir();
  const line = JSON.stringify({ ts: new Date().toISOString(), ...record });
  fs.appendFileSync(path.join(LOGS_DIR, filename), `${line}\n`, 'utf8');
}

function logAiRequest(record) {
  appendLine('ai_requests.log', {
    user: record.user,
    tokens: record.tokens,
    latency_ms: record.latency_ms,
    cost_usd: record.cost_usd,
    conversation_id: record.conversation_id,
  });
}

function logSecurityEvent(record) {
  appendLine('security.log', record);
}

module.exports = {
  logAiRequest,
  logSecurityEvent,
};
