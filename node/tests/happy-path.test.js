'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-support-test-'));
process.env.DATA_DIR = testDataDir;

const { createApp } = require('../src/index');
const { clearAll } = require('../src/db/jsonDb');
const { seedUsers } = require('../src/store');

let server;
let baseUrl;

function request(method, pathName, { token, body } = {}) {
  return fetch(`${baseUrl}${pathName}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

before(async () => {
  clearAll();
  await seedUsers();
  const app = await createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  fs.rmSync(testDataDir, { recursive: true, force: true });
});

describe('happy path', () => {
  it('GET /health returns ok', async () => {
    const res = await request('GET', '/health');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
  });

  it('seed users can log in', async () => {
    for (const [username, password] of [
      ['admin', 'admin123'],
      ['emp', 'emp123'],
      ['guest', 'guest123'],
    ]) {
      const res = await request('POST', '/auth/login', {
        body: { username, password },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.access_token);
      assert.equal(data.token_type, 'bearer');
      assert.equal(data.expires_in, 900);
    }
  });

  it('register assigns Employee role server-side', async () => {
    const username = `user_${Date.now()}`;
    const res = await request('POST', '/auth/register', {
      body: { username, password: 'secret12', role: 'Admin' },
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.username, username);
    assert.equal(data.role, 'Employee');
  });

  it('employee can chat and receive 200 with contract fields', async () => {
    const login = await request('POST', '/auth/login', {
      body: { username: 'emp', password: 'emp123' },
    });
    const { access_token } = await login.json();

    const res = await request('POST', '/chat', {
      token: access_token,
      body: { message: 'How many days of annual leave do employees accrue?' },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.conversation_id);
    assert.equal(typeof data.answer, 'string');
    assert.ok(Array.isArray(data.sources));
    assert.equal(typeof data.confidence, 'number');
    assert.ok(data.tokens);
    assert.equal(typeof data.cost_usd, 'number');
    assert.equal(typeof data.latency_ms, 'number');
  });

  it('employee can fetch own chat history', async () => {
    const login = await request('POST', '/auth/login', {
      body: { username: 'emp', password: 'emp123' },
    });
    const { access_token } = await login.json();

    const chat = await request('POST', '/chat', {
      token: access_token,
      body: { message: 'Remind me about onboarding buddy assignment.' },
    });
    const chatData = await chat.json();

    const hist = await request(
      'GET',
      `/chat/history?conversation_id=${encodeURIComponent(chatData.conversation_id)}`,
      { token: access_token }
    );
    assert.equal(hist.status, 200);
    const data = await hist.json();
    assert.equal(data.conversation_id, chatData.conversation_id);
    assert.ok(Array.isArray(data.messages));
    assert.ok(data.messages.length >= 2);
  });
});
