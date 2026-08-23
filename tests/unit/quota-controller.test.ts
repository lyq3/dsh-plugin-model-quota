import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserApiError } from '../../src/client/api.ts'
import { createQuotaController, type QuotaControllerConfig } from '../../src/client/quota-controller.ts'
import { deferred, snapshot, VisibilityDocumentDouble } from './client-test-helpers.ts'

const initialConfig: QuotaControllerConfig = {
  refreshIntervalMs: 60_000,
  postTurnRefreshDelayMs: 3_000,
  manualRefreshDebounceMs: 800,
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('quota controller', () => {
  it('implements the DSH HostObservable hook contract', () => {
    const controller = createQuotaController({ api: { getSnapshot: vi.fn() } as never, initialConfig, document: new VisibilityDocumentDouble() })
    expect(typeof controller.getSnapshot).toBe('function')
    expect(typeof controller.subscribe).toBe('function')
    expect(controller.getSnapshot()).toMatchObject({ snapshot: null, loading: false })
  })

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('refreshes on first mount, merges in-flight work, and keeps old snapshot while loading or failing', async () => {
    const first = deferred<typeof snapshot>()
    const second = deferred<typeof snapshot>()
    const api = { getSnapshot: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) }
    const document = new VisibilityDocumentDouble()
    const controller = createQuotaController({ api: api as never, initialConfig, document, now: () => 0 })

    const stop = controller.startVisiblePolling()
    expect(api.getSnapshot).toHaveBeenCalledOnce()
    expect(controller.getSnapshot()).toMatchObject({ loading: true, snapshot: null, lastAttemptAt: 0 })
    const merged = controller.refresh('manual')
    expect(api.getSnapshot).toHaveBeenCalledOnce()
    first.resolve(snapshot)
    await merged
    expect(controller.getSnapshot()).toMatchObject({ loading: false, snapshot, lastSuccessAt: 0, error: null })

    const failing = controller.refresh('interval')
    expect(controller.getSnapshot()).toMatchObject({ loading: true, snapshot })
    second.reject(new BrowserApiError('invalid-response'))
    await failing
    expect(controller.getSnapshot()).toMatchObject({ loading: false, snapshot, error: 'invalid-response' })
    stop()
  })

  it('reports unavailable without a snapshot', async () => {
    const api = { getSnapshot: vi.fn().mockRejectedValue(new Error('offline')) }
    const controller = createQuotaController({ api: api as never, initialConfig, document: new VisibilityDocumentDouble() })
    await controller.refresh('mount')
    expect(controller.getSnapshot()).toMatchObject({ snapshot: null, error: 'unavailable' })
  })

  it('polls only while visible, refreshes stale visibility recovery, and applies live interval config', async () => {
    const api = { getSnapshot: vi.fn().mockResolvedValue(snapshot) }
    const document = new VisibilityDocumentDouble()
    const controller = createQuotaController({ api: api as never, initialConfig, document })
    controller.startVisiblePolling()
    await flush()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.getSnapshot).toHaveBeenCalledTimes(2)
    document.setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(120_000)
    expect(api.getSnapshot).toHaveBeenCalledTimes(2)
    document.setVisibility('visible')
    await flush()
    expect(api.getSnapshot).toHaveBeenCalledTimes(3)

    document.setVisibility('hidden')
    controller.updateConfig({ ...initialConfig, refreshIntervalMs: 10_000 })
    document.setVisibility('visible')
    await flush()
    expect(api.getSnapshot).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(api.getSnapshot).toHaveBeenCalledTimes(4)
  })

  it('refreshes immediately on visibility recovery only when the last attempt is expired', async () => {
    const api = { getSnapshot: vi.fn().mockResolvedValue(snapshot) }
    const document = new VisibilityDocumentDouble()
    const controller = createQuotaController({ api: api as never, initialConfig, document })
    controller.startVisiblePolling()
    await flush()
    document.setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(59_999)
    document.setVisibility('visible')
    await flush()
    expect(api.getSnapshot).toHaveBeenCalledOnce()
    document.setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(1)
    document.setVisibility('visible')
    await flush()
    expect(api.getSnapshot).toHaveBeenCalledTimes(2)
  })

  it('schedules one running-to-idle refresh, cancels it on running, and uses live delay', async () => {
    const api = { getSnapshot: vi.fn().mockResolvedValue(snapshot) }
    const controller = createQuotaController({ api: api as never, initialConfig, document: new VisibilityDocumentDouble() })
    controller.onSessionRunningChanged(true)
    controller.onSessionRunningChanged(false)
    controller.onSessionRunningChanged(false)
    await vi.advanceTimersByTimeAsync(2_999)
    expect(api.getSnapshot).not.toHaveBeenCalled()
    controller.onSessionRunningChanged(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(api.getSnapshot).not.toHaveBeenCalled()

    controller.onSessionRunningChanged(false)
    await vi.advanceTimersByTimeAsync(100)
    controller.updateConfig({ ...initialConfig, postTurnRefreshDelayMs: 500 })
    await vi.advanceTimersByTimeAsync(499)
    expect(api.getSnapshot).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(api.getSnapshot).toHaveBeenCalledOnce()
  })

  it('gates manual refresh for 800ms after completion without blocking automatic refresh', async () => {
    const api = { getSnapshot: vi.fn().mockResolvedValue(snapshot) }
    const controller = createQuotaController({ api: api as never, initialConfig, document: new VisibilityDocumentDouble() })
    await controller.refresh('manual')
    await controller.refresh('manual')
    expect(api.getSnapshot).toHaveBeenCalledOnce()
    await controller.refresh('interval')
    expect(api.getSnapshot).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(799)
    await controller.refresh('manual')
    expect(api.getSnapshot).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    await controller.refresh('manual')
    expect(api.getSnapshot).toHaveBeenCalledTimes(3)
  })

  it('queues one final refresh when settings change during in-flight work', async () => {
    const pending = deferred<typeof snapshot>()
    const api = { getSnapshot: vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(snapshot) }
    const controller = createQuotaController({ api: api as never, initialConfig, document: new VisibilityDocumentDouble() })
    const first = controller.refresh('mount')
    const queued = controller.refresh('settings-live')
    pending.resolve(snapshot)
    await first
    await queued
    await flush()
    expect(api.getSnapshot).toHaveBeenCalledTimes(2)
  })

  it('disposes request, timers, listener, and subscriptions', async () => {
    const pending = deferred<typeof snapshot>()
    let signal: AbortSignal | undefined
    const api = { getSnapshot: vi.fn((_signal?: AbortSignal) => { signal = _signal; return pending.promise }) }
    const document = new VisibilityDocumentDouble()
    const controller = createQuotaController({ api: api as never, initialConfig, document })
    const listener = vi.fn()
    controller.subscribe(listener)
    controller.startVisiblePolling()
    controller.onSessionRunningChanged(true)
    controller.onSessionRunningChanged(false)
    expect(document.listenerCount).toBe(1)

    controller.dispose()
    expect(signal?.aborted).toBe(true)
    expect(document.listenerCount).toBe(0)
    const calls = listener.mock.calls.length
    await vi.advanceTimersByTimeAsync(120_000)
    document.setVisibility('visible')
    pending.resolve(snapshot)
    await flush()
    expect(api.getSnapshot).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledTimes(calls)
  })
})
