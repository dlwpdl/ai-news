import Parser from 'rss-parser';
import type { NewsItem, RSSFeed } from '@/types/news';
import { isWithinYesterdayToToday } from './date-utils';

const RSS_FEEDS: RSSFeed[] = [
  // === 공식 AI 연구소/모델 회사 ===
  { url: 'https://openai.com/news/rss.xml', name: 'OpenAI' },
  { url: 'https://blog.google/technology/ai/rss/', name: 'Google AI' },
  { url: 'https://deepmind.google/blog/rss.xml', name: 'Google DeepMind' },
  { url: 'https://mistral.ai/rss.xml', name: 'Mistral AI' },
  { url: 'https://www.microsoft.com/en-us/research/feed/', name: 'Microsoft Research' },

  // === 논문/대학/리서치 블로그 ===
  { url: 'http://news.mit.edu/rss/topic/artificial-intelligence2', name: 'MIT News AI' },
  { url: 'https://news.mit.edu/rss/topic/machine-learning', name: 'MIT News ML' },
  { url: 'https://bair.berkeley.edu/blog/feed.xml', name: 'Berkeley BAIR' },
  { url: 'https://gradientscience.org/feed.xml', name: 'Stanford Gradient Science' },
  { url: 'https://distill.pub/rss.xml', name: 'Distill' },
  { url: 'https://export.arxiv.org/rss/cs.AI', name: 'arXiv cs.AI' },
  { url: 'https://export.arxiv.org/rss/cs.LG', name: 'arXiv cs.LG' },
  { url: 'https://export.arxiv.org/rss/cs.CL', name: 'arXiv cs.CL' },
  { url: 'https://export.arxiv.org/rss/cs.CV', name: 'arXiv cs.CV' },
  { url: 'https://export.arxiv.org/rss/stat.ML', name: 'arXiv stat.ML' },

  // === 개발자/자동화/LLM 앱 생태계 ===
  { url: 'https://huggingface.co/blog/feed.xml', name: 'Hugging Face' },
  { url: 'https://developer.nvidia.com/blog/feed/', name: 'NVIDIA Developer' },
  { url: 'https://aws.amazon.com/blogs/machine-learning/feed/', name: 'AWS Machine Learning' },
  { url: 'https://weaviate.io/blog/rss.xml', name: 'Weaviate' },
  { url: 'https://github.blog/feed/', name: 'GitHub Blog' },
  { url: 'https://engineering.fb.com/feed/', name: 'Meta Engineering' },
  { url: 'https://lilianweng.github.io/index.xml', name: 'Lilian Weng' },
  { url: 'https://huyenchip.com/feed.xml', name: 'Chip Huyen' },
  { url: 'https://simonwillison.net/atom/everything/', name: 'Simon Willison' },
  { url: 'https://www.latent.space/feed', name: 'Latent Space' },
  { url: 'https://feeds.feedburner.com/geeknews-feed', name: 'GeekNews' },

  // === 선별 뉴스/분석 ===
  { url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', name: 'MIT Tech Review AI' },
  { url: 'https://arstechnica.com/tag/artificial-intelligence/feed/', name: 'Ars Technica AI' },
];

const FETCH_TIMEOUT = 10000; // 10초
const MAX_NEWS_ITEMS = 12;
const GITHUB_TREND_TOPICS = ['llm', 'ai-agent', 'rag'];

// AI 관련 키워드
const AI_KEYWORDS = [
  'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning',
  'neural network', 'llm', 'large language model', 'gpt', 'chatgpt', 'claude',
  'gemini', 'generative ai', 'generative', 'agi', 'openai', 'anthropic',
  'transformer', 'diffusion', 'stable diffusion', 'midjourney', 'dall-e',
  'computer vision', 'nlp', 'natural language', 'reinforcement learning',
  'ai model', 'foundation model', 'multimodal', 'deepmind', 'meta ai',
  'agent', 'agents', 'rag', 'retrieval augmented', 'inference', 'benchmark',
  'eval', 'evaluation', 'fine-tuning', 'fine tuning', 'embedding', 'vector',
  'prompt', 'tool use', 'mcp', 'vllm', 'llama', 'mlx', 'onnx', 'cuda',
  'function calling', 'structured output', 'workflow automation', 'orchestration',
  'reasoning model', 'small language model', 'slm', 'mixture of experts', 'moe',
  '인공지능', '생성형', '머신러닝', '딥러닝', '언어모델', '모델',
  '에이전트', '추론', '임베딩', '벡터', '파인튜닝', '멀티모달',
  '오픈소스', '개발자', '자동화'
];

const PRACTICAL_KEYWORDS = [
  'api', 'sdk', 'cli', 'github', 'open source', 'release', 'model', 'benchmark',
  'eval', 'evaluation', 'agent', 'agents', 'rag', 'inference', 'serving',
  'fine-tuning', 'fine tuning', 'weights', 'dataset', 'paper', 'arxiv',
  'research', 'code', 'library', 'framework', 'tool', 'developer', 'deployment',
  'quantization', 'embedding', 'vector', 'mcp', 'workflow', 'notebook',
  'multimodal', 'reasoning', 'vision', 'speech', 'llmops', 'tutorial',
  'function calling', 'structured output', 'orchestration', 'automation',
  'agentic', 'tool calling', 'observability', 'guardrail',
  '오픈소스', '논문', '연구', '모델', '벤치마크', '평가', '에이전트',
  '개발자', '라이브러리', '프레임워크', '도구', '자동화', '튜토리얼',
  '배포', '추론', '파인튜닝', '임베딩', '멀티모달'
];

const LOW_SIGNAL_KEYWORDS = [
  'funding', 'raised', 'valuation', 'lawsuit', 'copyright', 'policy',
  'regulation', 'election', 'layoffs', 'stock', 'earnings', 'ceo',
  'partnership', 'acquisition', '투자', '인수', '규제', '저작권', '소송',
  '주가', '실적'
];

/**
 * 텍스트가 AI 관련 키워드를 포함하는지 확인
 */
function containsAIKeywords(text: string): boolean {
  const lowerText = text.toLowerCase();
  return AI_KEYWORDS.some(keyword => matchesKeyword(lowerText, keyword));
}

function countMatches(text: string, keywords: string[]): number {
  return keywords.filter(keyword => matchesKeyword(text, keyword)).length;
}

function scoreFocusedAI(item: NewsItem): number {
  const text = `${item.title} ${item.contentSnippet || ''} ${item.source}`.toLowerCase();
  const sourceBoost = /arxiv|deepmind|mistral|research|bair|gradient|distill|lilian|chip huyen|simon willison|latent space|developer|hugging face|weaviate|geeknews|aws|github|engineering|mit news/i.test(item.source) ? 4 : 0;
  return sourceBoost + countMatches(text, PRACTICAL_KEYWORDS) * 2 - countMatches(text, LOW_SIGNAL_KEYWORDS) * 3;
}

function isFocusedAI(item: NewsItem): boolean {
  return scoreFocusedAI(item) > 0;
}

function matchesKeyword(text: string, keyword: string): boolean {
  if (/[^\x00-\x7F]/.test(keyword) || keyword.includes(' ')) {
    return text.includes(keyword);
  }
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}([^a-z0-9]|$)`, 'i').test(text);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 모든 RSS 피드에서 뉴스 수집
 * @returns AI 관련 키워드로 필터링된 뉴스 항목 배열
 */
export async function fetchAllNews(): Promise<NewsItem[]> {
  console.log(`📡 ${RSS_FEEDS.length}개의 RSS 피드에서 뉴스 수집 시작...`);

  // 모든 RSS 피드를 병렬로 파싱
  const [rssResults, extraResults] = await Promise.all([
    Promise.allSettled(
      RSS_FEEDS.map(feed => fetchRSSFeed(feed))
    ),
    Promise.allSettled([
      fetchAnthropicPages(),
      fetchGitHubTrendingAI(),
    ]),
  ]);

  // 성공한 결과만 추출
  const allNews: NewsItem[] = [];
  rssResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allNews.push(...result.value);
      console.log(`✅ ${RSS_FEEDS[index].name}: ${result.value.length}개`);
    } else {
      console.error(`❌ ${RSS_FEEDS[index].name}: ${result.reason}`);
    }
  });
  extraResults.forEach(result => {
    if (result.status === 'fulfilled') {
      allNews.push(...result.value);
      console.log(`✅ 추가 소스: ${result.value.length}개`);
    } else {
      console.error(`❌ 추가 소스: ${result.reason}`);
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

  // 실험/적용 가능한 기술 뉴스만 남김
  const focusedNews = aiNews.filter(isFocusedAI);
  console.log(`🧪 실무/연구 필터링 후: ${focusedNews.length}개`);

  // 날짜 필터링 (어제 00:00 ~ 현재)
  const filteredNews = focusedNews.filter(item =>
    isWithinYesterdayToToday(item.pubDate)
  );
  console.log(`📅 날짜 필터링 후: ${filteredNews.length}개`);

  // 실무성 점수 우선, 같은 점수면 최신순
  filteredNews.sort((a, b) =>
    scoreFocusedAI(b) - scoreFocusedAI(a) ||
    b.pubDate.getTime() - a.pubDate.getTime()
  );

  const finalNews = filteredNews.slice(0, MAX_NEWS_ITEMS);
  console.log(`✨ 최종 반환: ${finalNews.length}개`);

  return finalNews;
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

async function fetchAnthropicPages(): Promise<NewsItem[]> {
  const paths = await Promise.all([
    fetchAnthropicLinks('https://www.anthropic.com/news', '/news/'),
    fetchAnthropicLinks('https://www.anthropic.com/research', '/research/'),
  ]);

  const urls = [...new Set(paths.flat())]
    .filter(path => !path.startsWith('/research/team/'))
    .slice(0, 10)
    .map(path => `https://www.anthropic.com${path}`);

  const pages = await Promise.allSettled(urls.map(fetchAnthropicPage));
  return pages.flatMap(page => page.status === 'fulfilled' && page.value ? [page.value] : []);
}

