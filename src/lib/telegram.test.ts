import assert from 'node:assert/strict';
import test from 'node:test';
import type { NewsItem } from '@/types/news';
import {
  buildKoreanDigest,
  formatKoreanDigest,
  formatNewsItem,
  prepareTelegramMessages,
} from './telegram';

const fullTitle = 'An Explicit World Model Based on Data-First Ontology for Multimodal Storage Validation and Counterfactual Reasoning Evaluation';
const item: NewsItem = {
  title: fullTitle,
  link: 'https://arxiv.org/abs/example',
  source: 'arXiv cs.AI',
  contentSnippet: 'A long research abstract.',
  pubDate: new Date(),
};

function news(index: number): NewsItem {
  return {
    title: `item-${index}`,
    link: `https://example.com/${index}`,
    source: 'Example',
    contentSnippet: `Fallback sentence ${index}. Extra detail should not appear.`,
    pubDate: new Date(),
  };
}

function promptFrom(init?: RequestInit): string {
  const body = JSON.parse(String(init?.body)) as {
    messages: Array<{ content: string }>;
  };
  return body.messages.at(-1)?.content || '';
}

function itemCount(prompt: string): number {
  return prompt.match(/^\d+\.$/gm)?.length || 0;
}

function nvidiaResponse(summaries: string[], action = '', why = ''): Response {
  return new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          overview: ['전체 요약'],
          items: summaries.map(summary => ({
            level: 'L4',
            category: '튜토리얼/가이드',
            summary,
            action,
            why,
          })),
        }),
      },
    }],
  }), { status: 200 });
}

test('fallback rendering keeps the full original title', () => {
  const titleLine = formatNewsItem(item, 0).split('\n')[0];

  assert.ok(titleLine.includes(fullTitle));
  assert.ok(!titleLine.includes('…'));
});

test('Korean digest rendering keeps the full original title without a generated title', () => {
  const [message] = formatKoreanDigest([item], {
    overview: [],
    items: [{
      level: 'L9',
      category: '논문/연구',
      summary: '요약',
      action: '',
      why: '',
    }],
  });
  const titleLine = message.split('\n').find(line => line.startsWith('<b>1.')) || '';

  assert.ok(titleLine.includes(fullTitle));
  assert.ok(!titleLine.includes('…'));
});

test('summarizes at most six items per sequential batch with a native 240 second timeout', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.NVIDIA_API_KEY;
  const originalLog = console.log;
  const timeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout');
  const batchSizes: number[] = [];
  const timeoutCalls: number[] = [];
  const prompts: string[] = [];
  const logs: string[] = [];
  process.env.NVIDIA_API_KEY = 'test-key';
  console.log = (...values: unknown[]) => logs.push(values.join(' '));

  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    value: (milliseconds: number) => {
      timeoutCalls.push(milliseconds);
      return new AbortController().signal;
    },
  });
  globalThis.fetch = async (_input, init) => {
    const prompt = promptFrom(init);
    const count = itemCount(prompt);
    prompts.push(prompt);
    batchSizes.push(count);
    return nvidiaResponse(
      Array.from({ length: count }, () => '요'.repeat(300)),
      'a'.repeat(200),
      'w'.repeat(150),
    );
  };

  try {
    const digest = await buildKoreanDigest(Array.from({ length: 13 }, (_, index) => news(index)), 'AI News');

    assert.deepEqual(batchSizes.sort((a, b) => a - b), [1, 6, 6]);
    assert.deepEqual(timeoutCalls, [240_000, 240_000, 240_000]);
    assert.equal(digest?.items.length, 13);
    assert.ok(digest?.items.every(digestItem => digestItem.summary));
    assert.ok(digest?.items.every(digestItem =>
      digestItem.summary.length <= 160 &&
      digestItem.action.length <= 60 &&
      digestItem.why.length <= 50
    ));
    assert.ok(prompts.every(prompt =>
      !prompt.includes('"title":') &&
      prompt.includes('summary는 100~160자') &&
      prompt.includes('action은 60자 이내') &&
      prompt.includes('why는 50자 이내')
    ));
    assert.ok(logs.some(log => /AI digest success: 3\/3 batches, \d+ms/.test(log)));
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    if (originalApiKey === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = originalApiKey;
    if (timeoutDescriptor) Object.defineProperty(AbortSignal, 'timeout', timeoutDescriptor);
  }
});

