import { useState, useEffect } from 'react'
import api from '@/api/client'

export type ESignMethod = 'None' | 'PasswordOnly' | 'SignatureOnly' | 'PasswordAndSignature'

interface ConfigEntry { method: ESignMethod; fourEye: boolean }

let _cache: Map<string, ConfigEntry> | null = null
let _loadPromise: Promise<void> | null = null

async function _ensureLoaded(): Promise<void> {
  if (_cache) return
  if (_loadPromise) return _loadPromise
  _loadPromise = api.get('/admin/esign-config')
    .then(r => {
      _cache = new Map()
      for (const item of r.data as Array<{ actionKey: string; method: ESignMethod; fourEye: boolean }>) {
        _cache.set(item.actionKey, { method: item.method, fourEye: item.fourEye })
      }
    })
    .catch(() => { _cache = new Map() })
    .finally(() => { _loadPromise = null })
  return _loadPromise
}

/** Invalidate the module-level cache (call after saving config via admin panel). */
export function invalidateESignCache() { _cache = null }

/**
 * Returns the configured e-signature method for a given action key.
 * Falls back to PasswordAndSignature if the action key is not configured.
 * If actionKey is empty, returns immediately with PasswordAndSignature (no API call).
 */
export function useESignConfig(actionKey: string) {
  const [method, setMethod]   = useState<ESignMethod>('PasswordAndSignature')
  const [fourEye, setFourEye] = useState(false)
  const [loading, setLoading] = useState(!!actionKey)

  useEffect(() => {
    if (!actionKey) { setLoading(false); return }
    _ensureLoaded().then(() => {
      const entry = _cache?.get(actionKey)
      if (entry) { setMethod(entry.method); setFourEye(entry.fourEye) }
      setLoading(false)
    })
  }, [actionKey])

  return { method, fourEye, loading }
}
