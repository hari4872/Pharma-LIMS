import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import LoginPage from '@/pages/LoginPage'
import SetupPage from '@/pages/SetupPage'
import Layout from '@/components/Layout'
import LaboratoriesPage from '@/pages/master-data/LaboratoriesPage'
import InstrumentsPage from '@/pages/master-data/InstrumentsPage'
import MaterialsPage from '@/pages/master-data/MaterialsPage'
import TestMethodsPage from '@/pages/master-data/TestMethodsPage'
import ParametersPage from '@/pages/master-data/ParametersPage'
import SpecLimitsPage from '@/pages/master-data/SpecLimitsPage'
import FormTemplatesPage from '@/pages/master-data/FormTemplatesPage'
import SpecificationTemplatesPage from '@/pages/master-data/SpecificationTemplatesPage'
import UsersPage from '@/pages/master-data/UsersPage'
import SampleTypesPage from '@/pages/master-data/SampleTypesPage'
import SampleRegistrationPage from '@/pages/SampleRegistrationPage'
import CheckpointsPage from '@/pages/CheckpointsPage'
import WorkQueuePage from '@/pages/WorkQueuePage'
import TestExecutionPage from '@/pages/TestExecutionPage'
import OosInvestigationsPage from '@/pages/OosInvestigationsPage'
import DigitalLogbookPage from '@/pages/DigitalLogbookPage'
import ResultsReviewPage from '@/pages/ResultsReviewPage'
import CoaReviewPage from '@/pages/CoaReviewPage'
import DispatchQcPage from '@/pages/DispatchQcPage'
// Phase 5
import TraceabilityPage from '@/pages/TraceabilityPage'
import StabilityPullsPage from '@/pages/StabilityPullsPage'
import RetainSamplesPage from '@/pages/RetainSamplesPage'
import ConditionExcursionsPage from '@/pages/ConditionExcursionsPage'
import StorageLocationsPage from '@/pages/master-data/StorageLocationsPage'
import ReagentsPage from '@/pages/master-data/ReagentsPage'
import UserTrainingRecordsPage from '@/pages/UserTrainingRecordsPage'
// Phase B
import SamplingPlansPage from '@/pages/master-data/SamplingPlansPage'
import StabilityProtocolsPage from '@/pages/master-data/StabilityProtocolsPage'
// Phase D
import InstrumentMappingPage from '@/pages/master-data/InstrumentMappingPage'
// Phase 6/7/8
import DashboardPage from '@/pages/DashboardPage'
import CompliancePanelPage from '@/pages/CompliancePanelPage'
// Sprint 1 — Quality Events (CAPA · Deviations · Complaints)
import QualityEventsPage from '@/pages/QualityEventsPage'
// Sprint 5 — SPC Control Chart
import SpcPage from '@/pages/SpcPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useSelector((s: RootState) => s.auth.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        {/* Phase 6/7/8 */}
        <Route path="dashboard"  element={<DashboardPage />} />
        <Route path="compliance" element={<CompliancePanelPage />} />
        {/* Master Data */}
        <Route path="master-data/laboratories"     element={<LaboratoriesPage />} />
        <Route path="master-data/instruments"      element={<InstrumentsPage />} />
        <Route path="master-data/materials"        element={<MaterialsPage />} />
        <Route path="master-data/test-methods"     element={<TestMethodsPage />} />
        <Route path="master-data/parameters"       element={<ParametersPage />} />
        <Route path="master-data/spec-limits"      element={<SpecLimitsPage />} />
        <Route path="master-data/form-templates"          element={<FormTemplatesPage />} />
        <Route path="master-data/specification-templates" element={<SpecificationTemplatesPage />} />
        <Route path="master-data/users"            element={<UsersPage />} />
        <Route path="master-data/sample-types"     element={<SampleTypesPage />} />
        <Route path="master-data/storage-locations"  element={<StorageLocationsPage />} />
        <Route path="master-data/reagents"           element={<ReagentsPage />} />
        <Route path="master-data/training-records"      element={<UserTrainingRecordsPage />} />
        <Route path="master-data/sampling-plans"        element={<SamplingPlansPage />} />
        <Route path="master-data/stability-protocols"  element={<StabilityProtocolsPage />} />
        <Route path="master-data/instrument-mapping"   element={<InstrumentMappingPage />} />
        {/* Phases 2–4 */}
        <Route path="samples"           element={<SampleRegistrationPage />} />
        <Route path="checkpoints"       element={<CheckpointsPage />} />
        <Route path="work-queue"        element={<WorkQueuePage />} />
        <Route path="test-execution/:id" element={<TestExecutionPage />} />
        <Route path="oos-investigations" element={<OosInvestigationsPage />} />
        <Route path="quality-events"    element={<QualityEventsPage />} />
        <Route path="spc"               element={<SpcPage />} />
        <Route path="digital-logbook"   element={<DigitalLogbookPage />} />
        <Route path="results-review"    element={<ResultsReviewPage />} />
        <Route path="coa-review"        element={<CoaReviewPage />} />
        <Route path="dispatch-qc"       element={<DispatchQcPage />} />
        {/* Phase 5 */}
        <Route path="traceability"          element={<TraceabilityPage />} />
        <Route path="stability-pulls"       element={<StabilityPullsPage />} />
        <Route path="retain-samples"        element={<RetainSamplesPage />} />
        <Route path="condition-excursions"  element={<ConditionExcursionsPage />} />
      </Route>
    </Routes>
  )
}
