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
        `📭 <b>AI 뉴스</b> · 새로운 뉴스가 없습니다.`,
        `<i>${formatDateCompact()}</i>`,
      ].join('\n'));
      console.log('✅ "새 뉴스 없음" 메시지를 전송했습니다.');
      return;
    }

    const messageGroups = formatNewsList(newsItems);

    for (let i = 0; i < messageGroups.length; i++) {
      await sendMessage(botToken, chatId, messageGroups[i]);

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

/**
 * 긱뉴스 전체를 제목+링크 컴팩트 리스트로 전송 (AI 필터/요약 없음)
 */
export async function sendGeekNewsList(newsItems: NewsItem[]): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('텔레그램 환경 변수가 설정되지 않았습니다.');
  }
  if (newsItems.length === 0) return;

  const messages = formatGeekNewsList(newsItems);
  for (const [index, message] of messages.entries()) {
    await sendMessage(botToken, chatId, message);
    if (index < messages.length - 1) await sleep(1000);
  }
  console.log(`✅ 긱뉴스 ${newsItems.length}건을 전송했습니다.`);
}

export function formatGeekNewsList(newsItems: NewsItem[]): string[] {
  return formatNewsList(newsItems, '긱뉴스', '📰');
}

export function formatNewsList(newsItems: NewsItem[], label = 'AI 뉴스', icon = '🤖'): string[] {
  const header = [
    `${icon} <b>${label}</b> · ${newsItems.length}건`,
    `<i>${formatDateCompact()}</i>`,
  ].join('\n');
  const messages: string[] = [];
  let current = header;
  for (const [index, item] of newsItems.entries()) {
    const title = truncate(stripHTML(item.title).replace(/\s+/g, ' '), 400);
    const line = `${index + 1}. <a href="${escapeHTML(item.link)}">${escapeHTML(title)}</a>`;
    if (current.length + line.length + 1 > MAX_MESSAGE_LENGTH - 200) {
      messages.push(current);
      current = `${icon} <b>${label} 계속</b>`;
    }
    current += `\n${line}`;
  }
  messages.push(current);
  return messages;
}

async function sendMessage(botToken: string, chatId: string, text: string): Promise<void> {
  for (const message of prepareTelegramMessages(text)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message.text,
          ...(message.parseMode ? { parse_mode: message.parseMode } : {}),
          link_preview_options: { is_disabled: true },
        }),
      });

      if (response.ok) break;

      const body = await response.text();
      const retryAfterSeconds = Number(/"retry_after":\s*(\d+)/.exec(body)?.[1]);
      if (attempt === 0 && response.status === 429 && retryAfterSeconds > 0) {
        await sleep(Math.min(retryAfterSeconds, 60) * 1000 + 500);
        continue;
      }
      throw new Error(`Telegram API error ${response.status}: ${body}`);
    }
  }
}

export function prepareTelegramMessages(
  text: string,
): Array<{ text: string; parseMode?: 'HTML' }> {
  if (text.length > MAX_MESSAGE_LENGTH) throw new Error('Telegram message too long');
  return [{ text, parseMode: 'HTML' }];
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
