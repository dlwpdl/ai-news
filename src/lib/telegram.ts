import type { NewsItem } from '@/types/news';

const MAX_MESSAGE_LENGTH = 4096;

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

    const messageGroups = splitNewsIntoGroups(newsItems);

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
  return truncate(raw || stripHTML(item.title), 480);
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
