import type { NewsItem } from '@/types/news';

const MAX_MESSAGE_LENGTH = 4096;

interface KoreanDigest {
  overview: string[];
  items: KoreanDigestItem[];
}

interface KoreanDigestItem {
  level: string;
  category: string;
  title: string;
  summary: string;
  action: string;
  why: string;
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
      ? formatKoreanDigest(newsItems, digest)
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

function formatKoreanDigest(newsItems: NewsItem[], digest: KoreanDigest): string[] {
  const groups: string[] = [];
  const lines: string[] = [];

  if (newsItems.length > 1 && digest.overview.length > 0) {
    lines.push('<b>핵심 요약</b>');
    lines.push(...digest.overview.map(item => `• ${escapeHTML(item)}`));
    lines.push('');
  }

  lines.push('<b>뉴스 요약</b>');
  let currentGroup = `${lines.join('\n')}\n\n`;

  for (let i = 0; i < newsItems.length; i++) {
    const item = newsItems[i];
    const profile = getAIProfile(item);
    const translated = digest.items[i];
    const level = normalizeLevel(translated?.level) || profile.level;
    const category = translated?.category || profile.category;
    const title = translated?.title || profile.shortTitle;
    const summary = translated?.summary || profile.summary;
    const action = translated?.action || '';
    const why = translated?.why || '';

    const formattedItem = [
      `<b>${i + 1}. [${level}][${escapeHTML(category)}] ${escapeHTML(title)}</b>`,
      `<b>요약</b>: ${escapeHTML(summary)}`,
      action ? `<b>실험</b>: ${escapeHTML(action)}` : '',
      why ? `<b>판단</b>: ${escapeHTML(why)}` : '',
      `${escapeHTML(item.source)} · <a href="${escapeHTML(item.link)}">원문</a>`,
      '',
    ].filter(Boolean).join('\n');

    if (currentGroup && currentGroup.length + formattedItem.length > MAX_MESSAGE_LENGTH - 400) {
      groups.push(currentGroup);
      currentGroup = '';
    }

    currentGroup += formattedItem;
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
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
    '반드시 JSON만 반환하세요: {"overview":["..."],"items":[{"level":"L8","category":"...","title":"...","summary":"...","action":"...","why":"..."}]}',
    'overview는 전체 흐름 1~2개, 각 70자 이내입니다.',
    'items는 입력 순서와 개수를 그대로 맞추세요. category는 12자 이내, title은 35자 이내입니다.',
    'summary는 150~220자, 1~2문장으로 "무엇이 바뀌었고 왜 봐야 하는지"까지 설명하세요.',
    'action은 90자 이내로 내가 코드/워크플로에서 해볼 만한 실험 또는 확인 작업을 쓰세요. 없으면 빈 문자열.',
    'why는 80자 이내로 왜 그 level인지 판단 근거를 쓰세요.',
    '영어 제목을 그대로 두지 말고 자연스러운 한국어로 번역하세요. 고유명사와 제품명은 유지하세요.',
    'level은 AI 개발/자동화 관점에서 중요도, 최신성, 내 코드/워크플로 반영 가능성을 함께 봐서 정하세요. 출처나 소스명만으로 정하지 마세요.',
    'L1: 잡음에 가까운 업계 동향/의견. 행동할 내용 없음.',
    'L2: 일반 제품/회사/기능 소식. 알아두면 되지만 테스트 우선순위 낮음.',
    'L3: 프롬프트 팁, 설정값, 체크리스트. 바로 복사해서 가볍게 시도 가능.',
    'L4: 튜토리얼, 가이드, 노트북. 따라 하며 학습/재현할 가치 있음.',
    'L5: 업무 자동화, 앱 기능, 제품 적용 사례. 내 워크플로에 아이디어로 반영 가능.',
    'L6: API, SDK, CLI, 라이브러리, 오픈소스 도구. 샘플 프로젝트에 붙여볼 실용 가치가 큼.',
    'L7: 추론, 서빙, 배포, 양자화, 로컬 모델, 인프라. 개발 환경/운영에 직접 영향.',
    'L8: 에이전트, RAG, eval, tool use, MCP 등 시스템 구성 방식. 내 AI 앱 구조에 반영할 가치가 큼.',
    'L9: 새 모델 성능, 벤치마크, 파인튜닝, 데이터셋, 평가 방법. 모델 선택/실험 방향에 큰 영향.',
    'L10: 최전선 모델/연구/아키텍처/새 패러다임/고영향 기술 업데이트. 바로 재현 가능하지 않아도 반드시 추적할 만함.',
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
      level: normalizeLevel(item?.level) || '',
      category: truncate(isString(item?.category) ? item.category.trim() : '', 18),
      title: truncate(isString(item?.title) ? item.title.trim() : '', 46),
      summary: truncate(isString(item?.summary) ? item.summary.trim() : '', 260),
      action: truncate(isString(item?.action) ? item.action.trim() : '', 120),
      why: truncate(isString(item?.why) ? item.why.trim() : '', 100),
    };
  });

  if ([...overview, ...items.flatMap(item => [item.category, item.title, item.summary, item.action, item.why])].some(containsCJKIdeograph)) {
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
  if (/frontier|architecture|large-scale training|pretraining|new paradigm|state-of-the-art|sota|breakthrough|reasoning model|최전선|새 패러다임|아키텍처|대규모 학습/.test(text)) return 'L10';
  if (/benchmark suite|dataset|fine-tuning|distillation|alignment|ablation|evaluation protocol|new model|foundation model|paper|논문|벤치마크|파인튜닝/.test(text)) return 'L9';
  if (/agent|rag|eval|tool use|mcp|workflow orchestration|에이전트|평가/.test(text)) return 'L8';
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

function normalizeLevel(value: unknown): string | null {
  if (!isString(value)) return null;
  const match = value.trim().toUpperCase().match(/^L([1-9]|10)$/);
  return match ? `L${match[1]}` : null;
}

function containsCJKIdeograph(text: string): boolean {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(text);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
