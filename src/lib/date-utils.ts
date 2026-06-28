/**
 * KST 기준으로 날짜가 어제 00:00 ~ 현재 시간 범위 내에 있는지 확인
 * @param date 확인할 날짜
 * @returns 어제 00:00 ~ 현재 시간 범위 내에 있으면 true
 */
export function isWithinYesterdayToToday(date: Date): boolean {
  try {
    // UTC 날짜를 KST로 변환
    const kstDate = new Date(
      date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
    );

    // 현재 시간을 KST로 변환
    const now = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
    );

    // 어제 00:00:00 (KST)
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // 현재 시간 (크론탭 실행 시간)
    return kstDate >= yesterday && kstDate <= now;
  } catch (error) {
    console.error('Date filtering error:', error);
    return false;
  }
}

/**
 * KST 기준 현재 날짜/시간 반환
 */
export function getKSTNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}
