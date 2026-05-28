import { useState } from 'react'
import BatchReleasePage from './BatchReleasePage'
import CoaReviewPage from './CoaReviewPage'
import DispatchQcPage from './DispatchQcPage'
import ReportsPage from './ReportsPage'

type TabId = 'batch-release' | 'coa-review' | 'dispatch-qc' | 'reports'

const TABS = [
  { id: 'batch-release' as TabId, label: 'Batch Release', icon: '✅', component: BatchReleasePage },
  { id: 'coa-review' as TabId, label: 'CoA Review', icon: '📄', component: CoaReviewPage },
  { id: 'dispatch-qc' as TabId, label: 'Dispatch QC', icon: '🚚', component: DispatchQcPage },
  { id: 'reports' as TabId, label: 'Reports & Exports', icon: '📥', component: ReportsPage },
]

export default function ReleaseDispatchPage() {
  const [active, setActive] = useState<TabId>('batch-release')
  const tab = TABS.find(t => t.id === active)!
  const PageComp = tab.component

  return (
    <div>
      {/* Tab strip */}
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap',
        borderBottom: '2px solid #e2e8f0', marginBottom: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px',
              border: 'none',
              borderBottom: active === t.id ? '2px solid #15803d' : '2px solid transparent',
              background: 'transparent',
              color: active === t.id ? '#15803d' : '#6b7280',
              fontWeight: active === t.id ? 700 : 500,
              fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit',
              marginBottom: -2,
              transition: 'all 0.15s',
            }}>
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      {/* Page content */}
      <div style={{ paddingTop: 20 }}>
        <PageComp />
      </div>
    </div>
  )
}
