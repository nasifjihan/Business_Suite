import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DateDisplay } from '@/components/common/DateDisplay'

describe('DateDisplay', () => {
  it('renders format="short" as MMM d, yyyy (e.g. Aug 27, 2026)', () => {
    render(<DateDisplay date="2026-08-27T09:15:00Z" format="short" />)
    const time = screen.getByText(/Aug 27, 2026/i)
    expect(time).toBeInTheDocument()
  })

  it('renders format="datetime" with time portion containing ":" or AM/PM', () => {
    render(<DateDisplay date="2026-08-27T09:15:00Z" format="datetime" />)
    const timeEl = screen.getByText(/:|AM|PM/i, { selector: 'time' }) || screen.getByRole('time')
    const text = (timeEl.textContent || '').toLowerCase()
    const hasTime = text.includes(':') || text.includes('am') || text.includes('pm')
    expect(hasTime).toBe(true)
  })

  it('renders placeholder "—" when date=null without throwing', () => {
    expect(() => {
      render(<DateDisplay date={null} format="short" />)
    }).not.toThrow()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('applies custom className to outer element', () => {
    const { container } = render(
      <DateDisplay date="2026-08-27T09:15:00Z" format="short" className="text-red-500 font-bold" />
    )
    const el = container.querySelector('.text-red-500')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('font-bold')
  })

  it('renders relative format with future date (suffixRelative/addSuffix) without crash', () => {
    const future = new Date(Date.now() + 3 * 86400000).toISOString()
    expect(() => {
      render(
        <DateDisplay
          date={future}
          format="relative"
          suffixRelative=""
          addSuffix={true}
        />
      )
    }).not.toThrow()
    const el = screen.getByRole('time')
    expect(el).toBeInTheDocument()
    expect(el.textContent?.length).toBeGreaterThan(0)
  })
})
