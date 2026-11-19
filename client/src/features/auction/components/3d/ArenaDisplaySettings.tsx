import { useId } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, Focus, Minus, Orbit, Plus, RotateCcw, Volume2, WandSparkles } from 'lucide-react';
import type { Auction3DCameraMode, Auction3DQuality, Auction3DQualityPreference } from '../../hooks/useAuction3DPreferences';
import { setAuctionAudioMuted, useAuctionAudioMuted } from '../../audio/audioPreference';
import type { ArenaCameraAction } from './ArenaCameraRig';

export interface ArenaDisplaySettingsProps {
  quality: Auction3DQuality;
  qualityPreference: Auction3DQualityPreference;
  onQualityChange: (quality: Auction3DQualityPreference) => void;
  cameraMode: Auction3DCameraMode;
  onCameraModeChange: (mode: Auction3DCameraMode) => void;
  onCameraAction: (action: ArenaCameraAction) => void;
  reducedMotion: boolean;
  motionPaused: boolean;
  onToggleMotion: () => void;
  followBids: boolean;
  onFollowBidsChange: (follow: boolean) => void;
  fps: number | null;
  recoveryMode: boolean;
}
const CAMERAS = [
  { mode: 'broadcast', label: 'Broadcast', detail: 'The complete arena', icon: Camera },
  { mode: 'stage', label: 'Stage', detail: 'Focus on the player', icon: Focus },
  { mode: 'top', label: 'Top', detail: 'Bird’s-eye view', icon: ArrowUp },
  { mode: 'floor', label: 'Floor', detail: 'Courtside perspective', icon: ArrowDown },
  { mode: 'orbit', label: 'Free orbit', detail: 'Drag, pinch or use arrows', icon: Orbit },
] as const;
const QUALITIES = [
  { value: 'auto', label: 'Auto', detail: 'Adapts to this device and sustained frame rate.' },
  { value: 'performance', label: 'Performance', detail: 'Lower GPU use, crisp essential lighting.' },
  { value: 'balanced', label: 'Balanced', detail: 'Detailed stage and soft contact shadows.' },
  { value: 'cinematic', label: 'Cinematic', detail: 'Full atmosphere, highest detail and live shadows.' },
] as const;

