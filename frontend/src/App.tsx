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
import UsersPage from '@/pages/master-data/UsersPage'
import SampleTypesPage from '@/pages/master-data/SampleTypesPage'

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
        <Route index element={<Navigate to="/master-data/laboratories" replace />} />
        <Route path="master-data/laboratories" element={<LaboratoriesPage />} />
        <Route path="master-data/instruments" element={<InstrumentsPage />} />
        <Route path="master-data/materials" element={<MaterialsPage />} />
        <Route path="master-data/test-methods" element={<TestMethodsPage />} />
        <Route path="master-data/parameters" element={<ParametersPage />} />
        <Route path="master-data/spec-limits" element={<SpecLimitsPage />} />
        <Route path="master-data/form-templates" element={<FormTemplatesPage />} />
        <Route path="master-data/users" element={<UsersPage />} />
        <Route path="master-data/sample-types" element={<SampleTypesPage />} />
      </Route>
    </Routes>
  )
}
