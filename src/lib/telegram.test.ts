import assert from 'node:assert/strict';
import test from 'node:test';
import type { NewsItem } from '@/types/news';
import {
  formatGeekNewsList,
  formatNewsList,
  prepareTelegramMessages,
  sendToTelegram,
} from './telegram';

const fullTitle = 'An Explicit World Model Based on Data-First Ontology for Multimodal Storage Validation and Counterfactual Reasoning Evaluation';
const item: NewsItem = {
  title: fullTitle,
  link: 'https://arxiv.org/abs/example',
  source: 'arXiv cs.AI',
  contentSnippet: 'A long research abstract.',
  pubDate: new Date(),
};

test('AI News sends only linked titles even when a digest API key is configured', async t => {
  const keys = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'NVIDIA_API_KEY'] as const;
  const originalEnv = keys.map(key => process.env[key]);
  keys.forEach(key => { process.env[key] = 'test'; });
  t.after(() => keys.forEach((key, index) => {
    if (originalEnv[index] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[index];
  }));
  const requests: Array<{ url: string; body: { text: string; parse_mode: string; link_preview_options: { is_disabled: boolean } } }> = [];
  t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    requests.push({ url: String(input), body: JSON.parse(String(init.body)) });
    return new Response('{}', { status: String(input).includes('api.telegram.org') ? 200 : 400 });
  });
  await sendToTelegram([item]);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.telegram.org/bottest/sendMessage');
  assert.match(requests[0].body.text, /AI 뉴스<\/b> · 1건/);
  assert.ok(requests[0].body.text.includes(`1. <a href="https://arxiv.org/abs/example">${fullTitle}</a>`));
  assert.ok(!requests[0].body.text.includes('A long research abstract.'));
  assert.ok(!/원문 설명|요약|테스트|판단|\[L\d/.test(requests[0].body.text));
  assert.equal(requests[0].body.parse_mode, 'HTML');
  assert.deepEqual(requests[0].body.link_preview_options, { is_disabled: true });
});

function news(index: number): NewsItem {
  return {
    title: `item-${index}`,
    link: `https://example.com/${index}`,
    source: 'Example',
    contentSnippet: `Fallback sentence ${index}. Extra detail should not appear.`,
    pubDate: new Date(),
  };
}

test('GeekNews list renders compact one-line linked titles', () => {
  const [message] = formatGeekNewsList([0, 1].map(index => ({
    title: `한글 제목 ${index} <em>강조</em>`,
    link: `https://news.hada.io/topic?id=${index}`,
    source: 'GeekNews',
    contentSnippet: '요약',
    pubDate: new Date(),
  })));

  assert.match(message, /긱뉴스<\/b> · 2건/);
  assert.match(message, /1\. <a href="https:\/\/news\.hada\.io\/topic\?id=0">한글 제목 0 강조<\/a>/);
  assert.match(message, /2\. <a href="https:\/\/news\.hada\.io\/topic\?id=1">/);
});

test('AI News keeps the full original title', () => {
  const [message] = formatNewsList([item]);
  assert.ok(message.includes(fullTitle));
  assert.ok(!message.includes('…'));
});

test('AI News escapes linked titles and query parameters without including snippets', () => {
  const [message] = formatNewsList([{
    ...item,
    title: 'AI &amp; <em>tools</em>\n &lt;update&gt;',
    link: 'https://example.com/?a=1&b=2',
  }, item]);
  assert.match(message, /AI 뉴스<\/b> · 2건/);
  assert.ok(message.includes('1. <a href="https://example.com/?a=1&amp;b=2">AI &amp; tools &lt;update&gt;</a>'));
  assert.ok(message.includes(`2. <a href="${item.link}">${fullTitle}</a>`));
  assert.ok(!message.includes('A long research abstract.'));
});

test('both lists keep every article intact across multiple messages', () => {
  const items = Array.from({ length: 50 }, (_, index) => ({ ...news(index), title: `제목 ${index} ${'글'.repeat(180)}` }));
  for (const format of [formatGeekNewsList, formatNewsList]) {
    const messages = format(items);

    assert.ok(messages.length > 1);
    assert.ok(messages.every(message => message.length <= 4_096));
    for (const [index, item] of items.entries()) {
      assert.equal(messages.filter(message => message.includes(`href="${item.link}"`)).length, 1);
      assert.ok(messages.some(message => message.includes(item.title) && message.includes(item.link)));
      assert.ok(messages.some(message => message.includes(`${index + 1}. <a href=`)));
    }
  }
});

test('oversized titles keep intact links within Telegram limits', () => {
  const [message] = formatNewsList([{ ...item, title: 'T'.repeat(4_100) }]);
  assert.ok(message.length <= 4_096);
  assert.ok(message.includes('T'.repeat(399) + '…</a>'));
  assert.match(message, /https:\/\/arxiv\.org\/abs\/example/);
  assert.throws(() => prepareTelegramMessages('X'.repeat(4_097)), /too long/);
});
