import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/App';
import { configureApi, resetApi } from '@/features/risk-review/api/bookingsApi';

beforeEach(() => {
  resetApi();
  configureApi({ delayMs: 0 });
});

afterEach(() => {
  window.location.hash = '';
});

describe('App', () => {
  it('renders the page heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Booking Risk Review' })).toBeInTheDocument();
  });

  it('shows both pages in the main nav, with the review queue current', () => {
    render(<App />);
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));

    expect(nav.getByRole('link', { name: 'Review queue' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'All bookings' })).not.toHaveAttribute('aria-current');
  });

  it('switches to All bookings when its link is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));

    await user.click(nav.getByRole('link', { name: 'All bookings' }));

    expect(await screen.findByRole('region', { name: 'All bookings' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'All bookings' })).toHaveAttribute('aria-current', 'page');
    expect(window.location.hash).toBe('#/bookings');
  });
});
