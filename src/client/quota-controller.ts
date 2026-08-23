import {
  BrowserApiError,
  type ModelQuotaBrowserApi,
  type QuotaSnapshot,
} from './api.ts'

export interface QuotaUiState {
  snapshot: QuotaSnapshot | null
  lastSuccessAt: number | null
  lastAttemptAt: number | null
  loading: boolean
  error: 'unavailable' | 'invalid-response' | null
  expanded: boolean
}

export type RefreshReason =
  | 'mount'
  | 'interval'
  | 'visibility'
  | 'post-turn'
  | 'manual'
  | 'settings-live'

export interface QuotaControllerConfig {
  refreshIntervalMs: number
  postTurnRefreshDelayMs: number
  manualRefreshDebounceMs: number
}

export interface QuotaController {
  getSnapshot(): QuotaUiState
  subscribe(listener: () => void): () => void
  refresh(reason: RefreshReason): Promise<void>
  setExpanded(expanded: boolean): void
  updateConfig(config: QuotaControllerConfig): void
  startVisiblePolling(): () => void
  onSessionRunningChanged(running: boolean): void
  dispose(): void
}

type VisibilityDocument = Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>

export function createQuotaController(options: {
  api: ModelQuotaBrowserApi
  initialConfig: QuotaControllerConfig
  document: VisibilityDocument
  now?: () => number
}): QuotaController {
  const now = options.now ?? Date.now
  let config = validateConfig(options.initialConfig)
  let state: QuotaUiState = {
    snapshot: null,
    lastSuccessAt: null,
    lastAttemptAt: null,
    loading: false,
    error: null,
    expanded: false,
  }
  const listeners = new Set<() => void>()
  let inFlight: Promise<void> | null = null
  let refreshPending = false
  let requestController: AbortController | null = null
  let interval: ReturnType<typeof setInterval> | null = null
  let postTurnTimer: ReturnType<typeof setTimeout> | null = null
  let pollingStarted = false
  let disposed = false
  let running = false
  let manualGateUntil = Number.NEGATIVE_INFINITY

  const publish = (patch: Partial<QuotaUiState>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }

  const clearIntervalTimer = () => {
    if (interval !== null) clearInterval(interval)
    interval = null
  }

  const installInterval = () => {
    clearIntervalTimer()
    if (!disposed && pollingStarted && options.document.visibilityState === 'visible') {
      interval = setInterval(() => { void refresh('interval') }, config.refreshIntervalMs)
    }
  }

  const clearPostTurnTimer = () => {
    if (postTurnTimer !== null) clearTimeout(postTurnTimer)
    postTurnTimer = null
  }

  const schedulePostTurnRefresh = () => {
    clearPostTurnTimer()
    postTurnTimer = setTimeout(() => {
      postTurnTimer = null
      void refresh('post-turn')
    }, config.postTurnRefreshDelayMs)
  }

  const refresh = async (reason: RefreshReason): Promise<void> => {
    if (disposed) return
    if (reason === 'manual' && now() < manualGateUntil) return
    if (inFlight) {
      if (reason === 'settings-live') refreshPending = true
      await inFlight
      if (reason === 'manual') manualGateUntil = now() + config.manualRefreshDebounceMs
      return
    }

    const startedAt = now()
    requestController = new AbortController()
    publish({ loading: true, lastAttemptAt: startedAt })
    const current = (async () => {
      try {
        const snapshot = await options.api.getSnapshot(requestController?.signal)
        if (!disposed) publish({ snapshot, lastSuccessAt: now(), error: null })
      } catch (error) {
        if (!disposed) {
          publish({ error: error instanceof BrowserApiError && error.code === 'invalid-response'
            ? 'invalid-response'
            : 'unavailable' })
        }
      } finally {
        requestController = null
        if (!disposed) publish({ loading: false })
      }
    })()
    inFlight = current
    try {
      await current
    } finally {
      if (inFlight === current) inFlight = null
      if (reason === 'manual') manualGateUntil = now() + config.manualRefreshDebounceMs
      if (!disposed && refreshPending) {
        refreshPending = false
        void refresh('settings-live')
      }
    }
  }

  const onVisibilityChange = () => {
    if (options.document.visibilityState === 'hidden') {
      clearIntervalTimer()
      return
    }
    const lastAttemptAt = state.lastAttemptAt
    if (lastAttemptAt === null || now() - lastAttemptAt >= config.refreshIntervalMs) {
      void refresh('visibility')
    }
    installInterval()
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    refresh,
    setExpanded(expanded) {
      if (!disposed && expanded !== state.expanded) publish({ expanded })
    },
    updateConfig(nextConfig) {
      if (disposed) return
      config = validateConfig(nextConfig)
      installInterval()
      if (postTurnTimer !== null) schedulePostTurnRefresh()
    },
    startVisiblePolling() {
      if (disposed || pollingStarted) return () => undefined
      pollingStarted = true
      options.document.addEventListener('visibilitychange', onVisibilityChange)
      installInterval()
      void refresh('mount')
      return () => {
        if (!pollingStarted) return
        pollingStarted = false
        clearIntervalTimer()
        options.document.removeEventListener('visibilitychange', onVisibilityChange)
      }
    },
    onSessionRunningChanged(nextRunning) {
      if (disposed || nextRunning === running) return
      const wasRunning = running
      running = nextRunning
      if (nextRunning) {
        clearPostTurnTimer()
      } else if (wasRunning) {
        schedulePostTurnRefresh()
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      pollingStarted = false
      clearIntervalTimer()
      clearPostTurnTimer()
      options.document.removeEventListener('visibilitychange', onVisibilityChange)
      requestController?.abort()
      requestController = null
      listeners.clear()
    },
  }
}

function validateConfig(config: QuotaControllerConfig): QuotaControllerConfig {
  for (const value of [config.refreshIntervalMs, config.postTurnRefreshDelayMs, config.manualRefreshDebounceMs]) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError('controller timing values must be non-negative')
  }
  return { ...config }
}
