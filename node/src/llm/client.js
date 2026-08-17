'use strict';

const { OLLAMA_BASE_URL, OLLAMA_MODEL } = require('../config');
const { buildSystemPrompt } = require('../prompts/systemV1');
const { parseStructuredOutput } = require('./parser');
const { getKnowledgeBase } = require('../store');

function selectRelevantDocs(message, allowedVisibility) {
  const docs = getKnowledgeBase().filter((d) =>
    allowedVisibility.includes(d.visibility)
  );
  const lower = (message || '').toLowerCase();

  const scored = docs.map((doc) => {
    const hay = `${doc.title} ${doc.content} ${doc.doc_id}`.toLowerCase();
    let score = 0;
    for (const word of lower.split(/\W+/).filter((w) => w.length > 3)) {
      if (hay.includes(word)) score += 1;
    }
    if (lower.includes('leave') && doc.doc_id.includes('leave')) score += 3;
    if (lower.includes('onboard') && doc.doc_id.includes('onboarding')) score += 3;
    if (
      (lower.includes('salary') || lower.includes('compensation') || lower.includes('band')) &&
      doc.doc_id.includes('salary')
    ) {
      score += 3;
    }
    if (
      (lower.includes('security') || lower.includes('mfa') || lower.includes('vault')) &&
      doc.doc_id.includes('security')
    ) {
      score += 3;
    }
    return { doc, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score > 0).slice(0, 3).map((s) => s.doc);
  if (top.length === 0) {
    return docs.slice(0, 2);
  }
  return top;
}

function buildKbContext(docs) {
  return docs
    .map(
      (d) =>
        `[doc_id=${d.doc_id} title="${d.title}" visibility=${d.visibility}]\n${d.content}`
    )
    .join('\n\n');
}

async function callOllama({ message, allowedVisibility }) {
  const docs = selectRelevantDocs(message, allowedVisibility);
  const system = buildSystemPrompt();
  const context = buildKbContext(docs);

  const userContent = [
    'Knowledge base excerpts:',
    context || '(none)',
    '',
    'User question:',
    message,
    '',
    'Respond with JSON only.',
  ].join('\n');

  const body = {
    model: OLLAMA_MODEL,
    stream: false,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
    format: 'json',
  };

  let rawText = '';
  let promptTokens = 0;
  let completionTokens = 0;

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      rawText = JSON.stringify({
        answer: synthesizeFallbackAnswer(message, docs),
        sources: docs.map((d) => ({ doc_id: d.doc_id, title: d.title })),
        confidence: docs.length ? 0.7 : 0.2,
      });
      promptTokens = Math.ceil(userContent.length / 4);
      completionTokens = Math.ceil(rawText.length / 4);
    } else {
      const data = await response.json();
      rawText = (data.message && data.message.content) || '';
      promptTokens = (data.prompt_eval_count || Math.ceil(userContent.length / 4));
      completionTokens = (data.eval_count || Math.ceil(rawText.length / 4));
    }
  } catch {
    rawText = JSON.stringify({
      answer: synthesizeFallbackAnswer(message, docs),
      sources: docs.map((d) => ({ doc_id: d.doc_id, title: d.title })),
      confidence: docs.length ? 0.65 : 0.2,
    });
    promptTokens = Math.ceil(userContent.length / 4);
    completionTokens = Math.ceil(rawText.length / 4);
  }

  const parsed = parseStructuredOutput(rawText, {
    promptLength: message.length,
  });

  return {
    ...parsed,
    tokens: {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    },
    retrievedDocs: docs,
  };
}

function synthesizeFallbackAnswer(message, docs) {
  if (!docs.length) {
    return 'I do not have enough information in the knowledge base to answer that.';
  }
  const primary = docs[0];
  return `Based on ${primary.title}: ${primary.content.slice(0, 280)}`;
}

module.exports = {
  callOllama,
  selectRelevantDocs,
};
