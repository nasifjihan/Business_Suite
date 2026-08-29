import React, { ReactNode } from 'react'
import { render, fireEvent } from '@testing-library/react'
import { Provider as ReduxProvider } from 'react-redux'
import { makeStore, type AppStore, type RootState } from '@/store/store'

export function renderWithProviders(
  ui: ReactNode,
  preloadedState?: Partial<RootState>
) {
  const store: AppStore = makeStore()
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ReduxProvider store={store as any}>
      {children}
    </ReduxProvider>
  )
  return { store, ...render(ui, { wrapper: Wrapper }) }
}

export const user = {
  click: (el: Element) => fireEvent.click(el),
  change: (el: Element, val: string) =>
    fireEvent.change(el, { target: { value: val } }),
  keyboard: (key: string) =>
    fireEvent.keyDown(document.activeElement || document.body, { key }),
}
