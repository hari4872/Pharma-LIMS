import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/api/client'

export default function SetupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', fullName: '', email: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(k: string) { return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await api.post('/auth/setup', form)
      navigate('/login', { replace: true })
    } catch (err: any) {
      setError(err.friendlyMessage ?? err.response?.data?.error ?? 'Setup failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
      <div style={{ background: '#fff', padding: 40, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,.12)', width: 400 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, color: '#111827' }}>First-Run Setup</h1>
        <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: 14 }}>Create the Tenant Administrator account</p>
        <form onSubmit={handleSubmit}>
          {(['username', 'password', 'fullName', 'email'] as const).map(k => (
            <div key={k} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
                {k === 'fullName' ? 'Full Name' : k.charAt(0).toUpperCase() + k.slice(1)}
              </label>
              <input style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' as const }}
                type={k === 'password' ? 'password' : k === 'email' ? 'email' : 'text'}
                value={form[k]} onChange={set(k)} required />
            </div>
          ))}
          {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
          <button style={{ width: '100%', padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8 }} disabled={loading}>
            {loading ? 'Creating…' : 'Create Admin'}
          </button>
        </form>
      </div>
    </div>
  )
}
