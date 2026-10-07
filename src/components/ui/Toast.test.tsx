import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Toast } from './Toast';

describe('Toast', () => {
  it('keeps an empty live region on the page, ready for messages', () => {
    render(<Toast toasts={[]} onDismiss={() => undefined} />);

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
  });

  it('shows each message with a text label for its tone', () => {
    render(
      <Toast
        toasts={[
          { id: 1, tone: 'success', message: 'Booking BK-1001 approved.' },
          { id: 2, tone: 'error', message: 'Couldn’t decline BK-1007. Change reverted.' },
        ]}
        onDismiss={() => undefined}
      />,
    );

    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Done: Booking BK-1001 approved.');
    expect(region).toHaveTextContent('Error: Couldn’t decline BK-1007. Change reverted.');
  });

  it('calls onDismiss with the toast id', async () => {
    const onDismiss = vi.fn();
    render(<Toast toasts={[{ id: 7, tone: 'info', message: 'Hi' }]} onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    expect(onDismiss).toHaveBeenCalledWith(7);
  });
});
