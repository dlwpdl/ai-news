import type { NewsItem } from '@/types/news';

const MAX_MESSAGE_LENGTH = 4096;

interface KoreanDigest {
  overview: string[];
  items: KoreanDigestItem[];
}

interface KoreanDigestItem {
  title: string;
  summary: string;
}

interface NvidiaChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * 뉴스 항목들을 텔레그램으로 전송
 */
export async function sendToTelegram(newsItems: NewsItem[]): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('텔레그램 환경 변수가 설정되지 않았습니다.');
  }

  try {
    if (newsItems.length === 0) {
      await sendMessage(botToken, chatId, [
        `📭 <b>AI News</b> · 새로운 뉴스가 없습니다.`,
        `<i>${formatDateCompact()}</i>`,
      ].join('\n'));
      console.log('✅ "새 뉴스 없음" 메시지를 전송했습니다.');
      return;
    }

    const header = [
      `📰 <b>AI News</b> · ${newsItems.length}건`,
      `<i>${formatDateCompact()}</i>`,
      '',
    ].join('\n');

    const digest = await buildKoreanDigest(newsItems, 'AI News');
    const messageGroups = digest
      ? [formatKoreanDigest(newsItems, digest)]
      : splitNewsIntoGroups(newsItems);

    for (let i = 0; i < messageGroups.length; i++) {
      const message = i === 0
        ? header + messageGroups[i]
        : messageGroups[i];

      await sendMessage(botToken, chatId, message);

      if (i < messageGroups.length - 1) {
        await sleep(1000);
      }
    }

    console.log(`✅ ${newsItems.length}개의 뉴스를 텔레그램으로 전송했습니다.`);
  } catch (error) {
    console.error('텔레그램 전송 오류:', error);
    throw error;
  }
}

