import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { fetchNavVisibility, saveNavVisibility, type VisibilityMap } from '@/api/navVisibility'

interface NavVisibilityState {
  map: VisibilityMap
  loading: boolean
  saving: boolean
  error: string | null
}

const initial: NavVisibilityState = {
  map: {},
  loading: false,
  saving: false,
  error: null,
}

// Keys that are always ON — Admin can never turn these off
const PROTECTED_KEYS = new Set(['sec.master-data', 'md.nav-visibility', 'nav.dashboard'])

export const loadNavVisibility = createAsyncThunk('navVisibility/load', async () => {
  return await fetchNavVisibility()
})

export const persistNavVisibility = createAsyncThunk('navVisibility/save', async (map: VisibilityMap) => {
  return await saveNavVisibility(map)
})

const navVisibilitySlice = createSlice({
  name: 'navVisibility',
  initialState: initial,
  reducers: {},
  extraReducers: b => {
    b.addCase(loadNavVisibility.pending,  s => { s.loading = true; s.error = null })
    b.addCase(loadNavVisibility.fulfilled, (s, a) => { s.loading = false; s.map = a.payload })
    b.addCase(loadNavVisibility.rejected,  s => { s.loading = false })

    b.addCase(persistNavVisibility.pending,   s => { s.saving = true; s.error = null })
    b.addCase(persistNavVisibility.fulfilled, (s, a) => { s.saving = false; s.map = a.payload })
    b.addCase(persistNavVisibility.rejected,  (s, a) => { s.saving = false; s.error = a.error.message ?? 'Save failed' })
  }
})

export default navVisibilitySlice.reducer

/** Returns true if the key is visible (absent from map = ON by default). */
export function isNavEnabled(map: VisibilityMap, key: string): boolean {
  if (PROTECTED_KEYS.has(key)) return true
  return map[key] !== false
}
