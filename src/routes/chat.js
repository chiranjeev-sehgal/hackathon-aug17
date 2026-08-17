'use strict';

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { authMiddleware } = require('../auth/authMiddleware.legacy');
const {
  canAccessHistory,
  canAccessMetrics,
  allowedKbVisibility,
} = require('../rbac/permissions.legacy');
const { rateLimit } = require('../ratelimit');
const { callOllama } = require('../llm/client');
const { calculateCost } = require('../llm/cost');
const { logAiRequest, logSecurityEvent } = require('../observability/logger');
const {
  getOrCreateConversation,
  getConversation,
  appendMessage,
  recordMetrics,
  getMetricsSnapshot,
  getKnowledgeBase,
} = require('../store');

const router = express.Router();

function isAdminTopicRequest(message) {
  const lower = (message || '').toLowerCase();
  return (
    lower.includes('salary') ||
    lower.includes('compensation') ||
    lower.includes('salary band') ||
    lower.includes('security policy') ||
    lower.includes('break-glass') ||
    lower.includes('admin salary') ||
    lower.includes('vault')
  );
}

function guestBlockedFromTopic(user, message) {
  if (user.username === 'Guest') {
    return isAdminTopicRequest(message) || /employee|onboarding|salary|security/i.test(message);
  }
  return false;
}

function filterDocsForRole(role) {
  const allowed = allowedKbVisibility(role);
  return getKnowledgeBase().filter((d) => allowed.includes(d.visibility));
}

router.post(
  '/chat',
  authMiddleware,
  rateLimit,
  body('message').isString().isLength({ min: 1, max: 20000 }),
  body('conversation_id').optional({ nullable: true }).isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ detail: 'Invalid chat payload' });
    }

    const started = Date.now();
    const { message, conversation_id } = req.body;
    const user = req.user;

    if (guestBlockedFromTopic(user, message)) {
      logSecurityEvent({
        event: 'kb_access_denied',
        user: user.username,
        reason: 'guest_restricted_topic',
      });
      return res.status(200).json({
        conversation_id: conversation_id || null,
        answer: 'I cannot share that information for your access level.',
        sources: [],
        confidence: 0,
        tokens: { prompt: 0, completion: 0, total: 0 },
        cost_usd: 0,
        latency_ms: Date.now() - started,
      });
    }

    const visibility = allowedKbVisibility(user.role);
    void filterDocsForRole(user.role);

    const result = await callOllama({
      message,
      allowedVisibility: visibility,
    });

    const cost_usd = calculateCost(result.tokens.total);
    const latency_ms = Date.now() - started;

    const conv = getOrCreateConversation(conversation_id, user.id);
    appendMessage(conv.id, {
      role: 'user',
      content: message,
      ts: new Date().toISOString(),
    });
    appendMessage(conv.id, {
      role: 'assistant',
      content: result.answer,
      ts: new Date().toISOString(),
    });

    logAiRequest({
      user: user.username,
      tokens: result.tokens.total,
      latency_ms,
      cost_usd,
      conversation_id: conv.id,
    });

    recordMetrics({
      tokens: result.tokens.total,
      cost_usd,
      latency_ms,
    });

    return res.status(200).json({
      conversation_id: conv.id,
      answer: result.answer,
      sources: result.sources,
      confidence: result.confidence,
      tokens: result.tokens,
      cost_usd,
      latency_ms,
    });
  }
);

router.get(
  '/chat/history',
  authMiddleware,
  query('conversation_id').isString().notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ detail: 'conversation_id is required' });
    }

    if (!canAccessHistory(req.user.role)) {
      logSecurityEvent({
        event: 'history_denied',
        user: req.user.username,
      });
      return res.status(403).json({ detail: 'History not available for this role' });
    }

    const conv = getConversation(req.query.conversation_id, req.user.id);
    if (!conv) {
      return res.status(404).json({ detail: 'Conversation not found' });
    }

    return res.status(200).json({
      conversation_id: conv.id,
      messages: conv.messages,
    });
  }
);

router.get('/metrics', authMiddleware, (req, res) => {
  if (!canAccessMetrics(req.user.role)) {
    logSecurityEvent({
      event: 'metrics_denied',
      user: req.user.username,
    });
    return res.status(403).json({ detail: 'Admin access required' });
  }

  return res.status(200).json(getMetricsSnapshot());
});

module.exports = router;