async function sendMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram API error ${response.status}: ${await response.text()}`);
  }
}

/**
 * 뉴스 항목을 HTML 형식으로 포맷팅
 */
function formatNewsItem(item: NewsItem, index: number): string {
  const profile = getAIProfile(item);
  const source = escapeHTML(item.source);
  const link = escapeHTML(item.link);

  return [
    `<b>${index + 1}. [${profile.level}][${escapeHTML(profile.category)}][${escapeHTML(profile.shortTitle)}]</b>`,
    `<b>내용</b>: ${escapeHTML(profile.summary)}`,
    `<b>출처</b>: ${source} · <a href="${link}">원문 직접</a>`,
    '',
  ].join('\n');
}

function formatKoreanDigest(newsItems: NewsItem[], digest: KoreanDigest): string {
  const lines: string[] = [];

  if (digest.overview.length > 0) {
    lines.push('<b>핵심 요약</b>');
    lines.push(...digest.overview.map(item => `• ${escapeHTML(item)}`));
    lines.push('');
  }

  lines.push('<b>뉴스 요약</b>');

  for (let i = 0; i < newsItems.length; i++) {
    const item = newsItems[i];
    const profile = getAIProfile(item);
    const translated = digest.items[i];
    const title = translated?.title || profile.shortTitle;
    const summary = translated?.summary || profile.summary;

    lines.push(`<b>${i + 1}. [${profile.level}][${escapeHTML(profile.category)}] ${escapeHTML(title)}</b>`);
    lines.push(escapeHTML(summary));
    lines.push(`${escapeHTML(item.source)} · <a href="${escapeHTML(item.link)}">원문</a>`);
    lines.push('');
  }

  return lines.join('\n');
}

async function buildKoreanDigest(newsItems: NewsItem[], label: string): Promise<KoreanDigest | null> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.NVIDIA_MODEL || 'minimaxai/minimax-m3',
        messages: [
          {
            role: 'system',
            content: '뉴스를 한국어로 간결하게 번역/요약하는 편집자입니다. 중국어, 일본어, 한자를 절대 섞지 말고 JSON만 출력하세요.',
          },
          {
            role: 'user',
            content: buildDigestPrompt(newsItems, label),
          },
        ],
        max_tokens: 2000,
        temperature: 0.2,
        top_p: 0.95,
      }),
    });

    if (!response.ok) {
      console.error(`NVIDIA 요약 오류 ${response.status}: ${await response.text()}`);
      return null;
    }

    const data = await response.json() as NvidiaChatResponse;
    const text = extractNvidiaText(data);
    return text ? parseKoreanDigest(text, newsItems.length) : null;
  } catch (error) {
    console.error('NVIDIA 요약 오류:', error);
    return null;
  }
}

function buildDigestPrompt(newsItems: NewsItem[], label: string): string {
  const items = newsItems.map((item, index) => [
    `${index + 1}.`,
    `source: ${item.source}`,
    `title: ${stripHTML(item.title)}`,
    `snippet: ${truncate(stripHTML(item.contentSnippet || item.title).replace(/\s+/g, ' '), 600)}`,
  ].join('\n')).join('\n\n');

  return [
    `아래 ${label} 기사 ${newsItems.length}개를 한국어 텔레그램 digest로 요약하세요.`,
    '반드시 JSON만 반환하세요: {"overview":["..."],"items":[{"title":"...","summary":"..."}]}',
    'overview는 전체 흐름 1~2개, 각 70자 이내입니다.',
    'items는 입력 순서와 개수를 그대로 맞추고 title은 35자 이내, summary는 85자 이내입니다.',
    '영어 제목을 그대로 두지 말고 자연스러운 한국어로 번역하세요. 고유명사와 제품명은 유지하세요.',
    '중국어, 일본어, 한자는 금지입니다. 예: 跟不上 같은 표현은 "따라가지 못하는"처럼 한국어로 바꾸세요.',
    '',
    items,
  ].join('\n');
}

function extractNvidiaText(data: NvidiaChatResponse): string {
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function parseKoreanDigest(text: string, itemCount: number): KoreanDigest | null {
  const parsed = JSON.parse(extractJSONObject(text)) as Partial<KoreanDigest>;
  if (!Array.isArray(parsed.items)) return null;

  const overview = (Array.isArray(parsed.overview) ? parsed.overview : [])
    .filter(isString)
    .map(item => truncate(item.trim(), 90))
    .filter(Boolean)
    .slice(0, 2);

  const items = Array.from({ length: itemCount }, (_, index) => {
    const item = parsed.items?.[index];
    return {
      title: truncate(isString(item?.title) ? item.title.trim() : '', 46),
      summary: truncate(isString(item?.summary) ? item.summary.trim() : '', 120),
    };
  });

  if ([...overview, ...items.flatMap(item => [item.title, item.summary])].some(containsCJKIdeograph)) {
    console.error('NVIDIA 요약에 중국어/일본어/한자가 섞여 폐기합니다.');
    return null;
  }

  return { overview, items };
}

function extractJSONObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

function getAIProfile(item: NewsItem) {
  const text = `${item.title} ${item.contentSnippet || ''} ${item.source}`.toLowerCase();
  const level = getAILevel(text);
  const category = getAICategory(text);
  const summary = getSummary(item);
  const shortTitle = truncate(stripHTML(item.title), 58);

  return { level, shortTitle, category, summary };
}

function getAILevel(text: string): string {
  if (/arxiv|paper|논문/.test(text)) return 'L10';
  if (/research|benchmark|new model|foundation model|reasoning|연구|벤치마크/.test(text)) return 'L9';
  if (/agent|rag|eval|fine-tuning|tool use|mcp|에이전트|평가|파인튜닝/.test(text)) return 'L8';
  if (/inference|serving|deploy|quantization|cuda|vllm|onnx|추론|배포/.test(text)) return 'L7';
  if (/api|sdk|cli|library|framework|open source|github|라이브러리|프레임워크|오픈소스/.test(text)) return 'L6';
  if (/workflow|automation|product|feature|자동화|기능/.test(text)) return 'L5';
  if (/tutorial|guide|how to|튜토리얼|가이드/.test(text)) return 'L4';
  if (/tip|prompt|체크리스트|팁/.test(text)) return 'L3';
  if (/release|launch|announces|출시|공개/.test(text)) return 'L2';
  return 'L1';
}

function getAICategory(text: string): string {
  if (/arxiv|paper|논문/.test(text)) return '논문/연구';
  if (/agent|tool use|mcp|에이전트/.test(text)) return 'AI 에이전트';
  if (/rag|retrieval|embedding|vector|임베딩|벡터/.test(text)) return 'RAG/검색';
  if (/eval|benchmark|evaluation|벤치마크|평가/.test(text)) return '평가/벤치마크';
  if (/inference|serving|deploy|quantization|cuda|vllm|onnx|추론|배포/.test(text)) return '추론/배포';
  if (/api|sdk|cli|library|framework|github|open source|라이브러리|프레임워크|오픈소스/.test(text)) return '개발도구/API';
  if (/multimodal|vision|speech|image|video|멀티모달|비전|음성/.test(text)) return '멀티모달';
  return 'AI 기술뉴스';
}

function getSummary(item: NewsItem): string {
  const raw = stripHTML(item.contentSnippet || item.title).replace(/\s+/g, ' ').trim();
  return truncate(raw || stripHTML(item.title), 180);
}

function stripHTML(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

/**
 * 날짜를 간결한 형식으로 포맷
 */
function formatDateCompact(): string {
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const d = String(kst.getDate()).padStart(2, '0');
  const day = days[kst.getDay()];
  const h = String(kst.getHours()).padStart(2, '0');
  const min = String(kst.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${d} (${day}) ${h}:${min}`;
}

/**
 * 뉴스 항목들을 메시지 길이 제한에 맞게 그룹으로 나누기
 */
function splitNewsIntoGroups(newsItems: NewsItem[]): string[] {
  const groups: string[] = [];
  let currentGroup = '';
  let itemIndex = 0;

  for (const item of newsItems) {
    const formattedItem = formatNewsItem(item, itemIndex);

    if (currentGroup.length + formattedItem.length > MAX_MESSAGE_LENGTH - 200) {
      if (currentGroup) {
        groups.push(currentGroup);
        currentGroup = '';
      }
    }

    currentGroup += formattedItem;
    itemIndex++;
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * HTML 특수문자 이스케이프
 */
function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function containsCJKIdeograph(text: string): boolean {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(text);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