async function fetchAnthropicLinks(url: string, prefix: string): Promise<string[]> {
  const html = await fetchText(url, 'NewsBot/1.0');
  return [...new Set([...html.matchAll(new RegExp(`href="(${prefix}[^"]+)"`, 'g'))].map(match => match[1]))];
}

async function fetchAnthropicPage(url: string): Promise<NewsItem | null> {
  const html = await fetchText(url, 'NewsBot/1.0');
  const title = decodeHTML(html.match(/<title>(.*?)<\/title>/)?.[1] || '')
    .replace(/\s*\\\s*Anthropic$/, '')
    .trim();

  if (!title) return null;

  return {
    title,
    link: url,
    pubDate: new Date(),
    contentSnippet: decodeHTML(html.match(/<meta name="description" content="([^"]*)"/)?.[1] || ''),
    source: 'Anthropic',
  };
}

async function fetchGitHubTrendingAI(): Promise<NewsItem[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const results = await Promise.allSettled(
    GITHUB_TREND_TOPICS.map(topic => fetchGitHubRepos(`topic:${topic}+stars:%3E50+pushed:%3E${since}`))
  );

  const repos = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  return removeDuplicates(repos).slice(0, 8);
}

interface GitHubRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  pushed_at: string;
}

async function fetchGitHubRepos(query: string): Promise<NewsItem[]> {
  const url = `https://api.github.com/search/repositories?q=${query}&sort=updated&order=desc&per_page=5`;
  const json = await fetchJSON<{ items?: GitHubRepo[] }>(url, 'NewsBot/1.0');

  return (json.items || []).map(repo => ({
    title: repo.full_name,
    link: repo.html_url,
    pubDate: new Date(repo.pushed_at),
    contentSnippet: `${repo.description || 'No description'} · ${repo.stargazers_count.toLocaleString()} stars`,
    source: `GitHub AI Trends (${repo.stargazers_count.toLocaleString()}★)`,
  }));
}

async function fetchText(url: string, userAgent: string): Promise<string> {
  const response = await fetchWithTimeout(url, userAgent);
  return response.text();
}

async function fetchJSON<T>(url: string, userAgent: string): Promise<T> {
  const response = await fetchWithTimeout(url, userAgent);
  return response.json() as Promise<T>;
}

async function fetchWithTimeout(url: string, userAgent: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/vnd.github+json, text/html',
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHTML(text: string): string {
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
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
