import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import ModuleErrorCRM from '@/app/(dashboard)/crm/error'
import ModuleErrorInventory from '@/app/(dashboard)/inventory/error'
import ModuleErrorHRM from '@/app/(dashboard)/hrm/error'
import ModuleErrorSales from '@/app/(dashboard)/sales/error'
import ModuleErrorAdmin from '@/app/(dashboard)/administration/error'
import NotFound from '@/app/not-found'

const mockError = new Error('test error') as Error & { digest?: string }
const mockReset = vi.fn()

describe('Module Error Boundaries', () => {
  it('CRM module error boundary renders heading with CRM module substring', () => {
    render(<ModuleErrorCRM error={mockError} reset={mockReset} />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.textContent).toMatch(/CRM module/i)
    expect(screen.getByRole('button', { name: /reset view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument()
  })

  it('Inventory module error boundary renders heading with Inventory module substring', () => {
    render(<ModuleErrorInventory error={mockError} reset={mockReset} />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.textContent).toMatch(/Inventory module/i)
    expect(screen.getByRole('button', { name: /reset view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument()
  })

  it('HRM module error boundary renders heading with HRM module substring', () => {
    render(<ModuleErrorHRM error={mockError} reset={mockReset} />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.textContent).toMatch(/HRM module/i)
    expect(screen.getByRole('button', { name: /reset view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument()
  })

  it('Sales module error boundary renders heading with Sales module substring', () => {
    render(<ModuleErrorSales error={mockError} reset={mockReset} />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.textContent).toMatch(/Sales module/i)
    expect(screen.getByRole('button', { name: /reset view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument()
  })

  it('Administration module error boundary renders heading with Administration module substring', () => {
    render(<ModuleErrorAdmin error={mockError} reset={mockReset} />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.textContent).toMatch(/Administration module/i)
    expect(screen.getByRole('button', { name: /reset view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument()
  })

  it('NotFound page renders "Page not found" heading and two dashboard/home links', () => {
    const { container } = render(<NotFound />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toMatch(/page not found/i)

    const links = screen.getAllByRole('link')
    const dashboardLink = links.find((l) => l.getAttribute('href') === '/dashboard')
    const homeLink = links.find((l) => l.getAttribute('href') === '/')
    expect(dashboardLink).toBeTruthy()
    expect(homeLink).toBeTruthy()
    expect(within(dashboardLink as HTMLElement).getByText(/back to dashboard/i)).toBeInTheDocument()
    expect(within(homeLink as HTMLElement).getByText(/home/i)).toBeInTheDocument()
  })
})
