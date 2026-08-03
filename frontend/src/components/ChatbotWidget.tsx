import { useState, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import type { RootState } from '@/store'

const API = '/api/v1/chatbot'

type Tab = 'quick' | 'chat'

interface Message {
  role: 'user' | 'aria'
  text: string
  loading?: boolean
}

const QUICK_ACTIONS = [
  { id: 'attention',         label: 'What needs my attention?' },
  { id: 'pending-approvals', label: 'Pending approvals' },
  { id: 'sample-status',     label: 'Sample status' },
  { id: 'equipment-status',  label: 'Equipment availability' },
  { id: 'overdue-tasks',     label: 'Overdue tasks' },
  { id: 'oos-results',       label: 'Out-of-spec results' },
]

// ── Module link registry ──────────────────────────────────────────────────
// Each entry: regex to detect in Aria text → label + route
const MODULE_REGISTRY: { re: RegExp; label: string; path: string }[] = [
  { re: /\bsample\s+(registration|management|module)\b/i,    label: 'Sample Registration',    path: '/samples' },
  { re: /\bwork\s*queue\b/i,                                  label: 'Work Queue',              path: '/work-queue' },
  { re: /\bdigital\s*logbook\b/i,                             label: 'Digital Logbook',         path: '/digital-logbook' },
  { re: /\boos\s*(invest|investig)/i,                         label: 'OOS Investigations',      path: '/oos-investigations' },
  { re: /\bcoa\s+review\b|\bcertificate\s+of\s+analysis\b/i, label: 'CoA Review',              path: '/coa-review' },
  { re: /\bdispatch\s+qc\b/i,                                 label: 'Dispatch QC',             path: '/dispatch-qc' },
  { re: /\bresults?\s+review\b/i,                             label: 'Results Review',          path: '/results-review' },
  { re: /\bbatch\s+release\b/i,                               label: 'Batch Release',           path: '/batch-release' },
  { re: /\bdashboard\b/i,                                     label: 'Dashboard',               path: '/dashboard' },
  { re: /\bcompliance\s+(panel|module)\b/i,                   label: 'Compliance Panel',        path: '/compliance' },
  { re: /\breports?\s*(&|and)\s*exports?\b|\breports?\s+module\b/i, label: 'Reports & Exports', path: '/reports' },
  { re: /\bstability\s+pulls?\b/i,                            label: 'Stability Pulls',         path: '/stability-pulls' },
  { re: /\bretain\s+samples?\b/i,                             label: 'Retain Samples',          path: '/retain-samples' },
  { re: /\btraceability\s+(module|page)\b/i,                  label: 'Traceability',            path: '/traceability' },
  { re: /\bcapa\b|\bquality\s+events?\b/i,                    label: 'CAPA / Quality Events',   path: '/quality-events' },
  { re: /\bspc\b|\bstatistical\s+process\s+control\b|\btrending\s+module\b/i, label: 'SPC / Trending', path: '/spc' },
  { re: /\bcheckpoints?\s+(module|page)\b/i,                  label: 'Checkpoints',             path: '/checkpoints' },
  { re: /\bstability\s+study\b/i,                             label: 'Stability Study',         path: '/stability-study' },
]

// Quick-action → always-show relevant links
const QUICK_GOTO: Record<string, { label: string; path: string }[]> = {
  'attention':         [{ label: 'Sample Registration', path: '/samples' }, { label: 'OOS Investigations', path: '/oos-investigations' }],
  'pending-approvals': [{ label: 'Sample Registration', path: '/samples' }, { label: 'CoA Review', path: '/coa-review' }],
  'sample-status':     [{ label: 'Sample Registration', path: '/samples' }],
  'equipment-status':  [{ label: 'Instruments', path: '/master-data/instruments' }],
  'overdue-tasks':     [{ label: 'Work Queue', path: '/work-queue' }, { label: 'Sample Registration', path: '/samples' }],
  'oos-results':       [{ label: 'OOS Investigations', path: '/oos-investigations' }],
}

// ── Detect module links from Aria reply text ──────────────────────────────
function detectLinks(text: string): { label: string; path: string }[] {
  const found: { label: string; path: string }[] = []
  for (const m of MODULE_REGISTRY) {
    if (m.re.test(text) && !found.some(f => f.path === m.path)) {
      found.push({ label: m.label, path: m.path })
      if (found.length >= 3) break
    }
  }
  return found
}

// ── Simple markdown renderer: **bold**, *italic*, \n as <br> ──────────────
function RichText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, li) => {
        const segments: React.ReactNode[] = []
        const re = /\*\*(.+?)\*\*|\*(.+?)\*/g
        let last = 0
        let m: RegExpExecArray | null
        while ((m = re.exec(line)) !== null) {
          if (m.index > last) segments.push(line.slice(last, m.index))
          if (m[1] !== undefined)
            segments.push(<strong key={m.index} style={{ fontWeight: 700 }}>{m[1]}</strong>)
          else if (m[2] !== undefined)
            segments.push(<em key={m.index}>{m[2]}</em>)
          last = re.lastIndex
        }
        if (last < line.length) segments.push(line.slice(last))
        return (
          <span key={li}>
            {segments}
            {li < lines.length - 1 && <br />}
          </span>
        )
      })}
    </>
  )
}

