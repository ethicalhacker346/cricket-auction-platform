import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makePlayer } from '@/test/auctionFixtures';
import { LotTimeControls } from './LotTimeControls';
import type { LotTimeCommandResult } from '../types/index.types';

const defaults = { player: makePlayer(), timer: { remaining: 0, total: 30, isRunning: false }, status: 'live' as const, disabled: false };
describe('organizer extra-time controls', () => {
  it('offers reopening after expiry, submits the exact player and confirms this-lot-only success', async () => {
    const extend = vi.fn().mockResolvedValue({ success: true });
    render(<LotTimeControls {...defaults} onExtend={extend} />);
    expect(screen.getByText(/Add time to reopen bidding/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add 30 seconds' }));
    await screen.findByRole('status');
    expect(extend).toHaveBeenCalledWith('player-a', 30, expect.stringMatching(/^[a-f\d-]{36}$/i));
    expect(screen.getByRole('status').textContent).toContain("30 seconds added to Asha Rao's lot");
    expect(screen.getByText('This lot only')).toBeTruthy();
  });
  it('explains paused-clock behavior and supports custom whole seconds only', async () => {
    const extend = vi.fn().mockResolvedValue({ success: true });
    render(<LotTimeControls {...defaults} status="paused" onExtend={extend} />);
    expect(screen.getByText(/clock stays paused/)).toBeTruthy();
    const input = screen.getByRole('spinbutton');
    for (const value of ['', '4', '301', '7.5']) {
      fireEvent.change(input, { target: { value } });
      expect((screen.getByRole('button', { name: 'Add custom time' }) as HTMLButtonElement).disabled).toBe(true);
    }
    fireEvent.change(input, { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add custom time' }));
    await screen.findByText(/Resume the auction when ready/);
    expect(extend.mock.calls[0].slice(0, 2)).toEqual(['player-a', 75]);
  });
  it('locks rapid taps while pending and restores controls after a definitive rejection', async () => {
    let resolve!: (value: LotTimeCommandResult) => void;
    const extend = vi.fn(() => new Promise<LotTimeCommandResult>((yes) => { resolve = yes; }));
    render(<LotTimeControls {...defaults} onExtend={extend} />);
    const button = screen.getByRole('button', { name: 'Add 10 seconds' });
    fireEvent.click(button); fireEvent.click(button);
    expect(extend).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve({ success: false, error: 'The active player changed' }));
    expect(screen.getByRole('alert').textContent).toContain('active player changed');
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
  it('never automatically repeats an uncertain command; explicit retry uses exactly the same UUID', async () => {
    const extend = vi.fn().mockResolvedValueOnce({ success: false, uncertain: true, error: 'Request timed out' }).mockResolvedValue({ success: true });
    render(<LotTimeControls {...defaults} onExtend={extend} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add 30 seconds' }));
    const retry = await screen.findByRole('button', { name: 'Retry this 30s extension safely' });
    expect(extend).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button', { name: 'Add 60 seconds' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(retry);
    await waitFor(() => expect(extend).toHaveBeenCalledTimes(2));
    expect(extend.mock.calls[1]).toEqual(extend.mock.calls[0]);
    await screen.findByRole('status');
  });
  it('does not attribute an old response to a newly opened lot', async () => {
    let resolve!: (value: LotTimeCommandResult) => void;
    const extend = vi.fn(() => new Promise<LotTimeCommandResult>((yes) => { resolve = yes; }));
    const view = render(<LotTimeControls {...defaults} onExtend={extend} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add 30 seconds' }));
    view.rerender(<LotTimeControls {...defaults} player={makePlayer({ id: 'next', name: 'Bina Shah' })} onExtend={extend} />);
    await act(async () => resolve({ success: true }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Bina Shah')).toBeTruthy();
  });
  it('cannot submit while the shared organizer console is disabled', () => {
    const extend = vi.fn();
    render(<LotTimeControls {...defaults} disabled onExtend={extend} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add 60 seconds' }));
    expect(extend).not.toHaveBeenCalled();
  });
});
