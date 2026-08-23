import { describe, expect, it } from 'vitest'
import { modelQuotaLocaleKeys, modelQuotaLocales } from '../../src/client/locales.ts'

describe('model quota locales', () => {
  it('keeps typed Chinese and English dictionaries in exact balance', () => {
    expect(Object.keys(modelQuotaLocales.zh).sort()).toEqual([...modelQuotaLocaleKeys].sort())
    expect(Object.keys(modelQuotaLocales.en).sort()).toEqual([...modelQuotaLocaleKeys].sort())
    for (const key of modelQuotaLocaleKeys) {
      expect(modelQuotaLocales.zh[key]).not.toBe('')
      expect(modelQuotaLocales.en[key]).not.toBe('')
    }
  })

  it('localizes every visible control and ARIA label', () => {
    expect(modelQuotaLocales.zh['dock.refresh']).toBe('刷新额度')
    expect(modelQuotaLocales.en['dock.refresh']).toBe('Refresh quota')
    expect(modelQuotaLocales.zh['settings.aria.keyInput']).toContain('Management Key')
    expect(modelQuotaLocales.en['settings.unsupportedTitle']).toContain('not yet supported')
  })
})