export function ArenaDisplaySettings(props: ArenaDisplaySettingsProps) {
  const id = useId();
  const muted = useAuctionAudioMuted();
  const motionless = props.reducedMotion || props.motionPaused;
  return <div className="space-y-6">
    <div className="rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/[0.06] to-violet-400/[0.04] p-3.5">
      <p className="flex items-center gap-2 text-xs font-bold text-cyan-100"><WandSparkles className="h-4 w-4" /> Make the arena yours</p>
      <p className="mt-1.5 text-xs leading-5 text-slate-400">These settings affect only your screen. Live data, the auction clock and bidding keep working independently.</p>
      <p className="mt-2 font-mono text-[10px] capitalize text-slate-500">{props.qualityPreference === 'auto' ? 'Auto · ' : ''}{props.quality} · {props.fps === null || motionless ? 'on-demand or warming up' : `${props.fps} fps measured`}</p>
    </div>

    <fieldset>
      <legend className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Camera view</legend>
      <div className="grid grid-cols-2 gap-2">
        {CAMERAS.map(({ mode, label, detail, icon: Icon }) => <label key={mode} className="relative cursor-pointer">
          <input className="peer sr-only" type="radio" name={`${id}-camera`} value={mode} checked={props.cameraMode === mode} onChange={() => props.onCameraModeChange(mode)} />
          <span className="flex min-h-16 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.025] p-3 transition peer-checked:border-cyan-300/40 peer-checked:bg-cyan-300/10 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-200">
            <Icon className="h-4 w-4 shrink-0 text-cyan-200" /><span><span className="block text-xs font-bold text-white">{label}</span><span className="mt-1 block text-[9px] leading-4 text-slate-500">{detail}</span></span>
          </span>
        </label>)}
      </div>
    </fieldset>

    <div role="group" aria-label="Step-by-step orbit controls" className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
      <p className="text-[10px] font-bold text-slate-400">Orbit without dragging</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {([
          ['left', 'Rotate camera left', ArrowLeft], ['right', 'Rotate camera right', ArrowRight],
          ['up', 'Tilt camera up', ArrowUp], ['down', 'Tilt camera down', ArrowDown],
          ['closer', 'Zoom camera in', Plus], ['farther', 'Zoom camera out', Minus], ['reset', 'Reset camera', RotateCcw],
        ] as const).map(([action, label, Icon]) => <button key={action} type="button" aria-label={label} title={label} onClick={() => props.onCameraAction(action)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-200"><Icon className="h-4 w-4" /></button>)}
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">Touch: drag with one finger; pinch with two to zoom. Trackpad: swipe to rotate and tilt; pinch to zoom.</p>
    </div>

    <fieldset>
      <legend className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Rendering quality</legend>
      <div className="space-y-2">
        {QUALITIES.map(({ value, label, detail }) => <label key={value} className="relative block cursor-pointer">
          <input className="peer sr-only" type="radio" name={`${id}-quality`} value={value} checked={props.qualityPreference === value} onChange={() => props.onQualityChange(value)} />
          <span className="block rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5 transition peer-checked:border-cyan-300/40 peer-checked:bg-cyan-300/10 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-200">
            <span className="flex items-center justify-between text-xs font-bold text-white">{label}{value === 'auto' && <span className="rounded-full bg-cyan-300/10 px-2 py-0.5 text-[8px] uppercase text-cyan-200">Recommended</span>}</span>
            <span className="mt-1 block text-[10px] leading-4 text-slate-500">{detail}</span>
          </span>
        </label>)}
      </div>
      {props.recoveryMode && <div role="status" className="mt-2 rounded-xl border border-amber-300/15 bg-amber-300/5 p-3 text-[11px] leading-5 text-amber-100">
        Safe rendering mode is active after a graphics reset. Select a quality above to leave it.
        {props.qualityPreference === 'auto' && <button type="button" onClick={() => props.onQualityChange('auto')} className="mt-2 block min-h-10 rounded-lg bg-amber-200/10 px-3 font-bold underline">Resume automatic quality</button>}
      </div>}
    </fieldset>

    <div className="space-y-2">
      <SettingSwitch label="Pause arena motion" detail={props.reducedMotion ? 'Your device’s reduced-motion preference is respected.' : 'Freeze decorative animation, not the live auction.'}
        checked={motionless} disabled={props.reducedMotion} onClick={props.onToggleMotion} />
      <SettingSwitch label="Follow new bids with camera" detail="Briefly spotlight a new leading franchise. Manual camera input takes priority."
        checked={props.followBids && !motionless} disabled={motionless} onClick={() => props.onFollowBidsChange(!props.followBids)} />
      <SettingSwitch label="Auction sound" detail="Bid, countdown and verdict audio. Sound may need one screen interaction to unlock."
        checked={!muted} onClick={() => setAuctionAudioMuted(!muted)} icon={<Volume2 className="h-3.5 w-3.5" />} />
    </div>
  </div>;
}

function SettingSwitch({ label, detail, checked, disabled, onClick, icon }: {
  label: string; detail: string; checked: boolean; disabled?: boolean; onClick: () => void; icon?: React.ReactNode;
}) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onClick}
    className="flex min-h-16 w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-left focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:opacity-50">
    <span><span className="flex items-center gap-2 text-xs font-bold text-white">{icon}{label}</span><span className="mt-1 block text-[10px] leading-4 text-slate-500">{detail}</span></span>
    <span aria-hidden="true" className={`relative h-6 w-10 shrink-0 rounded-full transition ${checked ? 'bg-cyan-200' : 'bg-slate-700'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-slate-950 transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} /></span>
  </button>;
}
