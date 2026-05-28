import { useState } from 'react'
import StabilityStudyPage from './StabilityStudyPage'
import StabilityPullsPage from './StabilityPullsPage'
import RetainSamplesPage from './RetainSamplesPage'
import ConditionExcursionsPage from './ConditionExcursionsPage'

type TabId = 'stability-study' | 'stability-pulls' | 'retain-samples' | 'condition-excursions'

const TABS = [
  { id: 'stability-study' as TabId, label: 'Stability Study', icon: '🔬', component: StabilityStudyPage },
  { id: 'stability-pulls' as TabId, label: 'Stability Pulls', icon: '⏰', component: StabilityPullsPage },
  { id: 'retain-samples' as TabId, label: 'Retain Samples', icon: '🗃', component: RetainSamplesPage },
  { id: 'condition-excursions' as TabId, label: 'Condition Excursions', icon: '⚠️', component: ConditionExcursionsPage },
]

export default function StabilityRetentionPage() {
  const [active, setActive] = useState<TabId>('stability-study')
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
              borderBottom: active === t.id ? '2px solid #0369a1' : '2px solid transparent',
              background: 'transparent',
              color: active === t.id ? '#0369a1' : '#6b7280',
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
