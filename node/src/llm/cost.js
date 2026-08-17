'use strict';

const { COST_PER_1K_TOKENS } = require('../config');

function calculateCost(totalTokens) {
  return Number(((totalTokens / 1000) * COST_PER_1K_TOKENS).toFixed(6));
}

module.exports = { calculateCost };
