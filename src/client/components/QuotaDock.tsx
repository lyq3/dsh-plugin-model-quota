import { useEffect, useId, useRef } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/lib/types/client/contract/slots'
import type { ModelQuotaTranslate } from '../locales.ts'

export interface QuotaWindowView {
  id: string
  label: string
  remainingPercent: number | null
  resetAt: string | null
}

export interface QuotaAccountView {
  id: string
  provider: string
  label: string
  shortLabel: string
  plan: string | null
  status: 'available' | 'low' | 'exhausted' | 'error'
  remainingPercent: number | null
  resetAt: string | null
  secondaryWindows: QuotaWindowView[]
  errorCode: 'credential' | 'upstream' | 'timeout' | 'incompatible-response' | null
}

export interface QuotaSnapshotView {
  fetchedAt: string
  accounts: QuotaAccountView[]
  partial: boolean
  sourceStatus: 'ok' | 'partial' | 'unavailable'
}

export interface QuotaDockState {
  snapshot: QuotaSnapshotView | null
  loading: boolean
  error: 'unavailable' | 'invalid-response' | null
  expanded: boolean
}

export interface QuotaDockFace {
  hooks: {
    quotaDock: { getSnapshot(): QuotaDockState; subscribe(listener: () => void): () => void }
  }
  refresh: (reason?: 'manual') => void
  setExpanded: (expanded: boolean) => void
}

export type QuotaDockInjected = {
  useQuotaDock: SnapshotSelectorHook<QuotaDockState>
  refresh: QuotaDockFace['refresh']
  setExpanded: QuotaDockFace['setExpanded']
}

export type QuotaDockProps = Partial<PropsRuntime<'conversation.composer.dock'>> &
  PropsLocale<'model-quota'> &
  InjectFace<QuotaDockFace> & {
    formatDateTime?: (iso: string) => string
  }

function percent(account: Pick<QuotaAccountView, 'status' | 'remainingPercent'>): string {
  return account.status === 'error' || account.remainingPercent === null
    ? '--'
    : `${Math.round(account.remainingPercent)}%`
}

function statusKey(status: QuotaAccountView['status']): Parameters<ModelQuotaTranslate>[0] {
  return `dock.status.${status}`
}

function defaultFormatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function accountSort(left: QuotaAccountView, right: QuotaAccountView): number {
  return (
    left.provider.localeCompare(right.provider) ||
    left.label.localeCompare(right.label) ||
    left.id.localeCompare(right.id)
  )
}

export function QuotaDock({
  t,
  useQuotaDock,
  refresh,
  setExpanded,
  formatDateTime = defaultFormatDateTime,
}: QuotaDockProps) {
  const state = useQuotaDock((snapshot) => snapshot)
  const rootRef = useRef<HTMLDivElement>(null)
  const detailsId = useId()
  const accounts = [...(state.snapshot?.accounts ?? [])].sort(accountSort)

  useEffect(() => {
    if (!state.expanded) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setExpanded(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [setExpanded, state.expanded])

  const emptyText = state.snapshot === null || state.snapshot.sourceStatus === 'unavailable'
    ? t('dock.unavailable')
    : t('dock.noAccounts')

  return (
    <div className="mq-dock" ref={rootRef} data-testid="quota-dock">
      <div className="mq-dock__line">
        <button
          type="button"
          className="mq-dock__trigger"
          aria-expanded={state.expanded}
          aria-controls={detailsId}
          aria-label={state.expanded ? t('dock.closeDetails') : t('dock.openDetails')}
          onClick={() => setExpanded(!state.expanded)}
        >
          <span className="mq-dock__title">{t('dock.title')}</span>
          <span className="mq-dock__accounts">
            {accounts.length === 0 ? <span>{emptyText}</span> : accounts.map((account) => (
              <span className="mq-dock__account" data-status={account.status} key={account.id}>
                <span className="mq-dock__label" title={account.label}>{account.shortLabel}</span>
                <span
                  className={`mq-quota mq-status--${account.status}`}
                  aria-label={`${account.label}: ${t(statusKey(account.status))}, ${percent(account)}`}
                >
                  {percent(account)}
                </span>
              </span>
            ))}
          </span>
        </button>
        <button
          type="button"
          className="mq-icon-button"
          aria-label={state.loading ? t('dock.refreshing') : t('dock.refresh')}
          aria-busy={state.loading}
          disabled={state.loading}
          onClick={() => refresh('manual')}
        >
          ↻
        </button>
      </div>

      {state.expanded ? (
        <section className="mq-popover" id={detailsId} role="dialog" aria-modal="false" aria-label={t('details.title')}>
          <header className="mq-popover__header">
            <h3 className="mq-popover__title">{t('details.title')}</h3>
            <button type="button" className="mq-icon-button" aria-label={t('details.close')} onClick={() => setExpanded(false)}>×</button>
          </header>
          {state.snapshot !== null ? (
            <p className="mq-popover__meta" role="status">
              {t(`details.source.${state.snapshot.sourceStatus}`)} · {t('details.snapshotAt')}: {formatDateTime(state.snapshot.fetchedAt)}
            </p>
          ) : null}
          {accounts.length === 0 ? <p>{emptyText}</p> : (
            <ul className="mq-detail-list">
              {accounts.map((account) => (
                <li className="mq-detail" key={account.id}>
                  <div className="mq-detail__heading">
                    <span className="mq-detail__provider">{account.provider}</span>
                    {account.plan !== null ? <span>· {account.plan}</span> : null}
                  </div>
                  <p className="mq-detail__label">{account.label}</p>
                  <dl className="mq-detail__grid">
                    <dt>{t('details.remaining')}</dt>
                    <dd className={`mq-quota mq-status--${account.status}`}>{percent(account)}</dd>
                    <dt>{t('details.resetAt')}</dt>
                    <dd>{account.resetAt === null ? t('details.never') : formatDateTime(account.resetAt)}</dd>
                  </dl>
                  {account.secondaryWindows.length > 0 ? (
                    <div>
                      <strong>{t('details.secondary')}</strong>
                      <ul className="mq-window-list">
                        {account.secondaryWindows.map((window) => (
                          <li className="mq-window" key={window.id}>
                            <span>{window.label}</span>
                            <span>
                              {window.remainingPercent === null ? '--' : `${Math.round(window.remainingPercent)}%`}
                              {' · '}
                              {window.resetAt === null ? t('details.never') : formatDateTime(window.resetAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
