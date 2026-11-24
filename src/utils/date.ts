/** 取本地日期 YYYY-MM-DD（不用 toISOString，避免时区偏移） */
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  return toDateKey(date)
}

/** 计算截至今天（或昨天）的连续打卡天数 */
export function calcStreak(dates: string[]): number {
  const set = new Set(dates)
  let cursor = todayKey()
  if (!set.has(cursor)) cursor = shiftDay(cursor, -1)
  let streak = 0
  while (set.has(cursor)) {
    streak += 1
    cursor = shiftDay(cursor, -1)
  }
  return streak
}

/** 最近 n 天的日期键（从早到晚） */
export function recentDays(n: number): string[] {
  const today = todayKey()
  return Array.from({ length: n }, (_, i) => shiftDay(today, i - (n - 1)))
}

/** 把 YYYY-MM-DD 显示为 M/D */
export function shortDate(key: string): string {
  const [, m, d] = key.split('-')
  return `${Number(m)}/${Number(d)}`
}
