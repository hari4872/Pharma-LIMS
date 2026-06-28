import { lazy } from 'react'
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

// Standalone full-page views (no sidebar — for direct linking / printing)
const CoaDetailPage             = lazy(() => import('@/pages/CoaDetailPage'))

// ─── Role constants (mirrors Layout.tsx sidebar filtering) ────────────────────
// Keep in sync with backend UserRole enum in LimsEnums.cs
const LAB_ROLES   = ['Admin', 'Analyst', 'QA', 'QCLead', 'LabManager']
const QA_ROLES    = ['Admin', 'QA', 'QCLead', 'LabManager']
const MGMT_ROLES  = ['Admin', 'LabManager']
// Master data: Admin + QA by default permission matrix; LabManager if granted override
const MASTER_DATA_ROLES = ['Admin', 'QA', 'LabManager']
// OOS/CAPA: analysts are involved in phase-1 investigations
const OOS_ROLES   = ['Admin', 'Analyst', 'QA', 'QCLead', 'LabManager']

// ─── Auth guards ──────────────────────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useSelector((s: RootState) => s.auth.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

// Role guard — redirects to /dashboard if current role is not in the allowed list.
// Viewer role falls through all role guards → sees dashboard only (correct behaviour).
function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const role = useSelector((s: RootState) => s.auth.role) ?? ''
  return roles.includes(role) ? <>{children}</> : <Navigate to="/dashboard" replace />
}

