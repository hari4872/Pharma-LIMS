import { useState, useRef, useEffect } from 'react'
import { useTranslation, type Language } from '@/i18n/TranslationContext'

const LANGUAGES: { code: Language; flag: string; label: string; nativeLabel: string }[] = [
  { code: 'en', flag: 'GB', label: 'English',   nativeLabel: 'English'   },
  { code: 'ja', flag: 'JP', label: 'Japanese',  nativeLabel: '日本語'     },
  { code: 'id', flag: 'ID', label: 'Indonesia', nativeLabel: 'Indonesia' },
]

export default function LanguageSwitcher() {
  const { lang, setLang, loading } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  async function handleSelect(code: Language) {
    setOpen(false)
    await setLang(code)
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Globe trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Change language"
        style={{
          width: 32, height: 32,
          border: `1px solid ${open ? '#6366f1' : '#e0e0e0'}`,
          borderRadius: 7,
          background: open ? '#eef2ff' : '#fff',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: open ? '#6366f1' : '#5f6368',
          transition: 'all 0.1s',
          position: 'relative',
        }}
      >
        {loading ? (
          <div style={{
            width: 13, height: 13,
            border: '2px solid #e0e0e0',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 200,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          border: '1px solid #e0e0e0',
          zIndex: 200,
          overflow: 'hidden',
        }}>
          {/* Section header */}
          <div style={{
            padding: '10px 14px 6px',
            fontSize: 10, fontWeight: 800,
            letterSpacing: '0.1em',
            color: '#9ca3af',
            textTransform: 'uppercase',
            borderBottom: '1px solid #f3f4f6',
          }}>
            Language
          </div>

          {/* Options */}
          {LANGUAGES.map(l => {
            const isActive = lang === l.code
            return (
              <button
                key={l.code}
                onClick={() => handleSelect(l.code)}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  border: 'none',
                  background: isActive ? '#f0f9ff' : 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                  borderBottom: '1px solid #f9fafb',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                {/* Flag code badge */}
                <span style={{
                  width: 26, height: 18,
                  background: isActive ? '#dbeafe' : '#f1f5f9',
                  borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9.5, fontWeight: 800,
                  color: isActive ? '#1d4ed8' : '#64748b',
                  letterSpacing: '0.03em',
                  flexShrink: 0,
                }}>
                  {l.flag}
                </span>

                {/* Language name */}
                <span style={{
                  flex: 1,
                  fontSize: 13.5,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#1d4ed8' : '#111827',
                }}>
                  {l.nativeLabel}
                </span>

                {/* Checkmark */}
                {isActive && (
                  <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                    <path d="M5 13l4 4L19 7" stroke="#1d4ed8" strokeWidth="2.2"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
