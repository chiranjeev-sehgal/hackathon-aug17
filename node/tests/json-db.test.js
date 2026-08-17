'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-support-jsondb-'));
process.env.DATA_DIR = testDataDir;

const {
  readCollection,
  writeCollection,
  updateCollection,
  clearAll,
  clearCollection,
} = require('../src/db/jsonDb');

before(() => {
  clearAll();
});

after(() => {
  fs.rmSync(testDataDir, { recursive: true, force: true });
});

describe('json db', () => {
  it('persists and reads collections from disk', () => {
    writeCollection('users', {
      demo: { id: 'user_demo', username: 'demo', role: 'Employee' },
    });

    const users = readCollection('users');
    assert.equal(users.demo.username, 'demo');
    assert.ok(fs.existsSync(path.join(testDataDir, 'users.json')));
  });

  it('updates collections atomically via updater', () => {
    writeCollection('metrics', {
      total_requests: 1,
      total_tokens: 10,
      total_cost_usd: 0.01,
      latencies: [5],
    });

    updateCollection('metrics', (metrics) => {
      metrics.total_requests += 1;
      metrics.latencies.push(9);
      return metrics;
    });

    const metrics = readCollection('metrics');
    assert.equal(metrics.total_requests, 2);
    assert.deepEqual(metrics.latencies, [5, 9]);
  });

  it('clearAll resets known collections', () => {
    writeCollection('conversations', {
      conv_1: { id: 'conv_1', userId: 'u1', messages: [] },
    });
    clearCollection('conversations');
    assert.deepEqual(readCollection('conversations'), {});

    clearAll();
    assert.deepEqual(readCollection('users'), {});
    assert.equal(readCollection('metrics').total_requests, 0);
  });
});
