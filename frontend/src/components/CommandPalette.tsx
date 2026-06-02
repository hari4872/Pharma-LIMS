/**
 * Global command palette — triggered by Ctrl+K or the search icon in the topbar.
 * Fuzzy-filters all nav routes and navigates on Enter / click.
 * Mount once in Layout.tsx and pass open/onClose props.
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const ALL_ROUTES = [
  { label: 'Dashboard',            path: '/dashboard',                       section: 'Overview',    icon: '▣' },
  { label: 'Compliance Panel',     path: '/compliance',                      section: 'Overview',    icon: '🛡' },
  { label: 'Laboratories',         path: '/master-data/laboratories',        section: 'Master Data', icon: '🏛' },
  { label: 'Instruments',          path: '/master-data/instruments',         section: 'Master Data', icon: '⏱' },
  { label: 'Materials',            path: '/master-data/materials',           section: 'Master Data', icon: '📦' },
  { label: 'Test Methods',         path: '/master-data/test-methods',        section: 'Master Data', icon: '📋' },
  { label: 'Parameters',           path: '/master-data/parameters',          section: 'Master Data', icon: '⚙' },
  { label: 'Spec Limits',          path: '/master-data/spec-limits',         section: 'Master Data', icon: '📊' },
  { label: 'Form Templates',       path: '/master-data/form-templates',      section: 'Master Data', icon: '📄' },
  { label: 'Users',                path: '/master-data/users',               section: 'Master Data', icon: '👥' },
  { label: 'Sample Types',         path: '/master-data/sample-types',        section: 'Master Data', icon: '🧪' },
  { label: 'Storage Locations',    path: '/master-data/storage-locations',   section: 'Master Data', icon: '🏠' },
  { label: 'Reagents & Standards', path: '/master-data/reagents',            section: 'Master Data', icon: '⚗' },
  { label: 'Training Records',     path: '/master-data/training-records',    section: 'Master Data', icon: '🎓' },
  { label: 'Sample Registration',  path: '/samples',                         section: 'Operations',  icon: '📝' },
  { label: 'Checkpoints',          path: '/checkpoints',                     section: 'Operations',  icon: '✅' },
  { label: 'Work Queue',           path: '/work-queue',                      section: 'Operations',  icon: '📋' },
  { label: 'OOS Investigations',   path: '/oos-investigations',              section: 'Operations',  icon: '⚠' },
  { label: 'Digital Logbook',      path: '/digital-logbook',                 section: 'Operations',  icon: '📖' },
  { label: 'Results Review',       path: '/results-review',                  section: 'Operations',  icon: '📈' },
  { label: 'CoA Review',           path: '/coa-review',                      section: 'Operations',  icon: '📃' },
  { label: 'Dispatch QC',          path: '/dispatch-qc',                     section: 'Operations',  icon: '🚚' },
  { label: 'Traceability',         path: '/traceability',                    section: 'Inventory',   icon: 'ℹ' },
  { label: 'Stability Pulls',      path: '/stability-pulls',                 section: 'Inventory',   icon: '🧫' },
  { label: 'Retain Samples',       path: '/retain-samples',                  section: 'Inventory',   icon: '🗃' },
  { label: 'Condition Excursions', path: '/condition-excursions',            section: 'Inventory',   icon: '🌡' },
]

interface Props { open: boolean; onClose: () => void }

export default function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery]     = useState('')
  const [cursor, setCursor]   = useState(0)
  const navigate              = useNavigate()
  const inputRef              = useRef<HTMLInputElement>(null)

  const results = query.trim()
    ? ALL_ROUTES.filter(r =>
        r.label.toLowerCase().includes(query.toLowerCase()) ||
        r.section.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_ROUTES

  useEffect(() => {
    if (!open) return
    const t1 = setTimeout(() => { setQuery(''); setCursor(0) }, 0)
    const t2 = setTimeout(() => inputRef.current?.focus(), 30)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [open])
  useEffect(() => { const t = setTimeout(() => setCursor(0), 0); return () => clearTimeout(t) }, [query])

  function go(path: string) { navigate(path); onClose() }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && results[cursor]) go(results[cursor].path)
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 500, paddingTop: '12vh' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: 560, background: '#fff', borderRadius: 14, boxShadow: '0 25px 80px rgba(0,0,0,0.25)', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ flexShrink: 0, color: '#9ca3af' }}>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search pages, features…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#0f172a', fontFamily: 'inherit', background: 'transparent' }}
          />
          <kbd style={{ fontSize: 10, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 6px', color: '#64748b', fontFamily: 'inherit' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No pages match "{query}"</div>
          ) : (
            (() => {
              let lastSection = ''
              return results.map((r, i) => {
                const showSection = r.section !== lastSection
                lastSection = r.section
                return (
                  <div key={r.path}>
                    {showSection && (
                      <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8' }}>
                        {r.section}
                      </div>
                    )}
                    <div
                      onClick={() => go(r.path)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '9px 16px', cursor: 'pointer',
                        background: cursor === i ? '#f0fdfa' : 'transparent',
                        borderLeft: `3px solid ${cursor === i ? '#0d9488' : 'transparent'}`,
                        transition: 'background 0.08s',
                      }}
                      onMouseEnter={() => setCursor(i)}
                    >
                      <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{r.icon}</span>
                      <span style={{ fontSize: 13.5, fontWeight: cursor === i ? 600 : 400, color: cursor === i ? '#0d6e6e' : '#0f172a' }}>{r.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8', background: '#f8fafc', padding: '2px 8px', borderRadius: 6 }}>{r.section}</span>
                    </div>
                  </div>
                )
              })
            })()
          )}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 16 }}>
          {[['↑↓', 'Navigate'], ['↵', 'Go to page'], ['Esc', 'Close']].map(([key, hint]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <kbd style={{ fontSize: 10, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 5px', color: '#64748b', fontFamily: 'inherit' }}>{key}</kbd>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{hint}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
