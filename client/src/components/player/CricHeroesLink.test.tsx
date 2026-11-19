import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { normalizeCricHeroesUrl } from '@/lib/cricheroes';
import { playerFormSchema } from '@/lib/validators/playerSchema';
import { PlayerAuctionCard } from '@/features/auction/components/PlayerAuctionCard';
import { makePlayer } from '@/test/auctionFixtures';
import { CricHeroesLink } from './CricHeroesLink';
import { PlayerForm } from './PlayerForm';

const profile = 'https://cricheroes.com/player-profile/12345/asha-rao';
describe('CricHeroes outbound profiles', () => {
  it.each(['javascript:alert(1)', 'data:text/html,bad', 'https://cricheroes.com.evil.test/player-profile/1', 'https://user:password@cricheroes.com/player-profile/1', 'https://cricheroes.com:444/player-profile/1', 'https://cricheroes.com/team-profile/1', 'https://cricheroes.page.link/abc?link=https://evil.test', 'https://evil.test/player-profile/1'])('rejects unsafe/non-profile input %s', (url) => {
    expect(normalizeCricHeroesUrl(url)).toBeNull();
    const { container } = render(<CricHeroesLink url={url} />);
    expect(container.textContent).toBe('');
  });

  it('normalizes HTTPS and exposes an accessible, isolated, safe new-tab link', () => {
    const parent = vi.fn();
    render(<div onClick={parent}><CricHeroesLink url="http://cricheroes.com/player-profile/12345/asha-rao#stats" playerName="Asha Rao" /></div>);
    const link = screen.getByRole('link', { name: /Asha Rao's CricHeroes profile/ });
    expect(link.getAttribute('href')).toBe(profile);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    fireEvent.click(link); expect(parent).not.toHaveBeenCalled();
  });

  it('supports official profile domains and query-free share tokens', () => {
    expect(normalizeCricHeroesUrl('https://www.cricheroes.in/player-profile/23/test')).toBeTruthy();
    expect(normalizeCricHeroesUrl('https://cricheroes.page.link/abc_123')).toBe('https://cricheroes.page.link/abc_123');
    expect(normalizeCricHeroesUrl('')).toBeNull();
  });

  it('round-trips the optional field through create/edit form validation, including explicit clearing', () => {
    const base = { fullName: 'Asha Rao', primaryRole: 'BATSMAN' };
    expect(playerFormSchema.safeParse({ ...base, cricHeroesUrl: profile }).success).toBe(true);
    expect(playerFormSchema.safeParse({ ...base, cricHeroesUrl: '' }).success).toBe(true);
    expect(playerFormSchema.safeParse({ ...base, cricHeroesUrl: 'https://evil.test' }).success).toBe(false);
  });

  it('submits the actual create-profile form with a normalized public link', async () => {
    const save = vi.fn();
    render(<PlayerForm defaultValues={{ fullName: 'Asha Rao', primaryRole: 'BATSMAN' }} onSubmit={save} isSubmitting={false} mode="create" submitLabel="Create profile" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'CricHeroes profile link (optional)' }), { target: { value: profile.replace('https:', 'http:') } });
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ cricHeroesUrl: profile, fullName: 'Asha Rao' })));
  });

  it('submits an explicit clear from the actual edit-profile form instead of dropping the field', async () => {
    const save = vi.fn();
    render(<PlayerForm defaultValues={{ fullName: 'Asha Rao', primaryRole: 'BATSMAN', cricHeroesUrl: profile }} onSubmit={save} isSubmitting={false} mode="edit" submitLabel="Save profile" />);
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'CricHeroes profile link (optional)' });
    expect(field.value).toBe(profile);
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ cricHeroesUrl: '' })));
  });

  it('is visible on the actual live player card and disappears for players without a link', () => {
    const { rerender } = render(<PlayerAuctionCard player={makePlayer({ cricHeroesUrl: profile })} />);
    expect(screen.getByRole('link', { name: /CricHeroes/ }).getAttribute('href')).toBe(profile);
    rerender(<PlayerAuctionCard player={makePlayer({ cricHeroesUrl: undefined })} />);
    expect(screen.queryByRole('link', { name: /CricHeroes/ })).toBeNull();
  });
});
