import { useState, useEffect } from 'react'
import api from '@/api/client'

type LabConfigMap = Record<string, string>

let _cache: Map<number, LabConfigMap> = new Map()

export function invalidateLabConfigCache(labId: number) {
  _cache.delete(labId)
}

export async function fetchLabConfig(labId: number): Promise<LabConfigMap> {
  if (_cache.has(labId)) return _cache.get(labId)!
  try {
    const res = await api.get(`/lab-config?labId=${labId}`)
    const map: LabConfigMap = {}
    for (const item of res.data as { configKey: string; configValue: string }[]) {
      map[item.configKey] = item.configValue
    }
    _cache.set(labId, map)
    return map
  } catch {
    return {}
  }
}

/** Returns the value of a single lab config key. Returns `defaultValue` while loading or if key absent. */
export function useLabConfig(labId: number | null, key: string, defaultValue = '') {
  const [value, setValue] = useState(defaultValue)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!labId) { setLoading(false); return }
    fetchLabConfig(labId).then(map => {
      setValue(map[key] ?? defaultValue)
      setLoading(false)
    })
  }, [labId, key, defaultValue])

  return { value, loading }
}
