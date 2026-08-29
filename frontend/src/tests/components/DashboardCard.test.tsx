import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DollarSign } from 'lucide-react'
import DashboardCard from '@/components/dashboard/DashboardCard'

describe('DashboardCard', () => {
  it('renders label and value in the DOM', () => {
    render(
      <DashboardCard
        icon={DollarSign}
        label="Sales Today"
        value="$1,234"
        tone="emerald"
      />
    )
    expect(screen.getByText('Sales Today')).toBeInTheDocument()
    expect(screen.getByText('$1,234')).toBeInTheDocument()
  })

  it('renders positive delta with emerald text and up arrow char', () => {
    render(
      <DashboardCard
        icon={DollarSign}
        label="Growth"
        value="42"
        tone="emerald"
        delta={5.2}
      />
    )
    const deltaText = screen.getByText(/5\.2%/)
    expect(deltaText).toBeInTheDocument()
    const wrapper = deltaText.closest('div')
    expect(wrapper?.className).toMatch(/emerald/)
    expect(screen.getByText('↑')).toBeInTheDocument()
  })

  it('renders negative delta with rose text and down arrow char', () => {
    render(
      <DashboardCard
        icon={DollarSign}
        label="Loss"
        value="100"
        tone="sky"
        delta={-3.1}
      />
    )
    const deltaText = screen.getByText(/3\.1%/)
    expect(deltaText).toBeInTheDocument()
    const wrapper = deltaText.closest('div')
    expect(wrapper?.className).toMatch(/rose/)
    expect(screen.getByText('↓')).toBeInTheDocument()
  })

  it('renders neutral delta=0 with neutralDelta=true using slate classes', () => {
    render(
      <DashboardCard
        icon={DollarSign}
        label="Flat"
        value="0"
        tone="slate"
        delta={0}
        neutralDelta={true}
      />
    )
    const deltaText = screen.getByText(/0\.0%/)
    const wrapper = deltaText.closest('div')
    expect(wrapper?.className).toMatch(/slate/)
  })

  it('applies violet tone classes to icon wrapper', () => {
    const { container } = render(
      <DashboardCard
        icon={DollarSign}
        label="UV"
        value="9"
        tone="violet"
      />
    )
    const wrappers = container.querySelectorAll('.rounded-lg')
    const violetWrapper = Array.from(wrappers).find((el) =>
      (el.className || '').includes('violet')
    )
    expect(violetWrapper).toBeTruthy()
    expect(violetWrapper?.className).toMatch(/bg-violet/)
    expect(violetWrapper?.className).toMatch(/text-violet/)
  })

  it('renders the DollarSign icon SVG element in DOM', () => {
    const { container } = render(
      <DashboardCard
        icon={DollarSign}
        label="Revenue"
        value="$5k"
        tone="teal"
      />
    )
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(1)
  })
})
