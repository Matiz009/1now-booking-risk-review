import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toast, TOAST_DURATION_MS } from './Toast';

afterEach(() => {
  vi.useRealTimers();
});

/*
 * The timer tests use fake timers with fireEvent and focus(), not user-event:
 * user-event's async wrapper waits on a real setTimeout, which fake timers freeze.
 */

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

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

  it('dismisses itself after the duration', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast toasts={[{ id: 3, tone: 'info', message: 'Hi' }]} onDismiss={onDismiss} />);

    advance(TOAST_DURATION_MS - 1);
    expect(onDismiss).not.toHaveBeenCalled();

    advance(1);
    expect(onDismiss).toHaveBeenCalledWith(3);
  });

  it('pauses while hovered and resumes with the time left', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast toasts={[{ id: 4, tone: 'info', message: 'Hi' }]} onDismiss={onDismiss} />);
    const toast = screen.getByText('Hi');

    advance(3000);
    fireEvent.mouseEnter(toast);
    advance(TOAST_DURATION_MS * 3);
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.mouseLeave(toast);
    advance(1500);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(500);
    expect(onDismiss).toHaveBeenCalledWith(4);
  });

  it('pauses while keyboard focus is inside it and resumes on blur', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <>
        <button type="button">Elsewhere</button>
        <Toast toasts={[{ id: 5, tone: 'info', message: 'Hi' }]} onDismiss={onDismiss} />
      </>,
    );

    act(() => screen.getByRole('button', { name: 'Dismiss notification' }).focus());
    advance(TOAST_DURATION_MS * 3);
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus());
    advance(TOAST_DURATION_MS);
    expect(onDismiss).toHaveBeenCalledWith(5);
  });
});
