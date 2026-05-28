import { useState } from 'react'
import ResultsReviewPage from './ResultsReviewPage'
import OosInvestigationsPage from './OosInvestigationsPage'
import QualityEventsPage from './QualityEventsPage'
import SpcPage from './SpcPage'

type TabId = 'results-review' | 'oos' | 'capa' | 'spc'

const TABS = [
  { id: 'results-review' as TabId, label: 'Results Review', icon: '📊', component: ResultsReviewPage },
  { id: 'oos' as TabId, label: 'OOS Investigations', icon: '⚠️', component: OosInvestigationsPage },
  { id: 'capa' as TabId, label: 'CAPA / Quality Events', icon: '🛡', component: QualityEventsPage },
  { id: 'spc' as TabId, label: 'SPC / Trending', icon: '📈', component: SpcPage },
]

export default function QualityAssurancePage() {
  const [active, setActive] = useState<TabId>('results-review')
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
              borderBottom: active === t.id ? '2px solid #2563eb' : '2px solid transparent',
              background: 'transparent',
              color: active === t.id ? '#2563eb' : '#6b7280',
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
