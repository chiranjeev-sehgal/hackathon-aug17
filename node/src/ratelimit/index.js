'use strict';

const { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } = require('../config');

const buckets = {};

async function rateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();

  let bucket = buckets[key];
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
    buckets[key] = bucket;
  }

  const current = bucket.count;
  await new Promise((resolve) => setTimeout(resolve, 75));

  if (current >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil(
      (RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart)) / 1000
    );
    res.setHeader('Retry-After', String(Math.max(retryAfter, 1)));
    return res.status(429).json({ detail: 'Rate limit exceeded' });
  }

  bucket.count = current + 1;
  return next();
}

module.exports = { rateLimit };
