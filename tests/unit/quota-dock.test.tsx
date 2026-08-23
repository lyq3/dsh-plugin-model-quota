// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuotaDock, type QuotaDockState } from '../../src/client/components/QuotaDock.tsx'
import { createSelectorStore, renderInDocument, translator } from './model-quota-component-test-helper.tsx'

const snapshot: NonNullable<QuotaDockState['snapshot']> = {
  fetchedAt: '2026-08-21T10:00:00.000Z',
  partial: true,
  sourceStatus: 'partial',
  accounts: [
    {
      id: 'acct-c', provider: 'kimi', label: 'account-c', shortLabel: 'account-c', plan: 'Pro', status: 'error',
      remainingPercent: null, resetAt: null, secondaryWindows: [], errorCode: 'timeout',
    },
    {
      id: 'acct-b', provider: 'codex', label: 'account-b', shortLabel: 'account-b', plan: 'Plus', status: 'exhausted',
      remainingPercent: 0, resetAt: '2026-08-22T10:00:00.000Z', secondaryWindows: [], errorCode: null,
    },
    {
      id: 'acct-a', provider: 'codex', label: 'account-a', shortLabel: 'account-a', plan: 'Plus', status: 'low',
      remainingPercent: 15, resetAt: '2026-08-23T10:00:00.000Z', secondaryWindows: [{ id: 'weekly', label: 'Weekly', remainingPercent: 72, resetAt: '2026-08-28T10:00:00.000Z' }], errorCode: null,
    },
    {
      id: 'acct-d', provider: 'kimi', label: 'account-d', shortLabel: 'account-d', plan: null, status: 'available',
      remainingPercent: 80, resetAt: null, secondaryWindows: [], errorCode: null,
    },
  ],
}

function setup(state: QuotaDockState) {
  const store = createSelectorStore(state)
  const refresh = vi.fn()
  const setExpanded = vi.fn()
  renderInDocument(
    <QuotaDock
      t={translator('en')}
      useQuotaDock={store.useStore}
      refresh={refresh}
      setExpanded={setExpanded}
      formatDateTime={(iso) => `date:${iso}`}
    />,
  )
  return { store, refresh, setExpanded }
}

describe('QuotaDock', () => {
  it('renders a single-line arbitrary account list and distinguishes 0 from errors', () => {
    setup({ snapshot, loading: false, error: null, expanded: false })
    expect(screen.getByTestId('quota-dock').querySelector('.mq-dock__line')).not.toBeNull()
    expect(screen.getAllByText(/account-[a-d]/)).toHaveLength(4)
    expect(screen.getByText('0%').classList.contains('mq-status--exhausted')).toBe(true)
    expect(screen.getByText('--').classList.contains('mq-status--error')).toBe(true)
    expect(screen.getByText('15%').classList.contains('mq-status--low')).toBe(true)
    expect(screen.getByText('80%').classList.contains('mq-status--available')).toBe(true)
  })

  it('keeps old values while loading and exposes an accessible refresh button', () => {
    const { refresh } = setup({ snapshot, loading: true, error: null, expanded: false })
    expect(screen.getByText('15%')).not.toBeNull()
    const button = screen.getByRole('button', { name: 'Refreshing quota' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(button)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('opens anchored details with sorted accounts, secondary windows and source metadata', () => {
    setup({ snapshot, loading: false, error: null, expanded: true })
    const dialog = screen.getByRole('dialog', { name: 'Quota details' })
    const items = dialog.querySelectorAll('.mq-detail')
    expect(items[0]?.textContent).toContain('account-a')
    expect(items[1]?.textContent).toContain('account-b')
    expect(items[2]?.textContent).toContain('account-c')
    expect(items[3]?.textContent).toContain('account-d')
    expect(dialog.textContent).toContain('Weekly')
    expect(dialog.textContent).toContain('Some accounts failed')
    expect(dialog.textContent).toContain('date:2026-08-21T10:00:00.000Z')
  })

  it('closes details on Escape, outside click and repeated trigger click', () => {
    const { setExpanded } = setup({ snapshot, loading: false, error: null, expanded: true })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(setExpanded).toHaveBeenCalledWith(false)
    fireEvent.pointerDown(document.body)
    expect(setExpanded).toHaveBeenCalledWith(false)
    fireEvent.click(screen.getByRole('button', { name: 'Close quota details' }))
    expect(setExpanded).toHaveBeenCalledWith(false)
  })

  it('calls manual refresh when idle', () => {
    const { refresh } = setup({ snapshot, loading: false, error: null, expanded: false })
    fireEvent.click(screen.getByRole('button', { name: 'Refresh quota' }))
    expect(refresh).toHaveBeenCalledWith('manual')
  })
})
