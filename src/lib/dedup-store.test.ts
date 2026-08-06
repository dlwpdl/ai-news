import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import test from 'node:test';

test('query params distinguish URLs but tracking params do not', async () => {
  process.env.SENT_URLS_FILE = '.cache/test-sent.json';
  const { filterNewUrls, markAsSent } = await import('./dedup-store');

  try {
    await markAsSent(['https://news.hada.io/topic?id=1']);
    const fresh = await filterNewUrls([
      'https://news.hada.io/topic?id=1',
      'https://news.hada.io/topic?id=1&utm_source=x',
      'https://news.hada.io/topic?id=2',
    ]);

    assert.deepEqual([...fresh], ['https://news.hada.io/topic?id=2']);
  } finally {
    await rm('.cache/test-sent.json', { force: true });
  }
});