// Feature-flag guard — admin can hide nav items per-lab via NavVisibility settings.
function RequireEnabled({ navKey, children }: { navKey: string; children: React.ReactNode }) {
  const map = useSelector((s: RootState) => s.navVisibility.map)
  const enabled = map[navKey] !== false
  return enabled ? <>{children}</> : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />

      {/* Standalone authenticated pages — no sidebar layout */}
      <Route path="/release-dispatch/coa/:coaId" element={<RequireAuth><CoaDetailPage /></RequireAuth>} />

      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Dashboard — accessible to all authenticated roles including Viewer */}
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Compliance — QA / Admin / QCLead / LabManager */}
        <Route path="compliance" element={
          <RequireRole roles={QA_ROLES}>
            <RequireEnabled navKey="nav.compliance">
              <CompliancePanelPage />
            </RequireEnabled>
          </RequireRole>
        } />

        {/* ── Master Data ──────────────────────────────────────────────────── */}
        {/* Admin-only */}
        <Route path="master-data/users" element={
          <RequireRole roles={['Admin']}>
            <UsersPage />
          </RequireRole>
        } />
        {/* Admin + QA + LabManager (with permission) */}
        <Route path="master-data/laboratories"            element={<RequireRole roles={MASTER_DATA_ROLES}><LaboratoriesPage /></RequireRole>} />
        <Route path="master-data/instruments"             element={<RequireRole roles={MASTER_DATA_ROLES}><InstrumentsPage /></RequireRole>} />
        <Route path="master-data/materials"               element={<RequireRole roles={MASTER_DATA_ROLES}><MaterialsPage /></RequireRole>} />
        <Route path="master-data/test-methods"            element={<RequireRole roles={MASTER_DATA_ROLES}><TestMethodsPage /></RequireRole>} />
        <Route path="master-data/parameters"              element={<RequireRole roles={MASTER_DATA_ROLES}><ParametersPage /></RequireRole>} />
        <Route path="master-data/spec-limits"             element={<RequireRole roles={MASTER_DATA_ROLES}><SpecLimitsPage /></RequireRole>} />
        <Route path="master-data/form-templates"          element={<RequireRole roles={MASTER_DATA_ROLES}><FormTemplatesPage /></RequireRole>} />
        <Route path="master-data/specification-templates" element={<RequireRole roles={MASTER_DATA_ROLES}><SpecificationTemplatesPage /></RequireRole>} />
        <Route path="master-data/sample-types"            element={<RequireRole roles={MASTER_DATA_ROLES}><SampleTypesPage /></RequireRole>} />
        <Route path="master-data/storage-locations"       element={<RequireRole roles={MASTER_DATA_ROLES}><StorageLocationsPage /></RequireRole>} />
        <Route path="master-data/reagents"                element={<RequireRole roles={MASTER_DATA_ROLES}><ReagentsPage /></RequireRole>} />
        <Route path="master-data/sampling-plans"          element={<RequireRole roles={MASTER_DATA_ROLES}><SamplingPlansPage /></RequireRole>} />
        <Route path="master-data/stability-protocols"     element={<RequireRole roles={MASTER_DATA_ROLES}><StabilityProtocolsPage /></RequireRole>} />
        <Route path="master-data/instrument-mapping"      element={<RequireRole roles={MASTER_DATA_ROLES}><InstrumentMappingPage /></RequireRole>} />
        <Route path="master-data/training-records"        element={<RequireRole roles={LAB_ROLES}><UserTrainingRecordsPage /></RequireRole>} />

        {/* ── Core Workflow ─────────────────────────────────────────────────── */}
        <Route path="samples" element={
          <RequireRole roles={LAB_ROLES}>
            <RequireEnabled navKey="nav.samples">
              <SampleRegistrationPage />
            </RequireEnabled>
          </RequireRole>
        } />
        <Route path="checkpoints"      element={<RequireRole roles={LAB_ROLES}><CheckpointsPage /></RequireRole>} />
        <Route path="checkpoint-tasks" element={
          <RequireRole roles={LAB_ROLES}>
            <RequireEnabled navKey="nav.checkpoint-tasks">
              <CheckpointExecutionPage />
            </RequireEnabled>
          </RequireRole>
        } />
        <Route path="work-queue" element={
          <RequireRole roles={LAB_ROLES}>
            <RequireEnabled navKey="nav.work-queue">
              <WorkQueuePage />
            </RequireEnabled>
          </RequireRole>
        } />
        <Route path="capacity-booking" element={
          <RequireRole roles={LAB_ROLES}>
            <RequireEnabled navKey="nav.capacity-booking">
              <CapacityBookingPage />
            </RequireEnabled>
          </RequireRole>
        } />
        {/* Test execution — direct link from work-queue; all lab roles */}
        <Route path="test-execution/:id" element={<RequireRole roles={LAB_ROLES}><TestExecutionPage /></RequireRole>} />

        {/* OOS / Quality Events — analysts involved in phase-1 investigations */}
        <Route path="oos-investigations" element={<RequireRole roles={OOS_ROLES}><OosInvestigationsPage /></RequireRole>} />
        <Route path="quality-events"     element={<RequireRole roles={QA_ROLES}><QualityEventsPage /></RequireRole>} />
        <Route path="spc"                element={<RequireRole roles={QA_ROLES}><SpcPage /></RequireRole>} />

        {/* Batch release */}
        <Route path="batch-release" element={<RequireRole roles={QA_ROLES}><BatchReleasePage /></RequireRole>} />
        <Route path="batch-entry"   element={<Navigate to="/work-queue" replace />} />
        <Route path="batch-register"element={<Navigate to="/samples" replace />} />

        {/* Reports */}
        <Route path="reports" element={
          <RequireRole roles={LAB_ROLES}>
            <RequireEnabled navKey="nav.reports">
              <ReportsPage />
            </RequireEnabled>
          </RequireRole>
        } />
        <Route path="report-builder" element={
          <RequireRole roles={MGMT_ROLES}>
            <RequireEnabled navKey="nav.report-builder">
              <ReportBuilderPage />
            </RequireEnabled>
          </RequireRole>
        } />

        {/* Stability & Workflow config */}
        <Route path="stability-study" element={<RequireRole roles={QA_ROLES}><StabilityStudyPage /></RequireRole>} />
        <Route path="workflow-config" element={<RequireRole roles={['Admin']}><WorkflowConfigPage /></RequireRole>} />

        {/* Multi-site */}
        <Route path="multi-site-dashboard" element={
          <RequireRole roles={MGMT_ROLES}>
            <RequireEnabled navKey="nav.multi-site">
              <MultiSiteDashboardPage />
            </RequireEnabled>
          </RequireRole>
        } />
        <Route path="site-transfers" element={
          <RequireRole roles={LAB_ROLES}>
            <RequireEnabled navKey="nav.site-transfers">
              <SiteTransferPage />
            </RequireEnabled>
          </RequireRole>
        } />

        {/* Settings — accessible to all authenticated roles */}
        <Route path="settings" element={<SettingsPage />} />

        {/* Digital Lab */}
        <Route path="digital-logbook" element={
          <RequireRole roles={LAB_ROLES}>
            <RequireEnabled navKey="nav.digital-logbook">
              <DigitalLogbookPage />
            </RequireEnabled>
          </RequireRole>
        } />
        <Route path="results-review" element={<RequireRole roles={QA_ROLES}><ResultsReviewPage /></RequireRole>} />
        <Route path="coa-review"     element={<RequireRole roles={QA_ROLES}><CoaReviewPage /></RequireRole>} />
        <Route path="dispatch-qc"    element={<RequireRole roles={QA_ROLES}><DispatchQcPage /></RequireRole>} />

        {/* Phase 5 — Traceability & Storage */}
        <Route path="traceability" element={
          <RequireRole roles={LAB_ROLES}>
            <RequireEnabled navKey="nav.traceability">
              <TraceabilityPage />
            </RequireEnabled>
          </RequireRole>
        } />
        <Route path="stability-pulls"      element={<RequireRole roles={QA_ROLES}><StabilityPullsPage /></RequireRole>} />
        <Route path="retain-samples"       element={<RequireRole roles={QA_ROLES}><RetainSamplesPage /></RequireRole>} />
        <Route path="condition-excursions" element={<RequireRole roles={QA_ROLES}><ConditionExcursionsPage /></RequireRole>} />

        {/* Tabbed wrapper pages */}
        <Route path="quality-assurance" element={
          <RequireRole roles={QA_ROLES}>
            <RequireEnabled navKey="nav.quality-assurance">
              <QualityAssurancePage />
            </RequireEnabled>
          </RequireRole>
        } />
        <Route path="release-dispatch" element={
          <RequireRole roles={QA_ROLES}>
            <RequireEnabled navKey="nav.release-dispatch">
              <ReleaseDispatchPage />
            </RequireEnabled>
          </RequireRole>
        } />
        <Route path="stability-retention" element={
          <RequireRole roles={QA_ROLES}>
            <RequireEnabled navKey="nav.stability-retention">
              <StabilityRetentionPage />
            </RequireEnabled>
          </RequireRole>
        } />
      </Route>
    </Routes>
  )
}
