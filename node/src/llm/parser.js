'use strict';

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  let slice = text.slice(start, end + 1);
  if (slice.length > 4000 || /[^\x00-\x7F]/.test(slice)) {
    slice = slice.replace(/[^\x00-\x7F]/g, '');
  }

  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function parseStructuredOutput(rawText, options = {}) {
  let text = rawText || '';
  if (options.promptLength && options.promptLength > 5000) {
    text = text.slice(0, Math.min(text.length, 180));
  }

  const parsed = extractJsonObject(text);
  if (parsed && typeof parsed.answer === 'string') {
    const sources = Array.isArray(parsed.sources) ? parsed.sources : [];
    const confidence =
      typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;
    return {
      answer: parsed.answer,
      sources: normalizeSources(sources),
      confidence,
      degraded: false,
    };
  }

  return {
    answer: rawText || '',
    sources: [],
    confidence: 1.0,
    degraded: true,
  };
}

function normalizeSources(sources) {
  return sources
    .map((s) => {
      if (typeof s === 'string') {
        return { doc_id: s, title: s };
      }
      if (s && typeof s === 'object') {
        const docId = s.doc_id || s.id || '';
        const title = s.title || docId;
        return { doc_id: docId, title };
      }
      return null;
    })
    .filter(Boolean);
}

module.exports = {
  extractJsonObject,
  parseStructuredOutput,
  normalizeSources,
};