export default function ChatbotWidget() {
  const token    = useSelector((s: RootState) => s.auth.token)
  const navigate = useNavigate()

  const [open,         setOpen]         = useState(false)
  const [tab,          setTab]          = useState<Tab>('quick')
  const [messages,     setMessages]     = useState<Message[]>([])
  const [input,        setInput]        = useState('')
  const [quickResult,  setQuickResult]  = useState<{ label: string; text: string; actionId: string } | null>(null)
  const [loadingId,    setLoadingId]    = useState<string | null>(null)
  const [sending,      setSending]      = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function goTo(path: string) {
    setOpen(false)
    navigate(path)
  }

  // ── Quick action ──────────────────────────────────────────────────────────
  async function handleQuick(action: { id: string; label: string }) {
    setLoadingId(action.id)
    setQuickResult(null)
    try {
      const res = await fetch(`${API}/quick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: action.id }),
      })
      const data = await res.json()
      setQuickResult({ label: action.label, text: data.summary ?? JSON.stringify(data), actionId: action.id })
    } catch {
      setQuickResult({ label: action.label, text: '⚠ Could not fetch data. Please try again.', actionId: action.id })
    } finally {
      setLoadingId(null)
    }
  }

  // ── Chat send ─────────────────────────────────────────────────────────────
  async function handleSend() {
    const msg = input.trim()
    if (!msg || sending) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }, { role: 'aria', text: '', loading: true }])
    setSending(true)
    try {
      const res = await fetch(`${API}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      setMessages(prev => {
        const copy = [...prev]
        const last = copy.findLastIndex(m => m.loading)
        if (last !== -1) copy[last] = { role: 'aria', text: data.reply ?? 'No response.' }
        return copy
      })
    } catch {
      setMessages(prev => {
        const copy = [...prev]
        const last = copy.findLastIndex(m => m.loading)
        if (last !== -1) copy[last] = { role: 'aria', text: '⚠ AI service unavailable. Please try again.' }
        return copy
      })
    } finally {
      setSending(false)
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const TEAL  = '#0d6e6e'
  const TEAL2 = '#0d9488'

  // ── Parameterised style helpers (kept outside Record<> to satisfy TS) ────
  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer',
    fontWeight: active ? 700 : 500, fontSize: 13,
    background: 'transparent',
    color: active ? TEAL : '#64748b',
    borderBottom: active ? `2px solid ${TEAL}` : '2px solid transparent',
    transition: 'all 0.15s',
  })

  const chipStyle = (loading: boolean): React.CSSProperties => ({
    padding: '9px 12px', borderRadius: 20, border: '1px solid #e2e8f0',
    background: loading ? '#f0fdfa' : '#fff',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontSize: 12, fontWeight: 500, color: '#334155',
    textAlign: 'center', transition: 'all 0.15s',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  })

  const s: Record<string, React.CSSProperties> = {
    fab: {
      position: 'fixed', bottom: 80, right: 28, zIndex: 90,
      width: 52, height: 52, borderRadius: '50%',
      background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL2} 100%)`,
      border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(13,110,110,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'transform 0.2s',
    },
    panel: {
      position: 'fixed', bottom: 144, right: 28, zIndex: 89,
      width: 380, maxHeight: 560,
      background: '#fff', borderRadius: 16,
      boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', fontFamily: 'inherit',
    },
    header: {
      padding: '14px 16px 0', background: '#fff',
      borderBottom: '1px solid #f0fdfa', flexShrink: 0,
    },
    headerTop: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 10,
    },
    nameRow:  { display: 'flex', alignItems: 'center', gap: 8 },
    avatar: {
      width: 32, height: 32, borderRadius: 8,
      background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL2} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    name:     { fontWeight: 700, fontSize: 15, color: '#0f172a' },
    dot:      { width: 8, height: 8, borderRadius: '50%', background: '#22c55e' },
    shortcut: {
      fontSize: 11, color: '#94a3b8', background: '#f1f5f9',
      padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace',
    },
    closeBtn: {
      background: 'none', border: 'none', cursor: 'pointer',
      color: '#94a3b8', fontSize: 18, lineHeight: 1, padding: '2px 4px', borderRadius: 4,
    },
    tabs: { display: 'flex', gap: 4, paddingBottom: 0 },
    body: {
      flex: 1, overflowY: 'auto', padding: 16, minHeight: 200,
    },
    subtitle: {
      fontSize: 12, color: '#64748b', lineHeight: 1.5,
      marginBottom: 16, textAlign: 'center' as const,
    },
    chipGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
    resultBox: {
      marginTop: 12, padding: 12, borderRadius: 10,
      background: '#f0fdfa', border: '1px solid #ccfbf1',
      fontSize: 13, color: '#0f766e', lineHeight: 1.6,
      whiteSpace: 'pre-line',
    },
    resultLabel: {
      fontWeight: 700, fontSize: 12, color: TEAL,
      marginBottom: 4, display: 'block',
    },
    // link chips below a result / message
    linkRow: {
      display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginTop: 8,
    },
    linkChip: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 20,
      background: '#f0fdfa', border: '1px solid #99f6e4',
      color: TEAL, fontSize: 11, fontWeight: 600,
      cursor: 'pointer', transition: 'background 0.12s',
      textDecoration: 'none',
    },
    // chat messages
    msgList: { display: 'flex', flexDirection: 'column', gap: 10 },
    msgUser: {
      alignSelf: 'flex-end',
      background: TEAL, color: '#fff',
      padding: '8px 12px', borderRadius: '12px 12px 2px 12px',
      maxWidth: '80%', fontSize: 13, lineHeight: 1.5,
    },
    msgAria: {
      alignSelf: 'flex-start',
      background: '#f1f5f9', color: '#1e293b',
      padding: '8px 12px', borderRadius: '12px 12px 12px 2px',
      maxWidth: '85%', fontSize: 13, lineHeight: 1.6,
    },
    inputRow: {
      padding: '10px 12px', borderTop: '1px solid #f1f5f9',
      display: 'flex', gap: 8, alignItems: 'center',
      background: '#fff', flexShrink: 0,
    },
    inputBox: {
      flex: 1, border: '1px solid #e2e8f0', borderRadius: 20,
      padding: '8px 14px', fontSize: 12, color: '#334155',
      outline: 'none', background: '#f8fafc',
    },
    sendBtn: {
      width: 34, height: 34, borderRadius: '50%', border: 'none',
      background: TEAL, color: '#fff', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
  }

  if (!token) return null

  return (
    <>
      {/* FAB */}
      <button style={s.fab} onClick={() => setOpen(o => !o)} title="Ask Aria">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
            fill="white" opacity="0.9"/>
        </svg>
      </button>

      {/* Panel */}
      {open && (
        <div style={s.panel}>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div style={s.header}>
            <div style={s.headerTop}>
              <div style={s.nameRow}>
                <div style={s.avatar}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
                      fill="white"/>
                  </svg>
                </div>
                <span style={s.name}>Aria</span>
                <div style={s.dot} />
                <span style={s.shortcut}>Ctrl+K</span>
              </div>
              <button style={s.closeBtn} onClick={() => setOpen(false)}>×</button>
            </div>
            <div style={s.tabs}>
              <button style={tabStyle(tab === 'quick')} onClick={() => setTab('quick')}>⚡ Quick</button>
              <button style={tabStyle(tab === 'chat')}  onClick={() => setTab('chat')}>💬 Chat</button>
            </div>
          </div>

          {/* ── Quick tab ──────────────────────────────────────────────── */}
          {tab === 'quick' && (
            <div style={s.body}>
              <p style={s.subtitle}>
                Hi! I'm <strong>Aria</strong>, your lab assistant.<br />
                Use quick buttons for live snapshots, or{' '}
                <span style={{ color: TEAL, cursor: 'pointer' }} onClick={() => setTab('chat')}>
                  💬 Chat
                </span>{' '}to ask me anything.
              </p>

              <div style={s.chipGrid}>
                {QUICK_ACTIONS.map(a => (
                  <button
                    key={a.id}
                    style={chipStyle(loadingId === a.id)}
                    onClick={() => handleQuick(a)}
                    disabled={loadingId !== null}
                    title={a.label}
                  >
                    {loadingId === a.id ? '⏳ Loading…' : a.label}
                  </button>
                ))}
              </div>

              {quickResult && (
                <div style={s.resultBox}>
                  <span style={s.resultLabel}>{quickResult.label}</span>
                  <RichText text={quickResult.text} />
                  {/* Go-to links for this quick action */}
                  {(QUICK_GOTO[quickResult.actionId] ?? []).length > 0 && (
                    <div style={s.linkRow}>
                      {(QUICK_GOTO[quickResult.actionId] ?? []).map(l => (
                        <button key={l.path} style={s.linkChip} onClick={() => goTo(l.path)}>
                          {l.label}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2"
                              strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Chat tab ───────────────────────────────────────────────── */}
          {tab === 'chat' && (
            <>
              <div style={s.body}>
                {messages.length === 0 && (
                  <p style={{ ...s.subtitle, marginTop: 16 }}>
                    Ask me anything about samples, compliance, OOS, instruments, or 21 CFR Part 11.
                  </p>
                )}

                <div style={s.msgList}>
                  {messages.map((m, i) => {
                    if (m.role === 'user') {
                      return <div key={i} style={s.msgUser}>{m.text}</div>
                    }

                    const links = (!m.loading && m.text) ? detectLinks(m.text) : []

                    return (
                      <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '90%' }}>
                        <div style={s.msgAria}>
                          {m.loading
                            ? <span style={{ opacity: 0.5 }}>Aria is thinking…</span>
                            : <RichText text={m.text} />
                          }
                        </div>
                        {links.length > 0 && (
                          <div style={{ ...s.linkRow, paddingLeft: 2 }}>
                            {links.map(l => (
                              <button key={l.path} style={s.linkChip} onClick={() => goTo(l.path)}>
                                {l.label}
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2"
                                    strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>
              </div>

              <div style={s.inputRow}>
                <input
                  style={s.inputBox}
                  placeholder="Ask Aria anything in plain English →"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  disabled={sending}
                />
                <button style={s.sendBtn} onClick={handleSend} disabled={sending}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
                      stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </>
          )}

        </div>
      )}
    </>
  )
}
