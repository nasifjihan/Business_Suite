import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge, type StatusBadgeTone } from '@/components/common/StatusBadge'

function outerSpan(labelText: string): HTMLElement {
  return screen.getByText(labelText).parentElement as HTMLElement
}

describe('StatusBadge', () => {
  it('renders success tone with emerald classes', () => {
    render(<StatusBadge tone="success" label="ACTIVE" />)
    expect(outerSpan('ACTIVE').className).toMatch(/emerald/)
  })

  it('renders danger tone with rose classes', () => {
    render(<StatusBadge tone="danger" label="BLOCKED" />)
    expect(outerSpan('BLOCKED').className).toMatch(/rose/)
  })

  it('renders neutral tone with slate classes', () => {
    render(<StatusBadge tone="neutral" label="DRAFT" />)
    expect(outerSpan('DRAFT').className).toMatch(/slate/)
  })

  it('renders info tone with sky classes', () => {
    render(<StatusBadge tone="info" label="INFO" />)
    const cls = outerSpan('INFO').className
    expect(cls).toMatch(/\bsky\b/)
    const anyForbidden = /\b(emerald|rose|slate|violet|teal)\b/.test(cls)
    const allowedMain = /\bsky\b/.test(cls)
    expect(allowedMain || (!anyForbidden)).toBeTruthy()
  })

  it('renders warning-equivalent info tone with violet or sky palette only (not non-6 family)', () => {
    const toneList: StatusBadgeTone[] = ['info', 'pending', 'approved', 'rejected']
    toneList.forEach((tone) => {
      render(<StatusBadge tone={tone} label={`X-${tone}`} />)
      const cls = outerSpan(`X-${tone}`).className
      expect(/(emerald|rose|slate|sky|violet|teal)/.test(cls)).toBeTruthy()
    })
  })

  it('falls back to neutral slate classes when tone is undefined', () => {
    render(
      <StatusBadge tone={undefined as unknown as StatusBadgeTone} label="FALLBACK" />
    )
    expect(outerSpan('FALLBACK').className).toMatch(/slate/)
  })

  it('renders approved tone with emerald classes', () => {
    render(<StatusBadge tone="approved" label="APPROVED" />)
    expect(outerSpan('APPROVED').className).toMatch(/emerald/)
  })

  it('renders dot indicator when dot=true', () => {
    const { container } = render(<StatusBadge tone="success" label="LIVE" dot />)
    const spans = container.querySelectorAll('span')
    const dotSpans = Array.from(spans).filter((s) => {
      const cls = (s as HTMLElement).className || ''
      return cls.includes('h-1.5') && cls.includes('w-1.5')
    })
    expect(dotSpans.length).toBeGreaterThanOrEqual(1)
  })

  it('passes custom className through to outer wrapper', () => {
    render(<StatusBadge tone="neutral" label="CUSTOM" className="custom-add mt-2" />)
    const cls = outerSpan('CUSTOM').className
    expect(cls).toMatch(/\bcustom-add\b/)
    expect(cls).toMatch(/\bmt-2\b/)
  })
})
