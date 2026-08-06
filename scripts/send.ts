import { filterNewUrls, markAsSent } from '../src/lib/dedup-store';
import { selectNewsItems } from '../src/lib/news-selection';
import { fetchAllNews, fetchGeekNews } from '../src/lib/rss-parser';
import { sendGeekNewsList, sendToTelegram } from '../src/lib/telegram';

const MAX_NEWS_ITEMS = 12;
const MAX_GEEKNEWS_ITEMS = 30;

async function main() {
  const limit = parseLimit(process.env.NEWS_LIMIT);
  const newsItems = await fetchAllNews();
  const geekItems = limit === 0 ? [] : await fetchGeekNews().catch(error => {
    console.error('긱뉴스 수집 실패:', error);
    return [];
  });
  const newUrls = await filterNewUrls([...newsItems, ...geekItems].map(item => item.link));
  const uniqueItems = selectNewsItems(newsItems, newUrls, limit);
  const geekUnique = geekItems.filter(item => newUrls.has(item.link)).slice(0, MAX_GEEKNEWS_ITEMS);

  if (uniqueItems.length === 0 && geekUnique.length === 0) {
    console.log(`Sent 0/${newsItems.length} AI news items`);
    return;
  }

  if (uniqueItems.length > 0) {
    console.log(`🧭 최종 출처: ${uniqueItems.map(item => item.source).join(', ')}`);
    await sendToTelegram(uniqueItems);
  }
  await sendGeekNewsList(geekUnique);

  await markAsSent([...uniqueItems, ...geekUnique].map(item => item.link));

  console.log(`Sent ${uniqueItems.length}/${newsItems.length} AI news + ${geekUnique.length} GeekNews items`);
}

function parseLimit(value: string | undefined): number {
  if (!value) return MAX_NEWS_ITEMS;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error(`NEWS_LIMIT must be a non-negative integer: ${value}`);
  }
  return Math.min(limit, MAX_NEWS_ITEMS);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
