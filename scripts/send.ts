import { filterNewUrls, markAsSent } from '../src/lib/dedup-store';
import { selectNewsItems } from '../src/lib/news-selection';
import { fetchAllNews } from '../src/lib/rss-parser';
import { sendToTelegram } from '../src/lib/telegram';

const MAX_NEWS_ITEMS = 12;

async function main() {
  const limit = parseLimit(process.env.NEWS_LIMIT);
  const newsItems = await fetchAllNews();
  const newUrls = await filterNewUrls(newsItems.map(item => item.link));
  const uniqueItems = selectNewsItems(newsItems, newUrls, limit);

  if (uniqueItems.length === 0) {
    console.log(`Sent 0/${newsItems.length} AI news items`);
    return;
  }

  console.log(`🧭 최종 출처: ${uniqueItems.map(item => item.source).join(', ')}`);
  await sendToTelegram(uniqueItems);

  await markAsSent(uniqueItems.map(item => item.link));

  console.log(`Sent ${uniqueItems.length}/${newsItems.length} AI news items`);
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
