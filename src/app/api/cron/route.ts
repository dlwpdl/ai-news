import { NextRequest, NextResponse } from 'next/server';
import { fetchAllNews } from '@/lib/rss-parser';
import { sendToTelegram } from '@/lib/telegram';
import { getKSTNow } from '@/lib/date-utils';
import { filterNewUrls, markAsSent } from '@/lib/dedup-store';

/**
 * Vercel Cron Job 핸들러
 * GET /api/cron
 */
export async function GET(request: NextRequest) {
  console.log(`\n🕐 Cron job started at ${getKSTNow().toISOString()}`);

  // Vercel Cron Secret 검증
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ Unauthorized: Invalid cron secret');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // 1. RSS 피드에서 뉴스 수집
    const newsItems = await fetchAllNews();

    // 2. 크로스-런 중복 제거 (Redis)
    const newUrls = await filterNewUrls(newsItems.map(item => item.link));
    const uniqueItems = newsItems.filter(item => newUrls.has(item.link));
    console.log(`🔄 크로스-런 중복 제거: ${newsItems.length}개 → ${uniqueItems.length}개`);

    // 3. 텔레그램으로 전송
    await sendToTelegram(uniqueItems);

    // 4. 전송 성공한 URL을 Redis에 저장
    if (uniqueItems.length > 0) {
      await markAsSent(uniqueItems.map(item => item.link));
    }

    // 5. 성공 응답
    const response = {
      success: true,
      total: newsItems.length,
      sent: uniqueItems.length,
      duplicatesSkipped: newsItems.length - uniqueItems.length,
      timestamp: new Date().toISOString(),
    };

    console.log('✅ Cron job completed successfully:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Cron job failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST 메서드도 지원 (수동 테스트용)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
