import type { NewsItem } from '@/types/news';

const MAX_ITEMS_PER_SOURCE = 3;

export function selectNewsItems(
  items: NewsItem[],
  newUrls: ReadonlySet<string>,
  limit: number,
): NewsItem[] {
  if (limit === 0) return [];

  const selected: NewsItem[] = [];
  const deferred: NewsItem[] = [];
  const counts = new Map<string, number>();

  for (const item of items) {
    if (!newUrls.has(item.link)) continue;

    const keys = [`source:${sourceKey(item.source)}`, `domain:${domainKey(item)}`];
    if (keys.some(key => (counts.get(key) || 0) >= MAX_ITEMS_PER_SOURCE)) {
      deferred.push(item);
      continue;
    }

    keys.forEach(key => counts.set(key, (counts.get(key) || 0) + 1));
    selected.push(item);
    if (selected.length === limit) return selected;
  }

  return selected.concat(deferred.slice(0, limit - selected.length));
}

function sourceKey(source: string): string {
  return source.toLowerCase()
    .replace(/\s+\([^)]*\)$/, '')
    .replace(/^arxiv\b.*/, 'arxiv')
    .replace(/:.*/, '');
}

function domainKey(item: NewsItem): string {
  try {
    return new URL(item.link).hostname.toLowerCase().replace(/^(www\.|export\.)/, '');
  } catch {
    return sourceKey(item.source);
  }
}
