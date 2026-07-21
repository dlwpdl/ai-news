import assert from 'node:assert/strict';
import test from 'node:test';
import type { NewsItem } from '@/types/news';
import { selectNewsItems } from './news-selection';

function news(title: string, link: string, source = title): NewsItem {
  return { title, link, source, pubDate: new Date() };
}

test('applies the limit after filtering sent URLs', () => {
  const items = Array.from({ length: 13 }, (_, index) =>
    news(`item-${index}`, `https://source-${index}.example/item`)
  );

  assert.deepEqual(selectNewsItems(items, new Set([items[12].link]), 12), [items[12]]);
});

test('prefers at most three items from one source when alternatives exist', () => {
  const arxiv = Array.from({ length: 4 }, (_, index) =>
    news(`paper-${index}`, `https://arxiv.org/abs/${index}`, `arXiv cs.${index}`)
  );
  const hackerNews = Array.from({ length: 4 }, (_, index) =>
    news(`hn-${index}`, `https://hn-target-${index}.example/item`, `Hacker News (${index}pts)`)
  );
  const alternatives = Array.from({ length: 8 }, (_, index) =>
    news(`alternative-${index}`, `https://alternative-${index}.example/item`)
  );
  const items = [...arxiv, ...hackerNews, ...alternatives];
  const selected = selectNewsItems(items, new Set(items.map(item => item.link)), 12);

  assert.equal(selected.filter(item => item.link.includes('arxiv.org')).length, 3);
  assert.equal(selected.filter(item => item.source.startsWith('Hacker News')).length, 3);
});

test('fills the limit from one source when no alternatives exist', () => {
  const items = Array.from({ length: 5 }, (_, index) =>
    news(`paper-${index}`, `https://arxiv.org/abs/${index}`)
  );

  assert.equal(selectNewsItems(items, new Set(items.map(item => item.link)), 4).length, 4);
});
