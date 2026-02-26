import { formatDistanceToNowStrict } from 'date-fns'
import type { Locale } from 'date-fns'

const shortTimeLocale: Pick<Locale, 'formatDistance'> = {
  formatDistance: (token: string, count: number) => {
    const units: Record<string, string> = {
      xSeconds: `${count}s`,
      xMinutes: `${count}m`,
      xHours: `${count}h`,
      xDays: `${count}d`,
      xWeeks: `${count}w`,
      xMonths: `${count}mo`,
      xYears: `${count}y`,
    }
    return units[token] ?? `${count}`
  },
}

export function formatRelativeTime(timestamp: number): string {
  return formatDistanceToNowStrict(new Date(timestamp), {
    locale: shortTimeLocale as Locale,
    roundingMethod: 'floor',
  })
}
