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
 * 뉴스 항목을 HTML 형식으로 포맷팅
 */
function formatNewsItem(item: NewsItem, index: number): string {
  const profile = getAIProfile(item);
  const source = escapeHTML(item.source);
  const link = escapeHTML(item.link);
  const relTime = getRelativeTime(item.pubDate);

  return [
    `<b>${index + 1}. ${escapeHTML(profile.shortTitle)}</b>`,
    `     레벨: ${profile.level} · ${escapeHTML(getLevelName(profile.level))}`,
    `     카테고리: ${escapeHTML(profile.category)}`,
    `     내용: ${escapeHTML(profile.summary)}`,
    `     인사이트: ${escapeHTML(profile.insight)}`,
    `     실험: ${escapeHTML(profile.experiment)}`,
    `     ${source} · ${relTime}`,
    `     출처: <a href="${link}">${source}</a>`,
    '',
  ].join('\n');
}

function getAIProfile(item: NewsItem) {
  const text = `${item.title} ${item.contentSnippet || ''} ${item.source}`.toLowerCase();
  const level = getAILevel(text);
  const category = getAICategory(text);
  const summary = getSummary(item);
  const shortTitle = truncate(stripHTML(item.title), 58);
  const insight = getAIInsight(category, level);
  const experiment = getAIExperiment(category);

  return { level, shortTitle, category, summary, insight, experiment };
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

function getAIInsight(category: string, level: string): string {
  if (level === 'L10') return '연구 후보. 데이터셋/평가지표/베이스라인만 먼저 확인할 가치가 있음';
  if (category === 'AI 에이전트') return '자동화 워크플로우에 붙일 수 있는지 실패 케이스부터 보면 됨';
  if (category === 'RAG/검색') return '검색 품질이나 근거 표시 개선에 바로 연결될 수 있음';
  if (category === '평가/벤치마크') return '모델/프롬프트 선택 기준으로 재사용 가능';
  if (category === '추론/배포') return '비용, 지연시간, 로컬 실행 가능성을 확인할 만함';
  if (category === '개발도구/API') return '샌드박스에 최소 호출만 붙여 생산성 개선 여부를 확인하면 됨';
  return '실험 링크나 코드가 있으면 PoC 후보, 없으면 읽기만 하고 넘겨도 됨';
}

function getAIExperiment(category: string): string {
  if (category === '논문/연구') return '초록과 방법만 읽고 dataset, metric, baseline 3개 적기';
  if (category === 'AI 에이전트') return '읽기 전용 도구 1개로 성공/실패 케이스 5개 돌리기';
  if (category === 'RAG/검색') return '질문 10개로 기존 검색과 정답률/근거 품질 비교';
  if (category === '평가/벤치마크') return '대표 프롬프트 10개를 같은 채점 기준으로 재실행';
  if (category === '추론/배포') return '같은 입력 20개로 latency, cost, 실패율 측정';
  if (category === '개발도구/API') return 'hello-world 호출 후 샘플 10개 결과를 표로 남기기';
  return '15분 안에 API/코드/논문 링크가 있는지 확인';
}

function getLevelName(level: string): string {
  const names: Record<string, string> = {
    L1: 'AI 일반 소식',
    L2: '제품/기능 발표',
    L3: '프롬프트/사용 팁',
    L4: '튜토리얼/가이드',
    L5: '워크플로우 자동화',
    L6: 'API/SDK/오픈소스',
    L7: '추론/배포/운영',
    L8: '에이전트/RAG/Eval',
    L9: '모델/벤치마크 리서치',
    L10: '논문/최전선 연구',
  };
  return names[level] || '분류 보류';
}

function getSummary(item: NewsItem): string {
  const raw = stripHTML(item.contentSnippet || item.title).replace(/\s+/g, ' ').trim();
  return truncate(raw || stripHTML(item.title), 130);
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
