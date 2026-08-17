'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { KB_DIR } = require('../config');

const users = new Map();
const conversations = new Map();
const metrics = {
  total_requests: 0,
  total_tokens: 0,
  total_cost_usd: 0,
  latencies: [],
};

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

  for (const seed of seeds) {
    const hash = await bcrypt.hash(seed.password, 10);
    const id = `user_${seed.username}`;
    users.set(seed.username, {
      id,
      username: seed.username,
      password_hash: hash,
      role: seed.role,
    });
  }
}

function findUserByUsername(username) {
  return users.get(username) || null;
}

function createUser({ username, password_hash, role }) {
  if (users.has(username)) {
    return null;
  }
  const id = `user_${username}_${Date.now()}`;
  const user = { id, username, password_hash, role };
  users.set(username, user);
  return { id: user.id, username: user.username, role: user.role };
}

function getOrCreateConversation(conversationId, userId) {
  if (conversationId && conversations.has(conversationId)) {
    const conv = conversations.get(conversationId);
    if (conv.userId === userId) {
      return conv;
    }
  }
  const id = conversationId || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const conv = { id, userId, messages: [] };
  conversations.set(id, conv);
  return conv;
}

function getConversation(conversationId, userId) {
  const conv = conversations.get(conversationId);
  if (!conv || conv.userId !== userId) {
    return null;
  }
  return conv;
}

function appendMessage(conversationId, message) {
  const conv = conversations.get(conversationId);
  if (!conv) return;
  conv.messages.push(message);
}

function recordMetrics({ tokens, cost_usd, latency_ms }) {
  metrics.total_requests += 1;
  metrics.total_tokens += tokens;
  metrics.total_cost_usd += cost_usd;
  metrics.latencies.push(latency_ms);
  if (metrics.latencies.length > 10_000) {
    metrics.latencies = metrics.latencies.slice(-5_000);
  }
}

function getMetricsSnapshot() {
  const latencies = [...metrics.latencies].sort((a, b) => a - b);
  const avg =
    latencies.length === 0
      ? 0
      : latencies.reduce((s, v) => s + v, 0) / latencies.length;
  const p95Index = latencies.length === 0 ? 0 : Math.min(
    latencies.length - 1,
    Math.floor(latencies.length * 0.95)
  );
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
