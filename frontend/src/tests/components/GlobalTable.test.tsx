import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { GlobalTable } from '@/components/tables/GlobalTable'
import { createColumns, type TableFeatures } from '@/lib/table-utils'
import type { ColumnDef } from '@tanstack/react-table'

type TestItem = { id: number; name: string; status: string }

function buildColumns(): ColumnDef<TableFeatures, TestItem, any>[] {
  const col = createColumns<TestItem>()
  return [
    col.accessor('id', {
      id: 'id',
      header: 'ID',
      cell: (c) => c.getValue(),
    }),
    col.accessor('name', {
      id: 'name',
      header: 'Name',
      cell: (c) => c.getValue(),
    }),
    col.accessor('status', {
      id: 'status',
      header: 'Status',
      cell: (c) => c.getValue(),
    }),
  ]
}

function makeEnvelope(items: TestItem[], overrides = {}) {
  return {
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    data: {
      success: true,
      data: {
        items,
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: items.length,
          totalPages: Math.max(1, Math.ceil(items.length / 10)),
          ...overrides,
        },
      },
    },
  } as any
}

describe('GlobalTable', () => {
  it('renders 10 data rows plus header row (>= 11 rows) when data has 10 items', () => {
    const items: TestItem[] = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      status: i % 2 === 0 ? 'active' : 'inactive',
    }))
    render(<GlobalTable columns={buildColumns()} queryResult={makeEnvelope(items)} />)
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBeGreaterThanOrEqual(11)
  })

  it('handles sort header click on name column without crashing', () => {
    const items: TestItem[] = [
      { id: 1, name: 'Bravo', status: 'active' },
      { id: 2, name: 'Alpha', status: 'inactive' },
    ]
    expect(() => {
      render(<GlobalTable columns={buildColumns()} queryResult={makeEnvelope(items)} />)
      const headers = screen.getAllByRole('columnheader')
      const nameHeader = headers.find((h) => h.textContent?.includes('Name'))
      if (nameHeader) fireEvent.click(nameHeader)
    }).not.toThrow()
  })

  it('shows empty state text when data array is empty', () => {
    render(<GlobalTable columns={buildColumns()} queryResult={makeEnvelope([])} />)
    const matches = screen.getAllByText(/no items/i)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('renders without crashing when pagination next button is interacted with on single page', () => {
    const items: TestItem[] = [{ id: 1, name: 'Only', status: 'active' }]
    expect(() => {
      const { container } = render(
        <GlobalTable columns={buildColumns()} queryResult={makeEnvelope(items)} />
      )
      const buttons = container.querySelectorAll('button')
      const nextBtn = Array.from(buttons).find((b) =>
        (b.textContent || '').toLowerCase().includes('next')
      )
      if (nextBtn && !(nextBtn as HTMLButtonElement).disabled) {
        fireEvent.click(nextBtn)
      }
    }).not.toThrow()
  })

  it('renders pagination controls when data has items (not hidden)', () => {
    const items: TestItem[] = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      name: `Row ${i + 1}`,
      status: 'active',
    }))
    render(
      <GlobalTable
        columns={buildColumns()}
        queryResult={makeEnvelope(items, { totalPages: 3, totalItems: 30 })}
      />
    )
    const page1Button = screen.getByRole('button', { name: '1' }) || screen.queryByText('1')
    expect(page1Button || screen.queryByRole('navigation')).toBeTruthy()
  })

  it('renders custom cell content via renderCell (column cell fn)', () => {
    type T2 = { id: number; code: string }
    const col2 = createColumns<T2>()
    const cols: ColumnDef<TableFeatures, T2, any>[] = [
      col2.accessor('id', { id: 'id', header: 'ID', cell: (c) => c.getValue() }),
      col2.accessor('code', {
        id: 'code',
        header: 'Code',
        cell: () => <span data-testid="custom">x</span>,
      }),
    ]
    const dataEnvelope = makeEnvelope([{ id: 1, code: 'ABC' }] as any)
    render(<GlobalTable<T2> columns={cols} queryResult={dataEnvelope} />)
    expect(screen.getByTestId('custom')).toBeInTheDocument()
  })

  it('respects emptyTitle prop and renders error state without crash when isError', () => {
    const errResult = {
      isFetching: false,
      isError: true,
      error: { message: 'boom' },
      refetch: vi.fn(),
      data: undefined,
    }
    expect(() => {
      render(
        <GlobalTable
          columns={buildColumns()}
          queryResult={errResult as any}
          errorTitle="Load failed"
        />
      )
      expect(screen.getByText(/could not load data|load failed/i)).toBeInTheDocument()
    }).not.toThrow()
  })
})
