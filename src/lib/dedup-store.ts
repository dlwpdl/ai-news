import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

const DEDUP_TTL = 48 * 60 * 60; // 48시간
const KEY_PREFIX = 'ai-news:sent:';

/**
 * Redis 클라이언트 싱글톤
 */
function getRedisClient(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.log('⚠️ Redis 미설정 - 중복 체크 비활성화');
    return null;
  }

  try {
    redis = new Redis({ url, token });
    return redis;
  } catch (error) {
    console.error('❌ Redis 초기화 실패:', error);
    return null;
  }
}

/**
 * URL 정규화
 */
function normalizeURL(url: string): string {
  try {
    const parsed = new URL(url);
    return (parsed.origin + parsed.pathname).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * 이미 전송된 URL인지 확인하고, 새로운 URL만 필터링하여 반환
 */
export async function filterNewUrls(urls: string[]): Promise<Set<string>> {
  const client = getRedisClient();
  const newUrls = new Set<string>(urls);

  if (!client || urls.length === 0) return newUrls;

  try {
    const pipeline = client.pipeline();
    const normalized = urls.map(u => KEY_PREFIX + normalizeURL(u));

    for (const key of normalized) {
      pipeline.exists(key);
    }

    const results = await pipeline.exec<number[]>();

    const filtered = new Set<string>();
    urls.forEach((url, i) => {
      if (results[i] === 0) {
        filtered.add(url);
      }
    });

    console.log(`🔄 중복 체크: ${urls.length}개 중 ${filtered.size}개 신규`);
    return filtered;
  } catch (error) {
    console.error('❌ Redis 중복 체크 실패 (전체 전송으로 fallback):', error);
    return newUrls;
  }
}

/**
 * 전송된 URL들을 Redis에 저장 (48시간 TTL)
 */
export async function markAsSent(urls: string[]): Promise<void> {
  const client = getRedisClient();
  if (!client || urls.length === 0) return;

  try {
    const pipeline = client.pipeline();

    for (const url of urls) {
      const key = KEY_PREFIX + normalizeURL(url);
      pipeline.setex(key, DEDUP_TTL, '1');
    }

    await pipeline.exec();
    console.log(`✅ ${urls.length}개 URL을 Redis에 저장 (TTL: 48h)`);
  } catch (error) {
    console.error('❌ Redis 저장 실패:', error);
  }
}
