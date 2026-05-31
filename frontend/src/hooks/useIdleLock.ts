import { useEffect, useRef, useState, useCallback } from 'react'

export function useIdleLock(idleMinutes = 15, enabled = true) {
  const [isLocked, setIsLocked] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    if (!enabled || isLocked) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setIsLocked(true), idleMinutes * 60 * 1000)
  }, [idleMinutes, enabled, isLocked])

  useEffect(() => {
    if (!enabled) return
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      events.forEach(e => document.removeEventListener(e, resetTimer))
      if (timer.current) clearTimeout(timer.current)
    }
  }, [resetTimer, enabled])

  const unlock = useCallback(() => {
    setIsLocked(false)
    if (timer.current) clearTimeout(timer.current)
    // restart idle timer after unlock
    timer.current = setTimeout(() => setIsLocked(true), idleMinutes * 60 * 1000)
  }, [idleMinutes])

  return { isLocked, unlock }
}
