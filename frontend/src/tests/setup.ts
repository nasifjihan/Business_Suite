import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: vi.fn(() => '/'),
  useSearchParams: () => new URLSearchParams(),
  useParams: vi.fn(() => ({})),
}))

if (typeof window !== 'undefined') {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as any

  if (!(window as any).ResizeObserver) {
    ;(window as any).ResizeObserver = class ResizeObserver {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
  }

  if (!(window as any).IntersectionObserver) {
    ;(window as any).IntersectionObserver = class IntersectionObserver {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      takeRecords = vi.fn(() => [])
      root = null
      rootMargin = ''
      thresholds = []
    }
  }

  if (!(window as any).scrollTo) {
    window.scrollTo = vi.fn()
  }

  Element.prototype.scrollIntoView ||= vi.fn()
}

vi.mock('@/lib/api/apiSlice', async () => {
  const actual = await vi.importActual('@/lib/api/apiSlice')
  return {
    ...(actual as any),
    apiSlice: {
      ...(actual as any).apiSlice,
      reducerPath: 'api',
      reducer: (state: any = {}) => state,
      middleware: () => (next: any) => (action: any) => next(action),
      enhanceEndpoints: vi.fn(),
      injectEndpoints: vi.fn(),
      usePrefetch: vi.fn(),
    },
  }
})
