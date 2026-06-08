import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'

// Eagerly loaded — tiny, needed before auth resolves
import LoginPage from '@/pages/LoginPage'
import SetupPage from '@/pages/SetupPage'
import Layout from '@/components/Layout'

// ─── Lazy-loaded pages (split into separate chunks) ───────────────────────────
// Master Data
const LaboratoriesPage          = lazy(() => import('@/pages/master-data/LaboratoriesPage'))
const InstrumentsPage           = lazy(() => import('@/pages/master-data/InstrumentsPage'))
const MaterialsPage             = lazy(() => import('@/pages/master-data/MaterialsPage'))
const TestMethodsPage           = lazy(() => import('@/pages/master-data/TestMethodsPage'))
const ParametersPage            = lazy(() => import('@/pages/master-data/ParametersPage'))
const SpecLimitsPage            = lazy(() => import('@/pages/master-data/SpecLimitsPage'))
const FormTemplatesPage         = lazy(() => import('@/pages/master-data/FormTemplatesPage'))
const SpecificationTemplatesPage= lazy(() => import('@/pages/master-data/SpecificationTemplatesPage'))
const UsersPage                 = lazy(() => import('@/pages/master-data/UsersPage'))
const SampleTypesPage           = lazy(() => import('@/pages/master-data/SampleTypesPage'))
const StorageLocationsPage      = lazy(() => import('@/pages/master-data/StorageLocationsPage'))
const ReagentsPage              = lazy(() => import('@/pages/master-data/ReagentsPage'))
const SamplingPlansPage         = lazy(() => import('@/pages/master-data/SamplingPlansPage'))
const StabilityProtocolsPage    = lazy(() => import('@/pages/master-data/StabilityProtocolsPage'))
const InstrumentMappingPage     = lazy(() => import('@/pages/master-data/InstrumentMappingPage'))

// Core workflow
const DashboardPage             = lazy(() => import('@/pages/DashboardPage'))
const SampleRegistrationPage    = lazy(() => import('@/pages/SampleRegistrationPage'))
const CheckpointsPage           = lazy(() => import('@/pages/CheckpointsPage'))
const CheckpointExecutionPage   = lazy(() => import('@/pages/CheckpointExecutionPage'))
const WorkQueuePage             = lazy(() => import('@/pages/WorkQueuePage'))
const CapacityBookingPage       = lazy(() => import('@/pages/CapacityBookingPage'))
const TestExecutionPage         = lazy(() => import('@/pages/TestExecutionPage'))
const OosInvestigationsPage     = lazy(() => import('@/pages/OosInvestigationsPage'))
const DigitalLogbookPage        = lazy(() => import('@/pages/DigitalLogbookPage'))
const ResultsReviewPage         = lazy(() => import('@/pages/ResultsReviewPage'))
const CoaReviewPage             = lazy(() => import('@/pages/CoaReviewPage'))
const DispatchQcPage            = lazy(() => import('@/pages/DispatchQcPage'))

// Phase 5 — Traceability & Storage
const TraceabilityPage          = lazy(() => import('@/pages/TraceabilityPage'))
const StabilityPullsPage        = lazy(() => import('@/pages/StabilityPullsPage'))
const RetainSamplesPage         = lazy(() => import('@/pages/RetainSamplesPage'))
const ConditionExcursionsPage   = lazy(() => import('@/pages/ConditionExcursionsPage'))

// Quality & Compliance
const CompliancePanelPage       = lazy(() => import('@/pages/CompliancePanelPage'))
const QualityEventsPage         = lazy(() => import('@/pages/QualityEventsPage'))
const SpcPage                   = lazy(() => import('@/pages/SpcPage'))
const BatchReleasePage          = lazy(() => import('@/pages/BatchReleasePage'))

// Reports & Analytics
const ReportsPage               = lazy(() => import('@/pages/ReportsPage'))
const ReportBuilderPage         = lazy(() => import('@/pages/ReportBuilderPage'))

// Multi-site
const MultiSiteDashboardPage    = lazy(() => import('@/pages/MultiSiteDashboardPage'))
const SiteTransferPage          = lazy(() => import('@/pages/SiteTransferPage'))

// Misc
const StabilityStudyPage        = lazy(() => import('@/pages/StabilityStudyPage'))
const WorkflowConfigPage        = lazy(() => import('@/pages/WorkflowConfigPage'))
const UserTrainingRecordsPage   = lazy(() => import('@/pages/UserTrainingRecordsPage'))
const SettingsPage              = lazy(() => import('@/pages/SettingsPage'))

