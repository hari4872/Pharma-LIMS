import { useEffect, useRef, useState, useCallback } from 'react'
import * as signalR from '@microsoft/signalr'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'

export interface LiveNotif {
  id: string
  text: string
  time: string       // formatted relative time label
  rawTime: Date
  icon: string
  read: boolean
  category: 'tat' | 'oos' | 'calibration' | 'overdue' | 'system'
}

const MAX_NOTIFS = 30

function iconFor(category: LiveNotif['category']): string {
  switch (category) {
    case 'tat':         return '⏱'
    case 'oos':         return '⚠'
    case 'calibration': return '🔧'
    case 'overdue':     return '🚨'
    default:            return '🔔'
  }
}

function relativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.floor(diffH / 24)}d ago`
}

export function useNotifications() {
  const token   = useSelector((s: RootState) => s.auth.token)
  const labId   = useSelector((s: RootState) => s.auth.labId)
  const userId  = useSelector((s: RootState) => s.auth.userId)

  const [notifs, setNotifs]       = useState<LiveNotif[]>([])
  const [connected, setConnected] = useState(false)
  const connRef = useRef<signalR.HubConnection | null>(null)

  const addNotif = useCallback((text: string, category: LiveNotif['category']) => {
    const now = new Date()
    const n: LiveNotif = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      time: relativeTime(now),
      rawTime: now,
      icon: iconFor(category),
      read: false,
      category,
    }
    setNotifs(prev => [n, ...prev].slice(0, MAX_NOTIFS))
  }, [])

  // Refresh relative-time labels every minute
  useEffect(() => {
    const t = setInterval(() => {
      setNotifs(prev => prev.map(n => ({ ...n, time: relativeTime(n.rawTime) })))
    }, 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!token) return

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? import.meta.env.DEV ? 'http://localhost:5204' : window.location.origin
    const hubUrl = String(apiBase).replace(/\/api\/v1\/?$/, '') + '/hubs/lims'

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${hubUrl}?access_token=${token}`, {
        accessTokenFactory: () => token,
        skipNegotiation: false,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    connRef.current = conn

    // ── Server-pushed event handlers ───────────────────────────────────────

    // TAT breach (from TATBreachJob → NotificationService.PushToGroupAsync)
    conn.on('TATBreach', (msg: string) => addNotif(msg, 'tat'))

    // OOS detected (from OosDetectionService → PushToGroupAsync)
    conn.on('OOSDetected', (msg: string) => addNotif(msg, 'oos'))

    // Calibration due reminder (from CalibrationDueDateJob)
    conn.on('CalibrationDending', (msg: string) => addNotif(msg, 'calibration'))
    conn.on('CalibrationDue', (msg: string) => addNotif(msg, 'calibration'))

    // Overdue escalation (from WorkQueueEscalationJob)
    conn.on('TaskOverdue', (msg: string) => addNotif(msg, 'overdue'))

    // Generic notification channel
    conn.on('Notify', (msg: string) => addNotif(msg, 'system'))

    // Pull reminders (from PullReminderJob)
    conn.on('PullReminder', (msg: string) => addNotif(msg, 'system'))

    // Sampling due (from SamplingSchedulerJob)
    conn.on('SamplingDue', (payload: { planName: string; msg: string }) => {
      addNotif(payload.msg ?? `Sampling due: ${payload.planName}`, 'system')
    })

    conn.onreconnected(() => {
      setConnected(true)
      // Re-join the lab group after reconnect
      if (labId) conn.invoke('JoinGroup', `Lab-${labId}`).catch(() => {})
      if (userId) conn.invoke('JoinGroup', `User-${userId}`).catch(() => {})
    })
    conn.onclose(() => setConnected(false))

    conn.start()
      .then(() => {
        setConnected(true)
        // Join the lab group and personal user group
        if (labId) conn.invoke('JoinGroup', `Lab-${labId}`).catch(() => {})
        if (userId) conn.invoke('JoinGroup', `User-${userId}`).catch(() => {})
        // All users join the broadcast group
        conn.invoke('JoinGroup', 'AllUsers').catch(() => {})
      })
      .catch(err => {
        // Silent fail — real-time is enhancement, not critical
        console.warn('[SignalR] Could not connect to hub:', err?.message)
      })

    return () => {
      conn.stop().catch(() => {})
    }
  }, [token, labId, userId, addNotif])

  const markAllRead = useCallback(() => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const markRead = useCallback((id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const unreadCount = notifs.filter(n => !n.read).length

  return { notifs, unreadCount, connected, markAllRead, markRead }
}
