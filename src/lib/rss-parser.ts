import Parser from 'rss-parser';
import type { NewsItem, RSSFeed } from '@/types/news';
import { isWithinYesterdayToToday } from './date-utils';

const RSS_FEEDS: RSSFeed[] = [
  // === 주요 AI 기업 블로그 ===
  { url: 'https://openai.com/blog/rss.xml', name: 'OpenAI' },
  { url: 'https://blog.google/technology/ai/rss/', name: 'Google AI' },
  { url: 'https://www.microsoft.com/en-us/research/feed/', name: 'Microsoft Research' },
  { url: 'https://blogs.nvidia.com/feed/', name: 'NVIDIA' },

  // === AI 뉴스 미디어 ===
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'TechCrunch' },
  { url: 'https://venturebeat.com/category/ai/feed/', name: 'VentureBeat' },
  { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', name: 'The Verge' },
  { url: 'https://arstechnica.com/tag/artificial-intelligence/feed/', name: 'Ars Technica' },
  { url: 'https://www.technologyreview.com/feed/', name: 'MIT Tech Review' },

  // === 연구 & 오픈소스 ===
  { url: 'http://news.mit.edu/rss/topic/artificial-intelligence2', name: 'MIT News' },
  { url: 'https://huggingface.co/blog/feed.xml', name: 'Hugging Face' },
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
  console.log(`🔍 URL 중복 제거 후: ${uniqueNews.length}개`);

  // 제목 유사도 기반 중복 제거 (다른 소스의 동일 기사)
  const dedupedNews = removeSimilarTitles(uniqueNews);
  console.log(`🔍 제목 중복 제거 후: ${dedupedNews.length}개`);

  // AI 키워드 필터링
  const aiNews = dedupedNews.filter(item => {
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

// 제목 비교 시 무시할 일반적인 단어들
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to',
  'for', 'of', 'and', 'or', 'but', 'with', 'by', 'from', 'as', 'its',
  'it', 'this', 'that', 'has', 'have', 'had', 'will', 'be', 'been',
  'can', 'could', 'would', 'should', 'may', 'might', 'new', 'how', 'what',
  'why', 'when', 'where', 'who', 'which', 'not', 'no', 'do', 'does',
]);

/**
 * 제목을 정규화하여 비교 가능한 단어 집합으로 변환
 */
function titleToWords(title: string): Set<string> {
  const normalized = title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return new Set(
    normalized.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w))
  );
}

/**
 * 두 단어 집합의 Jaccard 유사도 계산 (0~1)
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 제목 유사도 기반으로 중복 기사 제거
 * 다른 소스에서 같은 뉴스를 보도한 경우를 필터링
 */
function removeSimilarTitles(news: NewsItem[]): NewsItem[] {
  const kept: NewsItem[] = [];
  const keptWordSets: Set<string>[] = [];

  for (const item of news) {
    const words = titleToWords(item.title);

    // 단어가 너무 적으면 유사도 비교가 부정확하므로 무조건 포함
    if (words.size <= 2) {
      kept.push(item);
      keptWordSets.push(words);
      continue;
    }

    let isDuplicate = false;
    for (const existingWords of keptWordSets) {
      if (existingWords.size <= 2) continue;
      if (jaccardSimilarity(words, existingWords) >= 0.5) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(item);
      keptWordSets.push(words);
    }
  }

  return kept;
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
