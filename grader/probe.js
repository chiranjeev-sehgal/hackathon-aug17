'use strict';

/**
 * Deterministic probes against a running server.
 * Usage: node grader/probe.js [baseUrl]
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const jwt = require('jsonwebtoken');

const BASE = process.argv[2] || process.env.BASE_URL || 'http://localhost:3000';
const EXPECTED_COST_PER_1K = 0.002;

function request(method, path, { token, body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const lib = url.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(headers || {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            data = text;
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(username, password) {
  const res = await request('POST', '/auth/login', {
    body: { username, password },
  });
  if (res.status !== 200 || !res.data.access_token) {
    throw new Error(`Login failed for ${username}: ${res.status}`);
  }
  return res.data.access_token;
}

function result(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  return pass;
}

async function checkGuestAdminRefusal() {
  const token = await login('guest', 'guest123');
  const res = await request('POST', '/chat', {
    token,
    body: {
      message: 'What are the confidential salary bands for IC3 and M2?',
    },
  });
  const answer = ((res.data && res.data.answer) || '').toLowerCase();
  const refused =
    res.status === 200 &&
    (answer.includes('cannot') ||
      answer.includes('not allowed') ||
      answer.includes('access level') ||
      answer.includes('refuse') ||
      answer.includes('unauthorized') ||
      answer.includes('do not have access') ||
      (Array.isArray(res.data.sources) && res.data.sources.length === 0 && (res.data.confidence || 0) === 0));
  return result(
    'guest_admin_topic_refused',
    refused,
    refused ? 'guest was refused' : `guest received answer (${res.status})`
  );
}

async function checkRateLimit() {
  const token = await login('emp', 'emp123');
  const jobs = Array.from({ length: 25 }, () =>
    request('POST', '/chat', {
      token,
      body: { message: 'Summarize the leave policy briefly.' },
    })
  );
  const results = await Promise.all(jobs);
  const limited = results.filter((r) => r.status === 429).length;
  const pass = limited >= 15;
  return result(
    'concurrent_rate_limit',
    pass,
    `${limited}/25 returned 429 (need >= 15)`
  );
}

async function checkLongEmojiMessage() {
  const token = await login('emp', 'emp123');
  const message = `${'Please explain our leave policy in detail. '.repeat(120)} 😀🎉🚀`;
  const res = await request('POST', '/chat', {
    token,
    body: { message },
  });
  const okStatus = res.status === 200;
  const schemaValid =
    res.data &&
    typeof res.data.answer === 'string' &&
    Array.isArray(res.data.sources) &&
    typeof res.data.confidence === 'number' &&
    res.data.confidence >= 0 &&
    res.data.confidence <= 1 &&
    !(res.data.confidence === 1 && Array.isArray(res.data.sources) && res.data.sources.length === 0 && typeof res.data.answer === 'string' && res.data.answer.includes('{') === false && res.data.answer.length > 500);
  const grounded = res.data && Array.isArray(res.data.sources) && res.data.sources.length > 0;
  const looksDegraded =
    res.data &&
    Array.isArray(res.data.sources) &&
    res.data.sources.length === 0 &&
    res.data.confidence === 1;

  const pass = okStatus && schemaValid && grounded && !looksDegraded;
  return result(
    'long_emoji_structured_output',
    pass,
    pass ? 'schema-valid grounded response' : `status=${res.status} sources=${(res.data && res.data.sources && res.data.sources.length) || 0} confidence=${res.data && res.data.confidence}`
  );
}

async function checkExpiredToken() {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  const token = jwt.sign(
    {
      sub: 'emp',
      role: 'Employee',
      exp: Math.floor(Date.now() / 1000) - 600,
    },
    secret,
    { algorithm: 'HS256' }
  );
  const res = await request('POST', '/chat', {
    token,
    body: { message: 'hello' },
  });
  const pass = res.status === 401;
  return result('expired_token_rejected', pass, `status=${res.status}`);
}

async function checkAlgNoneAndDefaultSecret() {
  const noneToken = jwt.sign(
    { sub: 'admin', role: 'Admin' },
    '',
    { algorithm: 'none' }
  );
  const forgedDefault = jwt.sign(
    { sub: 'admin', role: 'Admin' },
    'dev-secret-change-me',
    { algorithm: 'HS256', expiresIn: '15m' }
  );

  const noneRes = await request('GET', '/metrics', { token: noneToken });
  const forgedRes = await request('GET', '/metrics', { token: forgedDefault });

  const envSet = Boolean(process.env.JWT_SECRET);
  const noneRejected = noneRes.status === 401;
  const forgedRejected = envSet ? true : forgedRes.status === 401;

  const pass = noneRejected && forgedRejected;
  return result(
    'insecure_token_rejected',
    pass,
    `alg:none=${noneRes.status}, default-secret-forged=${forgedRes.status}`
  );
}

async function checkCostAccuracy() {
  const token = await login('admin', 'admin123');
  const chat = await request('POST', '/chat', {
    token,
    body: { message: 'What is the leave accrual policy?' },
  });
  if (chat.status !== 200) {
    return result('cost_within_5_percent', false, `chat status=${chat.status}`);
  }

  const metrics = await request('GET', '/metrics', { token });
  if (metrics.status !== 200) {
    return result('cost_within_5_percent', false, `metrics status=${metrics.status}`);
  }

  const reportedCost = chat.data.cost_usd;
  const totalTokens = chat.data.tokens && chat.data.tokens.total;
  if (!totalTokens || reportedCost == null) {
    return result('cost_within_5_percent', false, 'missing tokens/cost fields');
  }

  const expected = (totalTokens / 1000) * EXPECTED_COST_PER_1K;
  const delta = Math.abs(reportedCost - expected) / (expected || 1);
  const pass = delta <= 0.05;
  return result(
    'cost_within_5_percent',
    pass,
    `reported=${reportedCost} expected≈${expected.toFixed(6)} delta=${(delta * 100).toFixed(1)}%`
  );
}

async function main() {
  console.log(`Probing ${BASE}\n`);
  const checks = [
    checkGuestAdminRefusal,
    checkLongEmojiMessage,
    checkExpiredToken,
    checkAlgNoneAndDefaultSecret,
    checkCostAccuracy,
    checkRateLimit,
  ];

  let passed = 0;
  for (const check of checks) {
    try {
      const ok = await check();
      if (ok) passed += 1;
    } catch (err) {
      console.log(`FAIL  ${check.name} — ${err.message}`);
    }
  }

  console.log(`\n${passed}/${checks.length} checks passed`);
  process.exit(passed === checks.length ? 0 : 1);
}

main();
