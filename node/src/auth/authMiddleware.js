'use strict';

const { verifyToken } = require('./tokens');
const { findUserByUsername } = require('../store');
const { logSecurityEvent } = require('../observability/logger');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    logSecurityEvent({ event: 'missing_token', path: req.path });
    return res.status(401).json({ detail: 'Not authenticated' });
  }

  try {
    const payload = verifyToken(token);
    const user = findUserByUsername(payload.sub);
    if (!user) {
      logSecurityEvent({ event: 'unknown_user_token', path: req.path });
      return res.status(401).json({ detail: 'Invalid token' });
    }
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };
    return next();
  } catch (err) {
    logSecurityEvent({
      event: 'token_verify_failed',
      path: req.path,
      reason: err.name || 'verify_error',
    });
    return res.status(401).json({ detail: 'Invalid or expired token' });
  }
}

module.exports = { authMiddleware };
