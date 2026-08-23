import type { ReactNode } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach } from 'vitest'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import { useSyncExternalStore } from 'react'
import { modelQuotaLocales, type ModelQuotaLocaleKey } from '../../src/client/locales.ts'

afterEach(() => cleanup())

export function translator(locale: 'zh' | 'en' = 'en') {
  return (key: ModelQuotaLocaleKey, params?: Record<string, unknown>) => {
    let text: string = modelQuotaLocales[locale][key]
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
    return text
  }
}

export function createSelectorStore<T>(initial: T) {
  let snapshot = initial
  const listeners = new Set<() => void>()
  const useStore = (<S,>(selector: (value: T) => S) =>
    useSyncExternalStore(
      (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      () => selector(snapshot),
      () => selector(snapshot),
    )) as SnapshotSelectorHook<T>
  return {
    useStore,
    update(next: T) {
      act(() => {
        snapshot = next
        listeners.forEach((listener) => listener())
      })
    },
  }
}

export function renderInDocument(node: ReactNode) {
  return render(node)
}
