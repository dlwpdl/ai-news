import { Telegraf } from 'telegraf';
import type { NewsItem } from '@/types/news';
import { formatKST } from './date-utils';

const MAX_MESSAGE_LENGTH = 4096;

/**
 * 뉴스 항목들을 텔레그램으로 전송
 * @param newsItems 전송할 뉴스 항목 배열
 */
export async function sendToTelegram(newsItems: NewsItem[]): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('텔레그램 환경 변수가 설정되지 않았습니다.');
  }

  const bot = new Telegraf(botToken);

  try {
    // 뉴스가 없는 경우 "새 뉴스 없음" 메시지 전송
    if (newsItems.length === 0) {
      const noNewsMessage = `🤖 *AI News Update*\n📅 ${formatKST(new Date())}\n\n📭 새 뉴스가 없습니다\\.`;
      await bot.telegram.sendMessage(chatId, noNewsMessage, {
        parse_mode: 'Markdown',
      });
      console.log('✅ "새 뉴스 없음" 메시지를 전송했습니다.');
      return;
    }

    // 헤더 메시지
    const header = `🤖 *AI News Update*\n📅 ${formatKST(new Date())}\n📰 총 ${newsItems.length}개의 뉴스\n\n`;

    // 뉴스 항목들을 그룹으로 나누기 (메시지 길이 제한 때문)
    const messageGroups = splitNewsIntoGroups(newsItems);

    // 각 그룹을 별도 메시지로 전송
    for (let i = 0; i < messageGroups.length; i++) {
      const message = i === 0
        ? header + messageGroups[i]
        : messageGroups[i];

      await bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true },
      });

      // 메시지 간 간격 (API rate limit 방지)
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
 * 뉴스 항목을 마크다운 형식으로 포맷팅
 */
function formatNewsItem(item: NewsItem, index: number): string {
  const title = escapeMarkdown(item.title);
  const source = escapeMarkdown(item.source);
  const snippet = item.contentSnippet
    ? escapeMarkdown(item.contentSnippet.substring(0, 150) + '...')
    : '';

  return `
*${index + 1}\\. ${title}*
🔗 ${item.link}
📰 ${source} | 🕐 ${formatKST(item.pubDate)}
${snippet ? `\n_${snippet}_` : ''}
───────────────────
`;
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

    // 현재 그룹에 추가하면 길이 초과하는 경우
    if (currentGroup.length + formattedItem.length > MAX_MESSAGE_LENGTH - 500) {
      if (currentGroup) {
        groups.push(currentGroup);
        currentGroup = '';
      }
    }

    currentGroup += formattedItem;
    itemIndex++;
  }

  // 마지막 그룹 추가
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * 마크다운 특수문자 이스케이프
 */
function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

/**
 * 지연 함수
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
