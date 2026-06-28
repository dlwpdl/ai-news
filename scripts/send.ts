import { filterNewUrls, markAsSent } from '../src/lib/dedup-store';
import { fetchAllNews } from '../src/lib/rss-parser';
import { sendToTelegram } from '../src/lib/telegram';

async function main() {
  const limit = process.env.NEWS_LIMIT ? Number(process.env.NEWS_LIMIT) : undefined;
  const newsItems = await fetchAllNews();
  const newUrls = await filterNewUrls(newsItems.map(item => item.link));
  const uniqueItems = newsItems.filter(item => newUrls.has(item.link)).slice(0, limit);

  if (uniqueItems.length === 0) {
    console.log(`Sent 0/${newsItems.length} AI news items`);
    return;
  }

  await sendToTelegram(uniqueItems);

  await markAsSent(uniqueItems.map(item => item.link));

  console.log(`Sent ${uniqueItems.length}/${newsItems.length} AI news items`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
