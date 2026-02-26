import { useEffect } from 'react'

/**
 * Listen for setting changes dispatched by the interceptor or settings tool.
 * Filters by setting key(s) and calls the callback with the new value.
 *
 * @param keys - A single key or array of keys to listen for
 * @param callback - Called with (key, value) when a matching setting changes
 */
export function useSettingChanged(
  keys: string | string[],
  callback: (key: string, value: unknown) => void,
): void {
  useEffect(() => {
    const keySet = new Set(Array.isArray(keys) ? keys : [keys])

    const handler = (e: Event) => {
      const { key, value } = (e as CustomEvent).detail
      if (keySet.has(key)) {
        callback(key, value)
      }
    }

    window.addEventListener('craft-settings-changed', handler)
    return () => window.removeEventListener('craft-settings-changed', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeof keys === 'string' ? keys : keys.join(',')])
}
