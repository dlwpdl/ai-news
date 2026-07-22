import assert from 'node:assert/strict';
import test from 'node:test';
import type { NewsItem } from '@/types/news';
import { formatKoreanDigest, formatNewsItem } from './telegram';

const fullTitle = 'An Explicit World Model Based on Data-First Ontology for Multimodal Storage Validation and Counterfactual Reasoning Evaluation';
const item: NewsItem = {
  title: fullTitle,
  link: 'https://arxiv.org/abs/example',
  source: 'arXiv cs.AI',
  contentSnippet: 'A long research abstract.',
  pubDate: new Date(),
};

test('fallback rendering keeps the full original title', () => {
  const titleLine = formatNewsItem(item, 0).split('\n')[0];

  assert.ok(titleLine.includes(fullTitle));
  assert.ok(!titleLine.includes('…'));
});

test('Korean digest rendering ignores a shortened generated title', () => {
  const [message] = formatKoreanDigest([item], {
    overview: [],
    items: [{
      level: 'L9',
      category: '논문/연구',
      title: '축약된 제목…',
      summary: '요약',
      action: '',
      why: '',
    }],
  });
  const titleLine = message.split('\n').find(line => line.startsWith('<b>1.')) || '';

  assert.ok(titleLine.includes(fullTitle));
  assert.ok(!titleLine.includes('…'));
});