// Tabbed wrapper pages
const QualityAssurancePage      = lazy(() => import('@/pages/QualityAssurancePage'))
const ReleaseDispatchPage       = lazy(() => import('@/pages/ReleaseDispatchPage'))
const StabilityRetentionPage    = lazy(() => import('@/pages/StabilityRetentionPage'))

// ─── Auth guards ──────────────────────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useSelector((s: RootState) => s.auth.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const role = useSelector((s: RootState) => s.auth.role) ?? ''
  return roles.includes(role) ? <>{children}</> : <Navigate to="/dashboard" replace />
}

// ─── Loading fallback ─────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Suspense fallback={<PageLoader />}>
          {/* Dashboard & Compliance */}
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="compliance" element={<CompliancePanelPage />} />

          {/* Master Data */}
          <Route path="master-data/laboratories"            element={<LaboratoriesPage />} />
          <Route path="master-data/instruments"             element={<InstrumentsPage />} />
          <Route path="master-data/materials"               element={<MaterialsPage />} />
          <Route path="master-data/test-methods"            element={<TestMethodsPage />} />
          <Route path="master-data/parameters"              element={<ParametersPage />} />
          <Route path="master-data/spec-limits"             element={<SpecLimitsPage />} />
          <Route path="master-data/form-templates"          element={<FormTemplatesPage />} />
          <Route path="master-data/specification-templates" element={<SpecificationTemplatesPage />} />
          <Route path="master-data/users"                   element={<RequireRole roles={['Admin']}><UsersPage /></RequireRole>} />
          <Route path="master-data/sample-types"            element={<SampleTypesPage />} />
          <Route path="master-data/storage-locations"       element={<StorageLocationsPage />} />
          <Route path="master-data/reagents"                element={<ReagentsPage />} />
          <Route path="master-data/training-records"        element={<UserTrainingRecordsPage />} />
          <Route path="master-data/sampling-plans"          element={<SamplingPlansPage />} />
          <Route path="master-data/stability-protocols"     element={<StabilityProtocolsPage />} />
          <Route path="master-data/instrument-mapping"      element={<InstrumentMappingPage />} />

          {/* Core Workflow */}
          <Route path="samples"            element={<SampleRegistrationPage />} />
          <Route path="checkpoints"        element={<CheckpointsPage />} />
          <Route path="checkpoint-tasks"   element={<CheckpointExecutionPage />} />
          <Route path="work-queue"         element={<WorkQueuePage />} />
          <Route path="capacity-booking"   element={<CapacityBookingPage />} />
          <Route path="test-execution/:id" element={<TestExecutionPage />} />
          <Route path="oos-investigations" element={<OosInvestigationsPage />} />
          <Route path="quality-events"     element={<QualityEventsPage />} />
          <Route path="spc"                element={<SpcPage />} />
          <Route path="batch-entry"        element={<Navigate to="/work-queue" replace />} />
          <Route path="batch-register"     element={<Navigate to="/samples" replace />} />
          <Route path="batch-release"      element={<BatchReleasePage />} />

          {/* Reports */}
          <Route path="reports"        element={<ReportsPage />} />
          <Route path="report-builder" element={<ReportBuilderPage />} />

          {/* Stability & Workflow */}
          <Route path="stability-study" element={<StabilityStudyPage />} />
          <Route path="workflow-config" element={<WorkflowConfigPage />} />

          {/* Multi-site */}
          <Route path="multi-site-dashboard" element={<MultiSiteDashboardPage />} />
          <Route path="site-transfers"       element={<SiteTransferPage />} />

          {/* Settings */}
          <Route path="settings"        element={<SettingsPage />} />

          {/* Digital Lab */}
          <Route path="digital-logbook" element={<DigitalLogbookPage />} />
          <Route path="results-review"  element={<ResultsReviewPage />} />
          <Route path="coa-review"      element={<CoaReviewPage />} />
          <Route path="dispatch-qc"     element={<DispatchQcPage />} />

          {/* Phase 5 — Traceability & Storage */}
          <Route path="traceability"         element={<TraceabilityPage />} />
          <Route path="stability-pulls"      element={<StabilityPullsPage />} />
          <Route path="retain-samples"       element={<RetainSamplesPage />} />
          <Route path="condition-excursions" element={<ConditionExcursionsPage />} />

          {/* Tabbed wrapper pages */}
          <Route path="quality-assurance"  element={<QualityAssurancePage />} />
          <Route path="release-dispatch"   element={<ReleaseDispatchPage />} />
          <Route path="stability-retention" element={<StabilityRetentionPage />} />
        </Suspense>
      </Route>
    </Routes>
  )
}
