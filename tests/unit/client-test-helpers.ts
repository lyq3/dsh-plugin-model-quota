import type { QuotaSnapshot } from '../../src/client/api.ts'

export const snapshot: QuotaSnapshot = {
  fetchedAt: '2030-01-01T00:00:00.000Z',
  accounts: [{
    id: 'acct_0123456789abcdef0123456789abcdef',
    provider: 'codex',
    label: 'account-a',
    shortLabel: 'account-a',
    plan: 'plus',
    status: 'available',
    remainingPercent: 75,
    resetAt: '2030-01-02T00:00:00.000Z',
    secondaryWindows: [{
      id: 'window-a',
      label: 'secondary',
      remainingPercent: 50,
      resetAt: null,
    }],
    errorCode: null,
  }],
  partial: false,
  sourceStatus: 'ok',
}

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export class VisibilityDocumentDouble {
  visibilityState: DocumentVisibilityState = 'visible'
  private readonly listeners = new Set<EventListenerOrEventListenerObject>()

  addEventListener(_type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.delete(listener)
  }

  setVisibility(visibilityState: DocumentVisibilityState): void {
    this.visibilityState = visibilityState
    const event = new Event('visibilitychange')
    for (const listener of this.listeners) {
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    }
  }

  get listenerCount(): number {
    return this.listeners.size
  }
}
