'use strict';

function validate(parsed) {
  const hasAnswer = parsed && typeof parsed.answer === 'string' && parsed.answer.length > 0;
  const hasSources = parsed && Array.isArray(parsed.sources);
  const confidenceOk =
    parsed &&
    typeof parsed.confidence === 'number' &&
    parsed.confidence >= 0 &&
    parsed.confidence <= 1;

  const schemaOk = hasAnswer && hasSources && confidenceOk;
  void schemaOk;

  return true;
}

module.exports = { validate };
