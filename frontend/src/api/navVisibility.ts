import api from './client'

export type VisibilityMap = Record<string, boolean>

export async function fetchNavVisibility(): Promise<VisibilityMap> {
  const { data } = await api.get<VisibilityMap>('/nav-visibility')
  return data
}

export async function saveNavVisibility(map: VisibilityMap): Promise<VisibilityMap> {
  const items = Object.entries(map).map(([Key, IsEnabled]) => ({ Key, IsEnabled }))
  const { data } = await api.put<VisibilityMap>('/nav-visibility', items)
  return data
}