test('keeps 13 items aligned when the middle batch exhausts its retry', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.NVIDIA_API_KEY;
  const originalLog = console.log;
  const originalError = console.error;
  const timeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout');
  const calls = new Map<string, number>();
  const logs: string[] = [];
  const timeoutCalls: number[] = [];
  const timeoutSignals: AbortSignal[] = [];
  process.env.NVIDIA_API_KEY = 'test-key';
  console.log = (...values: unknown[]) => logs.push(values.join(' '));
  console.error = () => {};

  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    value: (milliseconds: number) => {
      const signal = new AbortController().signal;
      timeoutCalls.push(milliseconds);
      timeoutSignals.push(signal);
      return signal;
    },
  });
  globalThis.fetch = async (_input, init) => {
    const prompt = promptFrom(init);
    const key = prompt.includes('title: item-0')
      ? 'first'
      : prompt.includes('title: item-6')
        ? 'middle'
        : 'last';
    const attempt = (calls.get(key) || 0) + 1;
    calls.set(key, attempt);

    if (key === 'first' && attempt === 1) {
      return nvidiaResponse(Array.from({ length: 5 }, (_, index) => `요약 ${index}`));
    }
    if (key === 'first') {
      return nvidiaResponse(Array.from({ length: 6 }, (_, index) => `summary-for-item-${index}`));
    }
    if (key === 'middle' && attempt === 1) {
      throw new Error('network failure');
    }
    if (key === 'middle') {
      return nvidiaResponse(['', ...Array.from({ length: 5 }, (_, index) => `요약 ${index + 1}`)]);
    }
    return nvidiaResponse(['summary-for-item-12']);
  };

  try {
    const items = Array.from({ length: 13 }, (_, index) => news(index));
    const digest = await buildKoreanDigest(items, 'AI News');
    const message = formatKoreanDigest(items, digest!).join('\n');

    // middle: 통배치 2회 실패 후 절반(3개)씩 1회 재시도 — 절반들도 mock 응답과 개수 불일치로 실패
    assert.deepEqual(Object.fromEntries(calls), { first: 2, middle: 3, last: 2 });
    assert.deepEqual(timeoutCalls, Array(7).fill(240_000));
    assert.equal(new Set(timeoutSignals).size, 7);
    assert.equal(digest?.items.length, 13);
    assert.ok(digest?.items.slice(0, 6).every(digestItem => digestItem.summary));
    assert.ok(digest?.items.slice(6, 12).every(digestItem => !digestItem.summary));
    assert.equal(digest?.items[12].summary, 'summary-for-item-12');
    assert.match(message, /<b>원문 설명<\/b>: Fallback sentence 6\./);
    assert.ok(!message.includes('Extra detail should not appear.'));
    assert.ok(logs.some(log => /AI digest partial: 2\/3 batches, \d+ms/.test(log)));
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
    if (originalApiKey === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = originalApiKey;
    if (timeoutDescriptor) Object.defineProperty(AbortSignal, 'timeout', timeoutDescriptor);
  }
});

test('halves a failing batch and keeps item alignment', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.NVIDIA_API_KEY;
  const originalLog = console.log;
  const originalError = console.error;
  const batchSizes: number[] = [];
  process.env.NVIDIA_API_KEY = 'test-key';
  console.log = () => {};
  console.error = () => {};

  globalThis.fetch = async (_input, init) => {
    const prompt = promptFrom(init);
    const count = itemCount(prompt);
    batchSizes.push(count);
    if (count === 4) return new Response('error', { status: 500 });
    if (prompt.includes('title: item-0')) {
      return nvidiaResponse(['첫 절반 요약 0', '첫 절반 요약 1']);
    }
    throw new Error('network failure');
  };

  try {
    const digest = await buildKoreanDigest(Array.from({ length: 4 }, (_, index) => news(index)), 'AI News');

    assert.deepEqual(batchSizes, [4, 4, 2, 2]);
    assert.equal(digest?.items.length, 4);
    assert.equal(digest?.items[0].summary, '첫 절반 요약 0');
    assert.equal(digest?.items[1].summary, '첫 절반 요약 1');
    assert.ok(digest?.items.slice(2).every(digestItem => !digestItem.summary));
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
    if (originalApiKey === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = originalApiKey;
  }
});

test('gives up a batch immediately on timeout without retry or halving', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.NVIDIA_API_KEY;
  const originalLog = console.log;
  const originalError = console.error;
  let calls = 0;
  process.env.NVIDIA_API_KEY = 'test-key';
  console.log = () => {};
  console.error = () => {};

  globalThis.fetch = async () => {
    calls++;
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  };

  try {
    assert.equal(await buildKoreanDigest(Array.from({ length: 4 }, (_, index) => news(index)), 'AI News'), null);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
    if (originalApiKey === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = originalApiKey;
  }
});

