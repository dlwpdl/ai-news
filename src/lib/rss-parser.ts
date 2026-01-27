import Parser from 'rss-parser';
import type { NewsItem, RSSFeed } from '@/types/news';
import { isWithinYesterdayToToday } from './date-utils';

const RSS_FEEDS: RSSFeed[] = [
  {
    url: 'https://bair.berkeley.edu/blog/feed.xml',
    name: 'Berkeley BAIR',
  },
  {
    url: 'https://becominghuman.ai/feed',
    name: 'Becoming Human AI',
  },
  {
    url: 'http://news.mit.edu/rss/topic/artificial-intelligence2',
    name: 'MIT AI News',
  },
  {
    url: 'https://blogs.nvidia.com/feed/',
    name: 'NVIDIA AI Blog',
  },
  {
    url: 'https://davidstutz.de/feed/',
    name: 'David Stutz Blog',
  },
  {
    url: 'https://www.reddit.com/r/artificial/.rss',
    name: 'Reddit r/artificial',
  },
  {
    url: 'https://www.reddit.com/r/neuralnetworks/.rss',
    name: 'Reddit r/neuralnetworks',
  },
  {
    url: 'https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml',
    name: 'Science Daily AI',
  },
  {
    url: 'https://danieltakeshi.github.io/feed.xml',
    name: 'Daniel Takeshi Blog',
  },
  {
    url: 'https://vitalab.github.io/feed.xml',
    name: 'VITAlab',
  },
  {
    url: 'https://medium.com/feed/@karpathy',
    name: 'Andrej Karpathy',
  },
  {
    url: 'https://openai.com/blog/rss.xml',
    name: 'OpenAI Blog',
  },
  {
    url: 'https://www.microsoft.com/en-us/research/feed/',
    name: 'Microsoft Research',
  },
  {
    url: 'https://ai.googleblog.com/feeds/posts/default',
    name: 'Google AI Blog',
  },
  {
    url: 'http://nlp.fast.ai/feed.xml',
    name: 'Fast AI',
  },
];

const FETCH_TIMEOUT = 10000; // 10초

// AI 관련 키워드
const AI_KEYWORDS = [
  'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning',
  'neural network', 'llm', 'large language model', 'gpt', 'chatgpt', 'claude',
  'gemini', 'generative ai', 'generative', 'agi', 'openai', 'anthropic',
  'transformer', 'diffusion', 'stable diffusion', 'midjourney', 'dall-e',
  'computer vision', 'nlp', 'natural language', 'reinforcement learning',
  'ai model', 'foundation model', 'multimodal', 'deepmind', 'meta ai'
];

/**
 * 텍스트가 AI 관련 키워드를 포함하는지 확인
 */
function containsAIKeywords(text: string): boolean {
  const lowerText = text.toLowerCase();
  return AI_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * 모든 RSS 피드에서 뉴스 수집
 * @returns AI 관련 키워드로 필터링된 뉴스 항목 배열
 */
export async function fetchAllNews(): Promise<NewsItem[]> {
  console.log(`📡 ${RSS_FEEDS.length}개의 RSS 피드에서 뉴스 수집 시작...`);

  // 모든 RSS 피드를 병렬로 파싱
  const results = await Promise.allSettled(
    RSS_FEEDS.map(feed => fetchRSSFeed(feed))
  );

  // 성공한 결과만 추출
  const allNews: NewsItem[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allNews.push(...result.value);
      console.log(`✅ ${RSS_FEEDS[index].name}: ${result.value.length}개`);
    } else {
      console.error(`❌ ${RSS_FEEDS[index].name}: ${result.reason}`);
    }
  });

  console.log(`📊 총 수집된 뉴스: ${allNews.length}개`);

  // 중복 제거 (URL 기준)
  const uniqueNews = removeDuplicates(allNews);
  console.log(`🔍 중복 제거 후: ${uniqueNews.length}개`);

  // AI 키워드 필터링
  const aiNews = uniqueNews.filter(item => {
    const textToCheck = `${item.title} ${item.contentSnippet || ''}`;
    return containsAIKeywords(textToCheck);
  });
  console.log(`🤖 AI 키워드 필터링 후: ${aiNews.length}개`);

  // 날짜 필터링 (어제 00:00 ~ 현재)
  const filteredNews = aiNews.filter(item =>
    isWithinYesterdayToToday(item.pubDate)
  );
  console.log(`📅 날짜 필터링 후: ${filteredNews.length}개`);

  // 발행일 기준 정렬 (최신순)
  filteredNews.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  console.log(`✨ 최종 반환: ${filteredNews.length}개`);

  return filteredNews;
}

/**
 * 단일 RSS 피드 파싱
 */
async function fetchRSSFeed(feed: RSSFeed): Promise<NewsItem[]> {
  const parser = new Parser({
    timeout: FETCH_TIMEOUT,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
    },
  });

  try {
    const rssFeed = await parser.parseURL(feed.url);

    const items: NewsItem[] = (rssFeed.items || [])
      .filter(item => item.link && item.title && item.pubDate)
      .map(item => ({
        title: item.title!,
        link: item.link!,
        pubDate: new Date(item.pubDate!),
        contentSnippet: item.contentSnippet || item.content || undefined,
        source: feed.name,
      }));

    return items;
  } catch (error) {
    throw new Error(`Failed to parse ${feed.name}: ${error}`);
  }
}

/**
 * URL 기준으로 중복 제거
 */
function removeDuplicates(news: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return news.filter(item => {
    const normalized = normalizeURL(item.link);
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

/**
 * URL 정규화 (쿼리 파라미터 제거, 소문자 변환)
 */
function normalizeURL(url: string): string {
  try {
    const parsed = new URL(url);
    return (parsed.origin + parsed.pathname).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
