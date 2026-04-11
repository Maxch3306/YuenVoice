import { create } from 'zustand'

export type Lang = 'zh' | 'en'

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
  toggle: () => void
}

export const useLanguageStore = create<LangState>((set, get) => ({
  lang: (typeof localStorage !== 'undefined'
    ? (localStorage.getItem('yuenvoice-lang') as Lang)
    : null) || 'zh',
  setLang: (lang) => {
    localStorage.setItem('yuenvoice-lang', lang)
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en'
    set({ lang })
  },
  toggle: () => {
    const next = get().lang === 'zh' ? 'en' : 'zh'
    get().setLang(next as Lang)
  },
}))

export { useT } from './translations.js'