test('retries only transient HTTP statuses', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.NVIDIA_API_KEY;
  const originalLog = console.log;
  const originalError = console.error;
  process.env.NVIDIA_API_KEY = 'test-key';
  console.log = () => {};
  console.error = () => {};

  try {
    for (const [status, expectedCalls] of [
      [400, 1],
      [401, 1],
      [403, 1],
      [404, 1],
      [408, 2],
      [429, 2],
      [500, 2],
      [503, 2],
    ] as const) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        return new Response('error', { status });
      };

      assert.equal(await buildKoreanDigest([item], 'AI News'), null);
      assert.equal(calls, expectedCalls, `HTTP ${status}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
    if (originalApiKey === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = originalApiKey;
  }
});

test('logs fallback with elapsed time when summarization is disabled', async () => {
  const originalApiKey = process.env.NVIDIA_API_KEY;
  const originalLog = console.log;
  const logs: string[] = [];
  delete process.env.NVIDIA_API_KEY;
  console.log = (...values: unknown[]) => logs.push(values.join(' '));

  try {
    assert.equal(await buildKoreanDigest([item], 'AI News'), null);
    assert.ok(logs.some(log => /AI digest fallback: 0\/1 batches, \d+ms/.test(log)));
  } finally {
    console.log = originalLog;
    if (originalApiKey === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = originalApiKey;
  }
});

test('fallback cleans feed boilerplate and prefers the first complete sentence', () => {
  const rendered = formatNewsItem({
    ...item,
    contentSnippet: 'First useful sentence. Extra detail. The post Example appeared first on Example.com.',
  }, 0);

  assert.match(rendered, /<b>원문 설명<\/b>: First useful sentence\./);
  assert.ok(!rendered.includes('Extra detail.'));
  assert.ok(!rendered.includes('appeared first on'));
});

test('fallback removes arXiv metadata before choosing the first sentence', () => {
  const rendered = formatNewsItem({
    ...item,
    contentSnippet: 'arXiv:2607.12345v1 Announce Type: replace-cross Abstract: First useful result. Extra detail.',
  }, 0);

  assert.match(rendered, /<b>원문 설명<\/b>: First useful result\./);
  assert.ok(!rendered.includes('Announce Type'));
  assert.ok(!rendered.includes('Extra detail.'));
});

test('fallback omits exact comment placeholders', () => {
  for (const contentSnippet of ['Comments', 'Comments (12)', '12 comments', '123 points | 45 comments']) {
    const rendered = formatNewsItem({ ...item, contentSnippet }, 0);
    assert.ok(!rendered.includes('원문 설명'));
    assert.ok(!rendered.includes('<b>내용</b>'));
  }
});

test('fallback truncates only when no complete sentence exists', () => {
  const rendered = formatNewsItem({
    ...item,
    contentSnippet: 'x'.repeat(220),
  }, 0);
  const summaryLine = rendered.split('\n').find(line => line.includes('원문 설명')) || '';

  assert.ok(summaryLine.endsWith('…'));
  assert.ok(summaryLine.length < 220);
});

test('fallback sentence segmentation keeps abbreviations in the first sentence', () => {
  for (const [contentSnippet, sentence] of [
    ['The U.S. agency published guidance. Follow-up detail.', 'The U.S. agency published guidance.'],
    ['Dr. Smith published guidance. Follow-up detail.', 'Dr. Smith published guidance.'],
  ]) {
    const rendered = formatNewsItem({ ...item, contentSnippet }, 0);
    assert.ok(rendered.includes(`<b>원문 설명</b>: ${sentence}`));
    assert.ok(!rendered.includes('Follow-up detail.'));
  }
});

test('classification ignores the source text', () => {
  const rendered = formatNewsItem({
    ...item,
    title: 'Weekly roundup',
    source: 'GitHub Blog',
    contentSnippet: 'General updates',
  }, 0);

  assert.match(rendered, /\[L1\]\[AI 기술뉴스\]/);
});

test('how-to content is classified as a tutorial before agent or paper medium', () => {
  const rendered = formatNewsItem({
    ...item,
    title: 'How to build an agent from a paper',
    contentSnippet: 'A step-by-step guide.',
  }, 0);

  assert.match(rendered, /\[L4\]\[튜토리얼\/가이드\]/);
});

test('topical category wins over the paper medium', () => {
  const rendered = formatNewsItem({
    ...item,
    title: 'Agent evaluation methods',
    contentSnippet: 'This paper compares tool use systems.',
  }, 0);

  assert.match(rendered, /\[AI 에이전트\]/);
});

test('oversized Telegram text is split without truncating the title or link', () => {
  const title = 'T'.repeat(4_100);
  const messages = prepareTelegramMessages(
    `<b>${title}</b>\n<a href="https://example.com/full">원문</a>`,
  );

  assert.ok(messages.length > 1);
  assert.ok(messages.every(message => message.text.length <= 4_096));
  assert.equal(messages.map(message => message.text).join('').match(/T/g)?.length, title.length);
  assert.ok(messages.at(-1)?.text.includes('https://example.com/full'));
  assert.ok(messages.every(message => message.parseMode === undefined));
});
