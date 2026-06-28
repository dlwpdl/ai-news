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

  return [
    `<b>${index + 1}. [${profile.level}][${escapeHTML(profile.category)}][${escapeHTML(profile.shortTitle)}]</b>`,
    `내용: ${escapeHTML(profile.summary)}`,
    `인사이트: ${escapeHTML(profile.insight)}`,
    `출처: ${source} · <a href="${link}">원문 직접</a>`,
    '',
  ].join('\n');
}

function getAIProfile(item: NewsItem) {
  const text = `${item.title} ${item.contentSnippet || ''} ${item.source}`.toLowerCase();
  const level = getAILevel(text);
  const category = getAICategory(text);
  const summary = getSummary(item);
  const shortTitle = truncate(stripHTML(item.title), 58);
  const insight = `${getAIInsight(category, level)} ${getAIExperiment(category)}`;

  return { level, shortTitle, category, summary, insight };
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
  if (level === 'L10') return '논문/연구 후보. 아이디어보다 데이터셋, 평가지표, 베이스라인, 재현 코드가 있는지 먼저 보면 실제 적용 가능성을 빠르게 가를 수 있음.';
  if (category === 'AI 에이전트') return '에이전트 자동화에 붙일 수 있는지 확인할 가치가 있음. 성공 사례보다 실패 조건, 권한 범위, 도구 호출 로그를 먼저 봐야 함.';
  if (category === 'RAG/검색') return '검색 품질, 근거 표시, hallucination 감소에 바로 연결될 수 있음. 기존 RAG 파이프라인의 rerank/query rewrite 단계와 비교하면 됨.';
  if (category === '평가/벤치마크') return '모델이나 프롬프트 선택 기준으로 재사용 가능함. 점수 자체보다 태스크 구성과 채점 기준이 내 워크플로우에 맞는지가 핵심.';
  if (category === '추론/배포') return '비용, 지연시간, 로컬 실행 가능성을 확인할 만함. 같은 입력으로 hosted API 대비 latency/cost/failure rate를 비교하면 바로 판단 가능.';
  if (category === '개발도구/API') return '샌드박스에 최소 호출만 붙여 생산성 개선 여부를 확인하면 됨. SDK 품질, rate limit, 예외 처리 방식이 실제 도입 여부를 좌우함.';
  return '실험 링크나 코드가 있으면 PoC 후보, 없으면 읽기만 하고 넘겨도 됨. 당장 쓸 수 있는 API, repo, benchmark가 있는지 먼저 확인.';
}

function getAIExperiment(category: string): string {
  if (category === '논문/연구') return '실험: 초록과 방법만 읽고 dataset, metric, baseline 3개를 적기.';
  if (category === 'AI 에이전트') return '실험: 읽기 전용 도구 1개로 성공/실패 케이스 5개를 돌리기.';
  if (category === 'RAG/검색') return '실험: 질문 10개로 기존 검색과 정답률/근거 품질을 비교하기.';
  if (category === '평가/벤치마크') return '실험: 대표 프롬프트 10개를 같은 채점 기준으로 재실행하기.';
  if (category === '추론/배포') return '실험: 같은 입력 20개로 latency, cost, 실패율을 측정하기.';
  if (category === '개발도구/API') return '실험: hello-world 호출 후 샘플 10개 결과를 표로 남기기.';
  return '실험: 15분 안에 API/코드/논문 링크가 있는지 확인하기.';
}

function getSummary(item: NewsItem): string {
  const raw = stripHTML(item.contentSnippet || item.title).replace(/\s+/g, ' ').trim();
  return truncate(raw || stripHTML(item.title), 240);
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
    .replace(/>/g, '&gt;');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
