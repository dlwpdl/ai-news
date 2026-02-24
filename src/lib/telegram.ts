import { Telegraf } from 'telegraf';
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

  const bot = new Telegraf(botToken);

  try {
    if (newsItems.length === 0) {
      await bot.telegram.sendMessage(chatId, [
        `📭 <b>AI News</b> · 새로운 뉴스가 없습니다.`,
        `<i>${formatDateCompact()}</i>`,
      ].join('\n'), { parse_mode: 'HTML' });
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

      await bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });

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
 * 뉴스 항목을 HTML 형식으로 포맷팅 (깔끔한 2줄 포맷)
 */
function formatNewsItem(item: NewsItem, index: number): string {
  const title = escapeHTML(item.title);
  const source = escapeHTML(item.source);
  const relTime = getRelativeTime(item.pubDate);

  return [
    `<b>${index + 1}.</b> <a href="${item.link}">${title}</a>`,
    `     ${source} · ${relTime}`,
    '',
  ].join('\n');
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
 * 상대 시간 계산
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return '어제';
  return `${diffDay}일 전`;
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
    .replace(/>/g, '&gt;');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
