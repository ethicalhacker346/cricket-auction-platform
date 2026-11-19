import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makePlayer } from '@/test/auctionFixtures';
import { NextLotPicker } from './NextLotPicker';
import { AuctionUndoPanel } from './AuctionUndoPanel';
import { auctionApi } from '../api/index.api';
import { eligibleRoundPlayers, runningAuctionRound, upcomingAuctionPlayers } from '../utils/roundSelection';
import type { AuctionRound, UndoableAuctionAction } from '../types/index.types';

const rounds: AuctionRound[] = [
  { id: 'first', auctionId: 'auction-a', name: 'Running round', order: 1, category: 'CUSTOM', type: 'normal', status: 'active', playerIds: ['player-a', 'player-b', 'sold', 'retired'] },
  { id: 'next', auctionId: 'auction-a', name: 'Later round', order: 2, category: 'CUSTOM', type: 'normal', status: 'pending', playerIds: ['later'] },
];
const players = [makePlayer({ status: 'pending' }), makePlayer({ id: 'player-b', name: 'Bina Shah', status: 'pending' }), makePlayer({ id: 'sold', name: 'Sold Player', status: 'sold' }), makePlayer({ id: 'retired', name: 'Retired Player', status: 'permanent_unsold' }), makePlayer({ id: 'later', name: 'Later Player', status: 'pending' })];
const action: UndoableAuctionAction = { id: 'action-1', kind: 'BID_PLACED', label: 'Team One bid 100 for Asha Rao', version: 1, createdAt: '2026-11-18T10:00:00Z' };

describe('running-round lot picker', () => {
  it('exposes any eligible member, not sold/retired players or later rounds, and supports search', () => {
    const select = vi.fn();
    render(<NextLotPicker rounds={rounds} players={players} selectedId="player-a" onSelect={select} disabled={false} />);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryByText('Later Player')).toBeNull();
    expect(screen.queryByText('Sold Player')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /Bina Shah/ }));
    expect(select).toHaveBeenCalledWith('player-b');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bina' } });
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no match' } });
    expect(screen.getByText('No matching players in this round.')).toBeTruthy();
  });

  it('retains earlier unauctioned players in the queue after a later selection', () => {
    const selectedLater = players.map((player) => player.id === 'player-b' ? { ...player, status: 'current' as const } : player);
    expect(upcomingAuctionPlayers(rounds, selectedLater).map((player) => player.id)).toEqual(['player-a', 'later']);
    expect(upcomingAuctionPlayers([{ ...rounds[0], type: 'unsold' }], [makePlayer({ status: 'unsold' })]).map((player) => player.id)).toEqual(['player-a']);
  });

  it('disables selection while a lot is active and explains the restriction', () => {
    render(<NextLotPicker rounds={rounds} players={players} selectedId="player-b" onSelect={vi.fn()} disabled />);
    expect(screen.getAllByRole<HTMLInputElement>('radio').every((radio) => radio.disabled)).toBe(true);
    expect(screen.getByText(/Finish the current lot/)).toBeTruthy();
  });

  it('mirrors round eligibility for pending and re-listed unsold rounds', () => {
    expect(runningAuctionRound([...rounds].reverse())?.id).toBe('first');
    const unsold = { ...rounds[0], type: 'unsold' as const, status: 'pending' as const, playerIds: ['player-a', 'sold', 'retired'] };
    expect(eligibleRoundPlayers(unsold, [makePlayer({ status: 'unsold' }), ...players.slice(2)])).toHaveLength(1);
    expect(eligibleRoundPlayers({ ...unsold, status: 'completed' }, players)).toEqual([]);
  });
});

describe('confirmed organizer undo', () => {
  it('never submits a confirmation after the live head has changed', () => {
    const undo = vi.fn();
    const { rerender } = render(<AuctionUndoPanel auctionId="auction-a" action={action} onUndo={undo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo latest' }));
    rerender(<AuctionUndoPanel auctionId="auction-a" action={{ ...action, id: 'newer-action', label: 'Newer bid' }} onUndo={undo} />);
    expect(screen.getByRole('alert').textContent).toContain('A newer action arrived');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Confirm undo' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm undo' }));
    expect(undo).not.toHaveBeenCalled();
  });

  it('records a trimmed reason, contains focus, prevents busy dismissal, and restores the trigger focus', async () => {
    let finish!: (value: { success: boolean }) => void;
    const undo = vi.fn(() => new Promise<{ success: boolean }>((resolve) => { finish = resolve; }));
    render(<AuctionUndoPanel auctionId="auction-a" action={action} onUndo={undo} />);
    const trigger = screen.getByRole('button', { name: 'Undo latest' }); trigger.focus(); fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Confirm undo' }));
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close dialog' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Accidental tap  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm undo' }));
    expect(undo).toHaveBeenCalledWith('action-1', 'Accidental tap');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    finish({ success: true });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toContain('Action undone');
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
  });

  it('moves the same confirmation portal on fullscreen changes without losing the typed reason', () => {
    render(<AuctionUndoPanel auctionId="auction-a" action={action} onUndo={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo latest' }));
    const dialog = screen.getByRole('dialog');
    const reason = screen.getByRole<HTMLTextAreaElement>('textbox');
    fireEvent.change(reason, { target: { value: 'Keep my reason' } });
    const fullscreen = document.createElement('section'); document.body.appendChild(fullscreen);
    const original = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
    const getter = vi.fn(() => fullscreen as Element | null);
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: getter });
    fireEvent(document, new Event('fullscreenchange'));
    expect(fullscreen.contains(dialog)).toBe(true);
    getter.mockReturnValue(null); fireEvent(document, new Event('fullscreenchange'));
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(reason.value).toBe('Keep my reason');
    fireEvent.keyDown(document, { key: 'Escape' }); fullscreen.remove();
    if (original) Object.defineProperty(document, 'fullscreenElement', original);
    else Reflect.deleteProperty(document, 'fullscreenElement');
  });

  it('presents a stale/conflict server error and can fetch the persistent recent audit', async () => {
    vi.spyOn(auctionApi, 'getActionHistory').mockResolvedValue([{ _id: 'old', kind: 'LOT_SOLD', label: 'Sell Asha', status: 'UNDONE', createdAt: action.createdAt, undoReason: 'Wrong decision' }]);
    const undo = vi.fn().mockResolvedValue({ success: false, error: 'Related wallet changed; undo blocked' });
    render(<AuctionUndoPanel auctionId="auction-a" action={action} onUndo={undo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo latest' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm undo' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('undo blocked'));
    fireEvent.click(screen.getByRole('button', { name: 'View recent audit trail' }));
    expect(await screen.findByText('Sell Asha')).toBeTruthy();
    expect(screen.getByText('Reason: Wrong decision')).toBeTruthy();
  });
});
