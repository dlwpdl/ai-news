import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const DEDUP_TTL_MS = 72 * 60 * 60 * 1000;
const SENT_URLS_FILE = process.env.SENT_URLS_FILE || '.cache/ai-news-sent.json';

type SentUrls = Record<string, number>;

export async function filterNewUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();

  const sent = prune(await readSentUrls());
  const fresh = urls.filter(url => !sent[normalizeURL(url)]);
  console.log(`🔄 중복 체크: ${urls.length}개 중 ${fresh.length}개 신규`);
  return new Set(fresh);
}

export async function markAsSent(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  const sent = prune(await readSentUrls());
  const now = Date.now();

  for (const url of urls) {
    sent[normalizeURL(url)] = now;
  }

  await mkdir(dirname(SENT_URLS_FILE), { recursive: true });
  await writeFile(SENT_URLS_FILE, JSON.stringify(sent), 'utf8');
  console.log(`✅ ${urls.length}개 URL을 중복 캐시에 저장`);
}

async function readSentUrls(): Promise<SentUrls> {
  try {
    return JSON.parse(await readFile(SENT_URLS_FILE, 'utf8')) as SentUrls;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return {};
    }
    console.error('❌ 중복 캐시 읽기 실패 (전체 신규 처리):', error);
    return {};
  }
}

function prune(sent: SentUrls): SentUrls {
  const minTime = Date.now() - DEDUP_TTL_MS;
  return Object.fromEntries(
    Object.entries(sent).filter(([, time]) => time >= minTime)
  );
}

function normalizeURL(url: string): string {
  try {
    const parsed = new URL(url);
    return (parsed.origin + parsed.pathname).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
