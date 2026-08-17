'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { createUser, findUserByUsername } = require('../store');
const { signToken, getExpiresInSeconds } = require('../auth/tokens');
const { logSecurityEvent } = require('../observability/logger');

const router = express.Router();

router.post(
  '/register',
  body('username').isString().trim().isLength({ min: 2, max: 64 }),
  body('password').isString().isLength({ min: 6, max: 128 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ detail: 'Invalid registration payload' });
    }

    const { username, password } = req.body;
    if (findUserByUsername(username)) {
      return res.status(409).json({ detail: 'Username already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = createUser({
      username,
      password_hash,
      role: 'Employee',
    });

    return res.status(201).json({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  }
);

router.post(
  '/login',
  body('username').isString().trim().notEmpty(),
  body('password').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ detail: 'Invalid login payload' });
    }

    const { username, password } = req.body;
    const user = findUserByUsername(username);
    if (!user) {
      logSecurityEvent({ event: 'login_failed', username });
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      logSecurityEvent({ event: 'login_failed', username });
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    const access_token = signToken({
      sub: user.username,
      role: user.role,
    });

    return res.status(200).json({
      access_token,
      token_type: 'bearer',
      expires_in: getExpiresInSeconds(),
    });
  }
);

module.exports = router;
