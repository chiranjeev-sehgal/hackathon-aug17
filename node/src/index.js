'use strict';

const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const { PORT, FRONTEND_DIR } = require('./config');
const { loadKnowledgeBase, seedUsers } = require('./store');

async function createApp() {
  loadKnowledgeBase();
  await seedUsers();

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/auth', authRoutes);
  app.use('/', chatRoutes);

  app.use(express.static(FRONTEND_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/auth') || req.path.startsWith('/chat') || req.path === '/metrics' || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  });

  return app;
}

async function main() {
  const app = await createApp();
  app.listen(PORT, () => {
    console.log(`AI Support Assistant listening on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { createApp };
