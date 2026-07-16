import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import STRINGS, { type StringKey } from './strings'

export type Language = 'en' | 'ja' | 'id'

type TranslationMap = Record<string, string>

interface TranslationContextValue {
  lang: Language
  setLang: (l: Language) => void
  t: (key: StringKey) => string
  loading: boolean
}

const TranslationContext = createContext<TranslationContextValue>({
  lang:    'en',
  setLang: () => {},
  t:       key => STRINGS[key],
  loading: false,
})

const CACHE_KEY = (lang: Language) => `lims_translations_${lang}`
const CACHE_VER = 'v2'                    // bump this to bust all caches on next deploy
const CACHE_VER_KEY = 'lims_trans_ver'

function loadCache(lang: Language): TranslationMap | null {
  try {
    if (localStorage.getItem(CACHE_VER_KEY) !== CACHE_VER) {
      // Version changed — clear all translation caches
      ;(['en', 'ja', 'id'] as Language[]).forEach(l => localStorage.removeItem(CACHE_KEY(l)))
      localStorage.setItem(CACHE_VER_KEY, CACHE_VER)
      return null
    }
    const raw = localStorage.getItem(CACHE_KEY(lang))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveCache(lang: Language, map: TranslationMap) {
  try {
    localStorage.setItem(CACHE_VER_KEY, CACHE_VER)
    localStorage.setItem(CACHE_KEY(lang), JSON.stringify(map))
  } catch { /* quota — silently skip */ }
}

async function fetchTranslations(lang: Language): Promise<TranslationMap> {
  const token = localStorage.getItem('lims_token')
  const resp = await fetch('/api/v1/chatbot/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ targetLanguage: lang, strings: STRINGS }),
  })
  if (!resp.ok) throw new Error(`Translation API error: ${resp.status}`)
  return resp.json()
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [lang,    setLangState] = useState<Language>(() => {
    return (localStorage.getItem('lims_lang') as Language) ?? 'en'
  })
  const [maps,    setMaps]    = useState<Partial<Record<Language, TranslationMap>>>({})
  const [loading, setLoading] = useState(false)

  const ensureTranslation = useCallback(async (target: Language) => {
    if (target === 'en') return   // English = source strings, no fetch needed

    // Already loaded this session
    if (maps[target]) return

    // Try cache first
    const cached = loadCache(target)
    if (cached) {
      setMaps(prev => ({ ...prev, [target]: cached }))
      return
    }

    // Call Groq via backend
    setLoading(true)
    try {
      const translated = await fetchTranslations(target)
      saveCache(target, translated)
      setMaps(prev => ({ ...prev, [target]: translated }))
    } catch (err) {
      console.warn('[i18n] Translation fetch failed, falling back to English:', err)
      // Fallback: use English strings so UI doesn't break
    } finally {
      setLoading(false)
    }
  }, [maps])

  const setLang = useCallback(async (target: Language) => {
    localStorage.setItem('lims_lang', target)
    setLangState(target)
    await ensureTranslation(target)
  }, [ensureTranslation])

  // On mount: ensure the persisted language is loaded
  useEffect(() => {
    if (lang !== 'en') ensureTranslation(lang)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const t = useCallback((key: StringKey): string => {
    if (lang === 'en') return STRINGS[key]
    const map = maps[lang]
    return map?.[key] ?? STRINGS[key]   // fallback to English if key missing
  }, [lang, maps])

  return (
    <TranslationContext.Provider value={{ lang, setLang, t, loading }}>
      {children}
    </TranslationContext.Provider>
  )
}

export function useTranslation() {
  return useContext(TranslationContext)
}
