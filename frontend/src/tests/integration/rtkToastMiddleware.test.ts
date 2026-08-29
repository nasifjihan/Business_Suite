import { describe, it, expect, vi, beforeEach } from 'vitest'
import rtkToastMiddleware from '@/lib/api/rtkToastMiddleware'
import { toast } from '@/components/feedback/Toast'

describe('rtkToastMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const store = { getState: vi.fn(), dispatch: vi.fn() }
  const next = vi.fn((a) => a)

  function runMiddleware(action: any) {
    rtkToastMiddleware(store as any)(next)(action)
  }

  it('calls toast.success on mutation fulfilled with endpointName converted to title', () => {
    const successSpy = vi.spyOn(toast, 'success').mockImplementation(() => {})
    runMiddleware({
      type: 'customers/createCustomer/fulfilled',
      meta: {
        arg: { type: 'mutation', endpointName: 'createCustomer' },
      },
    })
    expect(successSpy).toHaveBeenCalledTimes(1)
    expect(successSpy.mock.calls[0][0]).toBe(
      'Create customer completed successfully'
    )
  })

  it('does NOT call toast.success for query fulfilled (filters out queries)', () => {
    const successSpy = vi.spyOn(toast, 'success').mockImplementation(() => {})
    runMiddleware({
      type: 'customers/getCustomers/fulfilled',
      meta: {
        arg: { type: 'query', endpointName: 'getCustomers' },
      },
    })
    expect(successSpy).not.toHaveBeenCalled()
  })

  it('calls toast.error on mutation rejected with payload.data.error.message', () => {
    const errorSpy = vi.spyOn(toast, 'error').mockImplementation(() => {})
    runMiddleware({
      type: 'inventory/updateProduct/rejected',
      meta: {
        arg: { type: 'mutation', endpointName: 'updateProduct' },
      },
      payload: {
        data: { error: { message: 'A record with this sku already exists' } },
      },
    })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const [title, desc] = errorSpy.mock.calls[0]
    expect(title).toBe('Update product failed')
    expect(desc).toBe('A record with this sku already exists')
  })

  it('truncates long error messages to less than 120 chars', () => {
    const errorSpy = vi.spyOn(toast, 'error').mockImplementation(() => {})
    const longMessage = 'x'.repeat(200)
    runMiddleware({
      type: 'crm/createLead/rejected',
      meta: {
        arg: { type: 'mutation', endpointName: 'createLead' },
      },
      payload: {
        data: { error: { message: longMessage } },
      },
    })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const desc = errorSpy.mock.calls[0][1] as string
    expect(desc.length).toBeLessThanOrEqual(120)
    expect(desc.endsWith('...')).toBe(true)
  })

  it('falls back to "An error occurred" description when no payload/error message shape', () => {
    const errorSpy = vi.spyOn(toast, 'error').mockImplementation(() => {})
    runMiddleware({
      type: 'hrm/deleteEmployee/rejected',
      meta: {
        arg: { type: 'mutation', endpointName: 'deleteEmployee' },
      },
      payload: undefined,
      error: undefined,
    })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const [title, desc] = errorSpy.mock.calls[0]
    expect(title).toBe('Delete employee failed')
    expect(desc).toBe('An error occurred')
  })
})
