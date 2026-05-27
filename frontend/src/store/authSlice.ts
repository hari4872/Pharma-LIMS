import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '@/api/client'

interface AuthState {
  token: string | null
  userId: number | null
  fullName: string | null
  role: string | null
  userType: string | null
  labId: number | null
  labName: string | null   // MS-1: lab display name from JWT claim
  loading: boolean
  error: string | null
}

/** Decode a JWT payload without a library (base64url → JSON) */
function decodeJwt(token: string): Record<string, any> | null {
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** Rehydrate auth state from a stored JWT so role/fullName survive page refresh */
function hydrateFromToken(token: string | null): Partial<AuthState> {
  if (!token) return {}
  const claims = decodeJwt(token)
  if (!claims) return {}
  return {
    userId:   claims['sub']       ? Number(claims['sub']) : null,
    fullName: claims['name']      ?? claims['unique_name'] ?? null,
    role:     claims['role']      ?? claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? null,
    userType: claims['userType']  ?? null,
    labId:    claims['labId']     ? Number(claims['labId']) : null,
    labName:  claims['labName']   ?? null,
  }
}

const storedToken = localStorage.getItem('lims_token')
const initial: AuthState = {
  token: storedToken,
  userId: null,
  fullName: null,
  role: null,
  userType: null,
  labId: null,
  labName: null,
  loading: false,
  error: null,
  ...hydrateFromToken(storedToken),
}

export const login = createAsyncThunk('auth/login',
  async (creds: { username: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/login', creds)
      localStorage.setItem('lims_token', data.token)
      return data
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.error ?? 'Login failed')
    }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState: initial,
  reducers: {
    logout(state) {
      state.token = null
      state.userId = null
      state.fullName = null
      state.role = null
      state.userType = null
      state.labId = null
      state.labName = null
      localStorage.removeItem('lims_token')
    }
  },
  extraReducers: b => {
    b.addCase(login.pending, s => { s.loading = true; s.error = null })
    b.addCase(login.fulfilled, (s, a) => {
      s.loading = false
      s.token = a.payload.token
      s.userId = a.payload.userId
      s.fullName = a.payload.fullName
      s.role = a.payload.role
      s.userType = a.payload.userType
      s.labId = a.payload.labId ?? null
      s.labName = a.payload.labName ?? null
    })
    b.addCase(login.rejected, (s, a) => {
      s.loading = false
      s.error = a.payload as string
    })
  }
})

export const { logout } = authSlice.actions
export default authSlice.reducer
