import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GlobalModal } from '@/components/feedback/GlobalModal'

describe('GlobalModal', () => {
  it('renders title text when open', () => {
    render(
      <GlobalModal
        open={true}
        onOpenChange={vi.fn()}
        title="Test Title"
        description="Description text"
        children={<div>Form content</div>}
      />
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('fires onOpenChange(false) when X close button is clicked', () => {
    const onOpenChange = vi.fn()
    render(
      <GlobalModal
        open={true}
        onOpenChange={onOpenChange}
        title="Closeable"
        children={<div>Body</div>}
      />
    )
    const closeBtn = screen.getByLabelText(/close dialog/i)
    fireEvent.click(closeBtn)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders description when provided', () => {
    render(
      <GlobalModal
        open={true}
        onOpenChange={vi.fn()}
        title="T"
        description="Here is a helpful description"
        children={<div>Body</div>}
      />
    )
    expect(screen.getByText('Here is a helpful description')).toBeInTheDocument()
  })

  it('renders children content inside the modal body', () => {
    render(
      <GlobalModal
        open={true}
        onOpenChange={vi.fn()}
        title="Form"
        children={
          <div>
            <label>
              Name
              <input data-testid="name-input" />
            </label>
          </div>
        }
      />
    )
    expect(screen.getByTestId('name-input')).toBeInTheDocument()
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
  })

  it('renders custom footer buttons and submit button triggers callback', () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    render(
      <GlobalModal
        open={true}
        onOpenChange={onClose}
        title="Confirm"
        description="Please confirm"
        children={<div>Are you sure?</div>}
        footer={
          <>
            <button
              type="button"
              onClick={() => onClose(false)}
              data-testid="cancel-btn"
            >
              Cancel
            </button>
            <button type="button" onClick={onSubmit} data-testid="submit-btn">
              Confirm
            </button>
          </>
        }
      />
    )
    fireEvent.click(screen.getByTestId('cancel-btn'))
    expect(onClose).toHaveBeenCalledWith(false)

    fireEvent.click(screen.getByTestId('submit-btn'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('does not close when dismissable=false and overlay/esc would trigger', () => {
    const onOpenChange = vi.fn()
    render(
      <GlobalModal
        open={true}
        onOpenChange={onOpenChange}
        title="Persistent"
        dismissable={false}
        showCloseButton={false}
        children={<div>Must click confirm</div>}
      />
    )
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByText('Persistent')).toBeInTheDocument()
    expect(screen.queryByLabelText(/close dialog/i)).not.toBeInTheDocument()
  })
})
