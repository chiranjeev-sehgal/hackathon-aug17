'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { KB_DIR } = require('../config');
const {
  readCollection,
  writeCollection,
  updateCollection,
} = require('../db/jsonDb');

let kbDocs = [];

function loadKnowledgeBase() {
  const files = fs.readdirSync(KB_DIR).filter((f) => f.endsWith('.json'));
  kbDocs = files.map((file) => {
    const raw = fs.readFileSync(path.join(KB_DIR, file), 'utf8');
    return JSON.parse(raw);
  });
  return kbDocs;
}

function getKnowledgeBase() {
  return kbDocs;
}

function getDocById(docId) {
  return kbDocs.find((d) => d.doc_id === docId) || null;
}

async function seedUsers() {
  const seeds = [
    { username: 'admin', password: 'admin123', role: 'Admin' },
    { username: 'emp', password: 'emp123', role: 'Employee' },
    { username: 'guest', password: 'guest123', role: 'Guest' },
  ];

  const users = readCollection('users');
  let changed = false;

  for (const seed of seeds) {
    if (users[seed.username]) {
      continue;
    }
    const hash = await bcrypt.hash(seed.password, 10);
    users[seed.username] = {
      id: `user_${seed.username}`,
      username: seed.username,
      password_hash: hash,
      role: seed.role,
    };
    changed = true;
  }

  if (changed) {
    writeCollection('users', users);
  }
}

function findUserByUsername(username) {
  const users = readCollection('users');
  return users[username] || null;
}

function createUser({ username, password_hash, role }) {
  const users = readCollection('users');
  if (users[username]) {
    return null;
  }
  const id = `user_${username}_${Date.now()}`;
  const user = { id, username, password_hash, role };
  users[username] = user;
  writeCollection('users', users);
  return { id: user.id, username: user.username, role: user.role };
}

function getOrCreateConversation(conversationId, userId) {
  const conversations = readCollection('conversations');

  if (conversationId && conversations[conversationId]) {
    const conv = conversations[conversationId];
    if (conv.userId === userId) {
      return conv;
    }
  }

  const id =
    conversationId ||
    `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const conv = { id, userId, messages: [] };
  conversations[id] = conv;
  writeCollection('conversations', conversations);
  return conv;
}

function getConversation(conversationId, userId) {
  const conversations = readCollection('conversations');
  const conv = conversations[conversationId];
  if (!conv || conv.userId !== userId) {
    return null;
  }
  return conv;
}

function appendMessage(conversationId, message) {
  updateCollection('conversations', (conversations) => {
    const conv = conversations[conversationId];
    if (!conv) {
      return conversations;
    }
    conv.messages.push(message);
    return conversations;
  });
}

function recordMetrics({ tokens, cost_usd, latency_ms }) {
  updateCollection('metrics', (metrics) => {
    metrics.total_requests += 1;
    metrics.total_tokens += tokens;
    metrics.total_cost_usd += cost_usd;
    metrics.latencies.push(latency_ms);
    if (metrics.latencies.length > 10_000) {
      metrics.latencies = metrics.latencies.slice(-5_000);
    }
    return metrics;
  });
}

function getMetricsSnapshot() {
  const metrics = readCollection('metrics');
  const latencies = [...metrics.latencies].sort((a, b) => a - b);
  const avg =
    latencies.length === 0
      ? 0
      : latencies.reduce((s, v) => s + v, 0) / latencies.length;
  const p95Index =
    latencies.length === 0
      ? 0
      : Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));
  const p95 = latencies.length === 0 ? 0 : latencies[p95Index];

  return {
    total_requests: metrics.total_requests,
    total_tokens: metrics.total_tokens,
    total_cost_usd: Number(metrics.total_cost_usd.toFixed(6)),
    avg_latency_ms: Number(avg.toFixed(2)),
    p95_latency_ms: Number(p95.toFixed(2)),
  };
}

module.exports = {
  loadKnowledgeBase,
  getKnowledgeBase,
  getDocById,
  seedUsers,
  findUserByUsername,
  createUser,
  getOrCreateConversation,
  getConversation,
  appendMessage,
  recordMetrics,
  getMetricsSnapshot,
};
