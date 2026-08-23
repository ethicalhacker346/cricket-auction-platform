import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Float,
  Html,
  Line,
  OrbitControls,
  RoundedBox,
  Sparkles,
} from "@react-three/drei";
import {
  AdditiveBlending,
  Color,
  Group,
  InstancedMesh,
  MathUtils,
  MeshStandardMaterial,
  Object3D,
  Spherical,
  TOUCH,
  Vector3,
  type Vector3Tuple,
} from "three";
import type {
  Line2,
  LineMaterial,
  OrbitControls as OrbitControlsImpl,
} from "three-stdlib";
import type { AuctionStatus, Franchise, Player } from "@/features/auction/types/index.types";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import type {
  Auction3DCameraMode,
  Auction3DQuality,
} from "@/features/auction/hooks/useAuction3DPreferences";

export interface Auction3DRenderConfig {
  maxDpr: number;
  antialias: boolean;
  shadows: boolean;
  sparkles: number;
  contactShadowResolution: number;
}

interface AuctionArena3DProps {
  player: Player | null;
  franchises: Franchise[];
  leadingFranchise: Franchise | null;
  currentBid: { amount: number; teamId: string | null };
  timer: { remaining: number; total: number; isRunning: boolean };
  status: AuctionStatus;
  soldSequence?: number | null;
  unsoldSequence?: number | null;
  cameraMode: Auction3DCameraMode;
  quality: Auction3DQuality;
  renderConfig: Auction3DRenderConfig;
  reducedMotion: boolean;
  pageVisible: boolean;
}

function safeColor(value: string | undefined, fallback: string) {
  try {
    return new Color(value || fallback);
  } catch {
    return new Color(fallback);
  }
}

function seededAccent(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return `hsl(${hash % 360}, 82%, 58%)`;
}

function getBidderPositions(count: number): Vector3Tuple[] {
  const safeCount = Math.max(count, 1);
  return Array.from({ length: count }, (_, index) => {
    const t = safeCount === 1 ? 0.5 : index / (safeCount - 1);
    const angle = MathUtils.lerp(-1.18, 1.18, t);
    return [Math.sin(angle) * 5.8, 0.34, -0.45 - Math.cos(angle) * 3.55];
  });
}

interface BidCameraFocus {
  key: string;
  position: Vector3Tuple;
}

function CameraRig({
  mode,
  reducedMotion,
  bidFocus,
}: {
  mode: Auction3DCameraMode;
  reducedMotion: boolean;
  bidFocus: BidCameraFocus | null;
}) {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const destination = useRef(new Vector3());
  const lookAt = useRef(new Vector3(0, 1.55, -0.35));
  const offset = useRef(new Vector3());
  const spherical = useRef(new Spherical());
  const savedPosition = useRef(new Vector3());
  const transitionStart = useRef(new Vector3());
  const focusCamera = useRef(new Vector3());
  const focusTarget = useRef(new Vector3());
  const transitionTarget = useRef(new Vector3());
  const animatedTarget = useRef(new Vector3());
  const focusStartedAt = useRef<number | null>(null);
  const focusKey = bidFocus?.key ?? null;
  const focusX = bidFocus?.position[0] ?? 0;
  const focusY = bidFocus?.position[1] ?? 0;
  const focusZ = bidFocus?.position[2] ?? 0;
  const lastBidKey = useRef<string | null>(focusKey);
  const [isBidFocusing, setIsBidFocusing] = useState(false);

  useEffect(() => {
    if (!focusKey) {
      lastBidKey.current = null;
      focusStartedAt.current = null;
      setIsBidFocusing(false);
      return;
    }
    if (lastBidKey.current === focusKey) return;
    lastBidKey.current = focusKey;

    // Preserve the viewer's exact orbit position so the cinematic cut can
    // return them to the same 360° view after spotlighting the new leader.
    if (focusStartedAt.current == null) savedPosition.current.copy(camera.position);
    transitionStart.current.copy(camera.position);
    transitionTarget.current.copy(controls.current?.target ?? lookAt.current);

    focusTarget.current.set(focusX, focusY + 0.68, focusZ);
    focusCamera.current.set(focusX * 0.54, 2.65, focusZ + 6.1);
    focusStartedAt.current = performance.now();
    setIsBidFocusing(true);

    const totalMs = reducedMotion ? 1_150 : 2_050;
    const timer = window.setTimeout(() => {
      focusStartedAt.current = null;
      setIsBidFocusing(false);
    }, totalMs);
    return () => window.clearTimeout(timer);
  }, [focusKey, focusX, focusY, focusZ, camera, reducedMotion]);

  /*
   * Trackpads emit WheelEvents for two-finger swipes. OrbitControls normally
   * interprets those as zoom only, which makes an immersive room feel stuck.
   * In orbit mode we map horizontal swipe -> 360° azimuth and vertical swipe
   * -> top/floor elevation. A native pinch (ctrlKey) is left to OrbitControls
   * for dolly zoom. Capture phase prevents both handlers acting on one swipe.
   */
  useEffect(() => {
    const element = gl.domElement;
    const onTrackpadGesture = (event: WheelEvent) => {
      if (mode !== "orbit" || event.ctrlKey || !controls.current) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const target = controls.current.target;
      offset.current.copy(camera.position).sub(target);
      spherical.current.setFromVector3(offset.current);
      spherical.current.theta -= event.deltaX * 0.0032;
      spherical.current.phi = MathUtils.clamp(
        spherical.current.phi + event.deltaY * 0.0026,
        Math.PI * 0.1,
        Math.PI * 0.64,
      );
      offset.current.setFromSpherical(spherical.current);
      camera.position.copy(target).add(offset.current);
      camera.lookAt(target);
      controls.current.update();
    };

    element.addEventListener("wheel", onTrackpadGesture, { passive: false, capture: true });
    return () => element.removeEventListener("wheel", onTrackpadGesture, { capture: true });
  }, [camera, gl, mode]);

  useFrame(({ clock }, delta) => {
    const presets: Record<Exclude<Auction3DCameraMode, "orbit">, Vector3Tuple> = {
      broadcast: [0, 5.65, 14.6],
      stage: [0, 3.65, 10.2],
      top: [0, 13.4, 4.8],
      floor: [0, 1.2, 12.8],
    };

    if (focusStartedAt.current != null) {
      const elapsed = (performance.now() - focusStartedAt.current) / 1000;
      const intro = reducedMotion ? 0.16 : 0.38;
      const holdEnd = reducedMotion ? 0.79 : 1.3;
      const total = reducedMotion ? 1.15 : 2.05;
      const returnPosition = mode === "orbit"
        ? savedPosition.current
        : destination.current.set(...presets[mode]);

      if (elapsed <= intro) {
        const progress = MathUtils.smootherstep(elapsed, 0, intro);
        camera.position.lerpVectors(transitionStart.current, focusCamera.current, progress);
        animatedTarget.current.lerpVectors(transitionTarget.current, focusTarget.current, progress);
      } else if (elapsed <= holdEnd) {
        camera.position.copy(focusCamera.current);
        animatedTarget.current.copy(focusTarget.current);
      } else {
        const progress = MathUtils.smootherstep(elapsed, holdEnd, total);
        camera.position.lerpVectors(focusCamera.current, returnPosition, progress);
        animatedTarget.current.lerpVectors(focusTarget.current, lookAt.current, progress);
      }

      camera.lookAt(animatedTarget.current);
      if (controls.current) controls.current.target.copy(animatedTarget.current);
      return;
    }

    if (controls.current && !controls.current.target.equals(lookAt.current)) {
      controls.current.target.lerp(lookAt.current, 1 - Math.exp(-delta * 6));
    }
    if (mode === "orbit") return;

    const base = presets[mode];
    const canSway = mode === "broadcast" && !reducedMotion;
    const sway = canSway ? Math.sin(clock.elapsedTime * 0.18) * 0.24 : 0;
    destination.current.set(base[0] + sway, base[1], base[2]);
    camera.position.lerp(destination.current, 1 - Math.exp(-delta * 2.8));
    camera.lookAt(lookAt.current);
  });

  return (
    <OrbitControls
      ref={controls}
      enabled={mode === "orbit" && !isBidFocusing}
      makeDefault
      target={[0, 1.55, -0.35]}
      minDistance={7.5}
      maxDistance={19}
      minPolarAngle={Math.PI * 0.1}
      maxPolarAngle={Math.PI * 0.64}
      enablePan={false}
      enableDamping
      dampingFactor={0.06}
      touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE }}
      autoRotate={false}
    />
  );
}

function BrandMonolith() {
  return (
    <group position={[0, 6.15, -7.4]}>
      <RoundedBox args={[5.4, 0.88, 0.14]} radius={0.07} smoothness={4}>
        <meshPhysicalMaterial
          color="#070b16"
          emissive="#10233c"
          emissiveIntensity={0.72}
          metalness={0.84}
          roughness={0.22}
          clearcoat={1}
        />
      </RoundedBox>
      <Html transform center distanceFactor={7.2} position={[0, 0, 0.1]} style={{ pointerEvents: "none" }}>
        <div className="flex w-[390px] select-none items-center justify-center gap-4 text-center [text-shadow:0_0_26px_rgba(34,211,238,.32)]">
          <span className="text-[9px] font-black uppercase tracking-[0.34em] text-cyan-300/60">Live arena</span>
          <span className="h-5 w-px bg-white/15" />
          <span className="text-3xl font-black italic tracking-[-0.06em] text-white">
            GULLY<span className="text-amber-300">BID</span>
          </span>
        </div>
      </Html>
    </group>
  );
}

function AudienceBowl({ quality }: { quality: Auction3DQuality }) {
  const count = quality === "cinematic" ? 210 : quality === "balanced" ? 132 : 72;
  const lights = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const palette = useMemo(
    () => [new Color("#67e8f9"), new Color("#fcd34d"), new Color("#a78bfa"), new Color("#34d399")],
    [],
  );

  const seats = useMemo(() => {
    return Array.from({ length: count }, (_, index) => {
      const tier = index % 3;
      const slot = Math.floor(index / 3);
      const slots = Math.ceil(count / 3);
      const t = slots <= 1 ? 0.5 : slot / (slots - 1);
      const angle = MathUtils.lerp(-1.32, 1.32, t) + tier * 0.008;
      const radius = 10.5 + tier * 1.35;
      return {
        position: [
          Math.sin(angle) * radius,
          1.05 + tier * 0.58 + ((index * 7) % 5) * 0.075,
          -0.7 - Math.cos(angle) * radius,
        ] as Vector3Tuple,
        scale: 0.65 + ((index * 13) % 7) * 0.075,
        color: palette[(index * 11 + tier) % palette.length],
      };
    });
  }, [count, palette]);

  useLayoutEffect(() => {
    if (!lights.current) return;
    seats.forEach((seat, index) => {
      dummy.position.set(...seat.position);
      dummy.scale.setScalar(seat.scale);
      dummy.updateMatrix();
      lights.current?.setMatrixAt(index, dummy.matrix);
      lights.current?.setColorAt(index, seat.color);
    });
    lights.current.instanceMatrix.needsUpdate = true;
    if (lights.current.instanceColor) lights.current.instanceColor.needsUpdate = true;
  }, [dummy, seats]);

  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1.2, -0.7]}>
        <torusGeometry args={[11.2, 0.08, 8, 140]} />
        <meshStandardMaterial color="#0b1324" emissive="#123047" emissiveIntensity={0.55} metalness={0.75} roughness={0.35} />
      </mesh>
      <instancedMesh ref={lights} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[0.052, 5, 5]} />
        <meshBasicMaterial vertexColors transparent opacity={0.72} toneMapped={false} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

function ArenaArchitecture({ quality }: { quality: Auction3DQuality }) {
  const roof = useRef<Group>(null);

  useFrame(({ clock }, delta) => {
    if (!roof.current) return;
    roof.current.rotation.y += delta * (quality === "performance" ? 0.008 : 0.018);
    roof.current.position.y = 6.2 + Math.sin(clock.elapsedTime * 0.25) * 0.04;
  });

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <circleGeometry args={[20, 96]} />
        <meshStandardMaterial color="#02040a" metalness={0.35} roughness={0.78} />
      </mesh>

      <gridHelper
        args={[36, 36, "#1f4960", "#0b1422"]}
        position={[0, -0.045, 0]}
        material-transparent
        material-opacity={0.34}
      />

      {[8.2, 11.5, 15].map((radius, index) => (
        <mesh key={radius} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.015 + index * 0.002, 0]}>
          <torusGeometry args={[radius, index === 0 ? 0.025 : 0.014, 8, 120]} />
          <meshBasicMaterial
            color={index === 0 ? "#22d3ee" : "#334155"}
            transparent
            opacity={index === 0 ? 0.26 : 0.18}
          />
        </mesh>
      ))}

      <group ref={roof}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[8.7, 0.055, 10, 128]} />
          <meshStandardMaterial color="#172033" emissive="#0e7490" emissiveIntensity={1.4} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[6.6, 0.018, 8, 128]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.36} />
        </mesh>
      </group>

      <BrandMonolith />
    </>
  );
}

function PlayerPortrait({ player }: { player: Player }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [player.profileImage]);

  if (player.profileImage && !failed) {
    return (
      <img
        src={player.profileImage}
        alt=""
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <span
      className="flex h-full w-full items-center justify-center text-4xl font-black text-white"
      style={{ background: `linear-gradient(145deg, ${seededAccent(player.avatarSeed || player.id)}, #111827)` }}
    >
      {initials(player.name)}
    </span>
  );
}

function HologramRingSystem({
  accent,
  critical,
  reducedMotion,
}: {
  accent: Color;
  critical: boolean;
  reducedMotion: boolean;
}) {
  const outerOrbit = useRef<Group>(null);
  const diagonalOrbit = useRef<Group>(null);
  const horizontalOrbit = useRef<Group>(null);
  const floorPulseA = useRef<Group>(null);
  const floorPulseB = useRef<Group>(null);
  const ice = useMemo(() => accent.clone().lerp(new Color("#ffffff"), 0.62), [accent]);

  useFrame(({ clock }, delta) => {
    if (reducedMotion) return;
    const speed = critical ? 1.8 : 0.72;
    if (outerOrbit.current) outerOrbit.current.rotation.z += delta * speed * 0.34;
    if (diagonalOrbit.current) {
      diagonalOrbit.current.rotation.z -= delta * speed * 0.52;
      diagonalOrbit.current.rotation.y += delta * speed * 0.19;
    }
    if (horizontalOrbit.current) horizontalOrbit.current.rotation.z += delta * speed * 0.28;

    const waveA = (Math.sin(clock.elapsedTime * speed * 2.2) + 1) * 0.5;
    const waveB = (Math.sin(clock.elapsedTime * speed * 2.2 + Math.PI) + 1) * 0.5;
    floorPulseA.current?.scale.setScalar(0.94 + waveA * 0.16);
    floorPulseB.current?.scale.setScalar(0.97 + waveB * 0.13);
  });

  return (
    <>
      <group position={[0, 2.3, 0]}>
        {/* Vertical broadcast ring: wide glow + sharp energy core. */}
        <group ref={outerOrbit} rotation={[0.03, 0.18, 0]}>
          <mesh>
            <torusGeometry args={[2.04, 0.07, 14, 144]} />
            <meshBasicMaterial color={accent} transparent opacity={0.075} toneMapped={false} depthWrite={false} blending={AdditiveBlending} />
          </mesh>
          <mesh>
            <torusGeometry args={[2.04, 0.019, 12, 144]} />
            <meshBasicMaterial color={accent} transparent opacity={0.68} toneMapped={false} depthWrite={false} blending={AdditiveBlending} />
          </mesh>
          <mesh position={[2.04, 0, 0]}>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshBasicMaterial color={ice} toneMapped={false} blending={AdditiveBlending} />
          </mesh>
        </group>

        {/* Counter-rotating diagonal orbit adds genuine spatial depth. */}
        <group ref={diagonalOrbit} rotation={[0.42, -0.58, 0.24]}>
          <mesh>
            <torusGeometry args={[2.28, 0.012, 10, 144]} />
            <meshBasicMaterial color={ice} transparent opacity={0.34} toneMapped={false} depthWrite={false} blending={AdditiveBlending} />
          </mesh>
          <mesh position={[-2.28, 0, 0]}>
            <octahedronGeometry args={[0.105, 0]} />
            <meshBasicMaterial color={accent} toneMapped={false} blending={AdditiveBlending} />
          </mesh>
        </group>

        {/* Horizontal scanner ring intersects the vertical orbits cleanly. */}
        <group ref={horizontalOrbit} rotation={[Math.PI / 2, 0, 0.18]}>
          <mesh>
            <torusGeometry args={[1.78, 0.026, 12, 128]} />
            <meshBasicMaterial color={accent} transparent opacity={0.48} toneMapped={false} depthWrite={false} blending={AdditiveBlending} />
          </mesh>
          {[0, Math.PI].map((angle) => (
            <mesh key={angle} position={[Math.cos(angle) * 1.78, Math.sin(angle) * 1.78, 0]}>
              <sphereGeometry args={[0.065, 10, 10]} />
              <meshBasicMaterial color={ice} toneMapped={false} blending={AdditiveBlending} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Twin floor pulses visually lock the card into the auction platform. */}
      <group position={[0, 0.565, 0]}>
        <group ref={floorPulseA}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.22, 0.035, 10, 120]} />
            <meshBasicMaterial color={accent} transparent opacity={0.42} toneMapped={false} depthWrite={false} blending={AdditiveBlending} />
          </mesh>
        </group>
        <group ref={floorPulseB}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.48, 0.016, 8, 120]} />
            <meshBasicMaterial color={ice} transparent opacity={0.2} toneMapped={false} depthWrite={false} blending={AdditiveBlending} />
          </mesh>
        </group>
      </group>
    </>
  );
}

function PlayerHologram({
  player,
  currentBid,
  timer,
  reducedMotion,
}: {
  player: Player | null;
  currentBid: { amount: number; teamId: string | null };
  timer: { remaining: number; total: number; isRunning: boolean };
  reducedMotion: boolean;
}) {
  const critical = timer.isRunning && timer.remaining > 0 && timer.remaining <= 5;
  const accent = useMemo(
    () =>
      safeColor(
        critical
          ? "#fb7185"
          : player
            ? seededAccent(player.avatarSeed || player.id || player.name)
            : "#22d3ee",
        "#22d3ee",
      ),
    [critical, player?.avatarSeed, player?.id, player?.name],
  );

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.22, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[2.45, 2.85, 0.48, 72]} />
        <meshPhysicalMaterial
          color="#090d18"
          metalness={0.9}
          roughness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[2.15, 2.35, 0.08, 72]} />
        <meshStandardMaterial color="#0b1220" emissive={accent} emissiveIntensity={0.7} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.55, 0]}>
        <torusGeometry args={[2.2, 0.045, 12, 100]} />
        <meshBasicMaterial color={accent} transparent opacity={0.78} toneMapped={false} />
      </mesh>

      <HologramRingSystem
        accent={accent}
        critical={critical}
        reducedMotion={reducedMotion}
      />

      <Float
        speed={reducedMotion ? 0 : 1.25}
        rotationIntensity={reducedMotion ? 0 : 0.035}
        floatIntensity={reducedMotion ? 0 : 0.18}
      >
        <group position={[0, 2.34, 0]}>
          <RoundedBox args={[2.9, 2.62, 0.13]} radius={0.12} smoothness={5}>
            <meshPhysicalMaterial
              color="#06101b"
              transparent
              opacity={0.82}
              metalness={0.52}
              roughness={0.22}
              transmission={0.04}
              clearcoat={1}
              emissive={accent}
              emissiveIntensity={0.12}
            />
          </RoundedBox>

          <Html transform center distanceFactor={6} position={[0, 0, 0.1]} style={{ pointerEvents: "none" }}>
            {player ? (
              <article
                className="w-[232px] select-none overflow-hidden rounded-[18px] border bg-[#040711]/90 p-2.5 text-white shadow-[0_0_42px_rgba(34,211,238,.16)] backdrop-blur-xl"
                style={{ borderColor: `${accent.getStyle()}70` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-14 w-[52px] shrink-0 overflow-hidden rounded-xl border border-white/15 shadow-xl"
                    style={{ boxShadow: `0 0 26px ${accent.getStyle()}36` }}
                  >
                    <PlayerPortrait player={player} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-cyan-300/70">
                      Now under the hammer
                    </span>
                    <h2 className="mt-1 truncate text-[17px] font-black leading-none tracking-[-0.04em]">
                      {player.name}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded-full bg-white/8 px-2 py-0.5 text-[8px] font-bold uppercase text-slate-300">
                        {player.role}
                      </span>
                      {player.tag ? (
                        <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[8px] font-black uppercase text-amber-200">
                          {player.tag}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/8 pt-3">
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-500">Base price</p>
                    <p className="mt-0.5 text-sm font-black text-slate-200">{formatLakhs(player.basePrice)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-amber-300/70">Current bid</p>
                    <p className="mt-0.5 text-lg font-black text-amber-300">
                      {currentBid.amount > 0 ? formatLakhs(currentBid.amount) : "Opening"}
                    </p>
                  </div>
                </div>
              </article>
            ) : (
              <div className="w-[232px] select-none rounded-[20px] border border-cyan-300/20 bg-[#040711]/85 px-6 py-8 text-center text-white backdrop-blur-xl">
                <div className="mx-auto h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_22px_7px_rgba(34,211,238,.35)]" />
                <p className="mt-5 text-[10px] font-black uppercase tracking-[0.42em] text-cyan-300/60">Stage ready</p>
                <p className="mt-2 text-2xl font-black tracking-tight">Awaiting next lot</p>
              </div>
            )}
          </Html>
        </group>
      </Float>

      <pointLight position={[0, 2.2, 0.8]} color={accent} intensity={critical ? 18 : player ? 12 : 5} distance={7} />
    </group>
  );
}

function FranchiseMark({ franchise }: { franchise: Franchise }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [franchise.logo]);

  if (franchise.logo && !failed) {
    return (
      <img
        src={franchise.logo}
        alt=""
        onError={() => setFailed(true)}
        className="h-8 w-8 rounded-lg bg-white/5 object-contain"
      />
    );
  }

  return (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-black text-white"
      style={{ background: `linear-gradient(135deg, ${franchise.colorFrom}, ${franchise.colorTo})` }}
    >
      {initials(franchise.shortName)}
    </span>
  );
}

function TeamPod({
  franchise,
  position,
  leading,
  reducedMotion,
}: {
  franchise: Franchise;
  position: Vector3Tuple;
  leading: boolean;
  reducedMotion: boolean;
}) {
  const group = useRef<Group>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const color = useMemo(() => safeColor(franchise.colorFrom, "#38bdf8"), [franchise.colorFrom]);
  const remaining = Math.max(0, franchise.purseTotal - franchise.spent - (franchise.reservedBudget ?? 0));

  useFrame(({ clock }) => {
    if (!group.current || !material.current) return;
    const pulse = reducedMotion ? 0 : (Math.sin(clock.elapsedTime * 3.2) + 1) * 0.5;
    const targetScale = leading ? 1.04 + pulse * 0.035 : 1;
    group.current.scale.setScalar(MathUtils.lerp(group.current.scale.x, targetScale, 0.08));
    group.current.position.y = position[1] + (leading && !reducedMotion ? pulse * 0.06 : 0);
    material.current.emissiveIntensity = leading ? 0.7 + pulse * 1.1 : 0.09;
  });

  return (
    <group ref={group} position={position} rotation={[0, Math.atan2(-position[0], -position[2]), 0]}>
      <RoundedBox args={[1.28, 0.48, 0.76]} radius={0.11} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial
          ref={material}
          color="#0a1020"
          emissive={color}
          emissiveIntensity={leading ? 1 : 0.09}
          metalness={0.72}
          roughness={0.24}
        />
      </RoundedBox>
      <mesh position={[0, 0.295, 0]}>
        <boxGeometry args={[1.02, 0.03, 0.52]} />
        <meshBasicMaterial color={color} transparent opacity={leading ? 0.9 : 0.36} />
      </mesh>

      <Html transform sprite center distanceFactor={7.8} position={[0, 0.7, 0]} style={{ pointerEvents: "none" }}>
        <div
          className={`w-[128px] select-none rounded-xl border px-2 py-1.5 text-white shadow-2xl backdrop-blur-xl ${
            leading ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-[#050812]/88"
          }`}
        >
          <div className="flex items-center gap-2">
            <FranchiseMark franchise={franchise} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-black">{franchise.shortName}</p>
              <p className="mt-0.5 text-[8px] text-slate-400">{formatLakhs(remaining)} left</p>
            </div>
            {leading ? <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_3px_rgba(252,211,77,.55)]" /> : null}
          </div>
        </div>
      </Html>
    </group>
  );
}

function BidBeam({
  from,
  color,
  pulseKey,
  reducedMotion,
}: {
  from: Vector3Tuple;
  color: string;
  pulseKey: number;
  reducedMotion: boolean;
}) {
  const glow = useRef<Line2>(null);
  const energy = useRef<Line2>(null);
  const nodes = useRef<Group>(null);
  const impact = useRef<Group>(null);
  const lastPulse = useRef(pulseKey);
  const burstStartedAt = useRef<number | null>(pulseKey > 0 ? performance.now() : null);
  const start = useMemo(
    () => new Vector3(from[0], from[1] + 0.38, from[2]),
    [from[0], from[1], from[2]],
  );
  const end = useMemo(() => new Vector3(0, 1.18, 0), []);
  const beamColor = useMemo(() => safeColor(color, "#fbbf24"), [color]);
  const hotColor = useMemo(() => beamColor.clone().lerp(new Color("#ffffff"), 0.42), [beamColor]);

  useEffect(() => {
    if (lastPulse.current === pulseKey) return;
    lastPulse.current = pulseKey;
    burstStartedAt.current = performance.now();
  }, [pulseKey]);

  useFrame(({ clock }, delta) => {
    const energyMaterial = energy.current?.material as LineMaterial | undefined;
    const glowMaterial = glow.current?.material as LineMaterial | undefined;
    const wave = reducedMotion ? 0.5 : (Math.sin(clock.elapsedTime * 6.2) + 1) * 0.5;

    if (energyMaterial) {
      if (!reducedMotion) energyMaterial.dashOffset -= delta * 1.85;
      energyMaterial.opacity = 0.58 + wave * 0.28;
    }
    if (glowMaterial) glowMaterial.opacity = 0.1 + wave * 0.09;

    nodes.current?.children.forEach((node, index) => {
      const progress = reducedMotion
        ? (index + 1) / 4
        : (clock.elapsedTime * 0.72 + index / 3) % 1;
      node.position.lerpVectors(start, end, progress);
      const scale = 0.7 + wave * 0.45;
      node.scale.setScalar(scale);
    });

    if (!impact.current) return;
    const burstElapsed = burstStartedAt.current == null
      ? Number.POSITIVE_INFINITY
      : (performance.now() - burstStartedAt.current) / 1000;
    const burst = burstElapsed < 0.7 ? 1 - burstElapsed / 0.7 : 0;
    impact.current.scale.setScalar(0.86 + wave * 0.2 + burst * 0.65);
    impact.current.rotation.z += reducedMotion ? 0 : delta * (1.4 + burst * 2.4);
  });

  const points = useMemo<Vector3Tuple[]>(
    () => [
      [start.x, start.y, start.z],
      [end.x, end.y, end.z],
    ],
    [start, end],
  );

  return (
    <group>
      {/* Wide additive aura gives the bid path a volumetric, broadcast-light look. */}
      <Line
        ref={glow}
        points={points}
        color={beamColor}
        lineWidth={10}
        transparent
        opacity={0.16}
        depthWrite={false}
        blending={AdditiveBlending}
      />
      {/* Animated energy lane visibly travels from the bidder to center stage. */}
      <Line
        ref={energy}
        points={points}
        color={beamColor}
        lineWidth={4.5}
        transparent
        opacity={0.78}
        dashed
        dashScale={2.2}
        dashSize={0.42}
        gapSize={0.16}
        depthWrite={false}
        blending={AdditiveBlending}
      />
      {/* Bright solid core keeps the beam substantial at every camera distance. */}
      <Line
        points={points}
        color={hotColor}
        lineWidth={1.8}
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={AdditiveBlending}
      />

      <group ref={nodes}>
        {[0, 1, 2].map((index) => (
          <mesh key={index}>
            <sphereGeometry args={[0.085, 12, 12]} />
            <meshBasicMaterial color={hotColor} toneMapped={false} transparent opacity={0.92} blending={AdditiveBlending} />
          </mesh>
        ))}
      </group>

      <group ref={impact} position={[end.x, end.y, end.z]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.32, 0.045, 10, 48]} />
          <meshBasicMaterial color={beamColor} transparent opacity={0.78} toneMapped={false} blending={AdditiveBlending} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshBasicMaterial color={hotColor} transparent opacity={0.9} toneMapped={false} blending={AdditiveBlending} />
        </mesh>
        <pointLight color={beamColor} intensity={7} distance={4.5} />
      </group>
    </group>
  );
}

function BidderRing({
  franchises,
  leadingId,
  bidAmount,
  reducedMotion,
}: {
  franchises: Franchise[];
  leadingId: string | null;
  bidAmount: number;
  reducedMotion: boolean;
}) {
  const visibleTeams = franchises.slice(0, 12);
  const positions = useMemo(
    () => getBidderPositions(visibleTeams.length),
    [visibleTeams.length],
  );

  const leadingIndex = visibleTeams.findIndex((team) => team.id === leadingId);

  return (
    <group>
      {visibleTeams.map((franchise, index) => (
        <TeamPod
          key={franchise.id}
          franchise={franchise}
          position={positions[index]}
          leading={franchise.id === leadingId}
          reducedMotion={reducedMotion}
        />
      ))}
      {leadingIndex >= 0 ? (
        <BidBeam
          from={positions[leadingIndex]}
          color={visibleTeams[leadingIndex].colorFrom || "#fbbf24"}
          pulseKey={bidAmount}
          reducedMotion={reducedMotion}
        />
      ) : null}
    </group>
  );
}

function ProceduralGavel({
  soldSequence,
  reducedMotion,
}: {
  soldSequence?: number | null;
  reducedMotion: boolean;
}) {
  const gavel = useRef<Group>(null);
  const lastSequence = useRef(soldSequence);
  const strikeStartedAt = useRef<number | null>(null);

  useEffect(() => {
    if (lastSequence.current === soldSequence) return;
    lastSequence.current = soldSequence;
    if (soldSequence != null) strikeStartedAt.current = performance.now();
  }, [soldSequence]);

  useFrame(() => {
    if (!gavel.current) return;
    if (reducedMotion || strikeStartedAt.current == null) {
      gavel.current.rotation.z = -0.36;
      return;
    }

    const elapsed = (performance.now() - strikeStartedAt.current) / 1000;
    if (elapsed > 0.85) {
      strikeStartedAt.current = null;
      gavel.current.rotation.z = -0.36;
      return;
    }

    const strike = elapsed < 0.34
      ? MathUtils.smootherstep(elapsed, 0, 0.34)
      : 1 - MathUtils.smootherstep(elapsed, 0.34, 0.85);
    gavel.current.rotation.z = MathUtils.lerp(-0.92, 0.32, strike);
  });

  return (
    <group position={[3.25, 0.72, 0.35]}>
      <group ref={gavel} rotation={[0.1, -0.35, -0.36]}>
        <mesh position={[0, -0.55, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.11, 1.75, 20]} />
          <meshStandardMaterial color="#7c3f1d" roughness={0.28} metalness={0.18} />
        </mesh>
        <mesh position={[0, 0.38, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 1.05, 28]} />
          <meshPhysicalMaterial color="#d59b4a" metalness={0.72} roughness={0.2} clearcoat={1} />
        </mesh>
      </group>
      <mesh position={[0.58, 0.06, 0.02]} receiveShadow>
        <cylinderGeometry args={[0.55, 0.62, 0.16, 40]} />
        <meshStandardMaterial color="#8b5a2b" metalness={0.42} roughness={0.35} />
      </mesh>
    </group>
  );
}

function OutcomeShockwave({
  soldSequence,
  unsoldSequence,
  reducedMotion,
}: {
  soldSequence?: number | null;
  unsoldSequence?: number | null;
  reducedMotion: boolean;
}) {
  const group = useRef<Group>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const lastSold = useRef(soldSequence);
  const lastUnsold = useRef(unsoldSequence);
  const startedAt = useRef<number | null>(null);
  const outcomeColor = useRef("#34d399");

  useEffect(() => {
    let nextColor: string | null = null;
    if (lastSold.current !== soldSequence) {
      lastSold.current = soldSequence;
      if (soldSequence != null) nextColor = "#34d399";
    }
    if (lastUnsold.current !== unsoldSequence) {
      lastUnsold.current = unsoldSequence;
      if (unsoldSequence != null) nextColor = "#fb7185";
    }
    if (!nextColor) return;
    outcomeColor.current = nextColor;
    material.current?.color.set(nextColor);
    material.current?.emissive.set(nextColor);
    startedAt.current = performance.now();
  }, [soldSequence, unsoldSequence]);

  useFrame(() => {
    if (!group.current || !material.current || startedAt.current == null || reducedMotion) {
      if (group.current) group.current.visible = false;
      return;
    }
    const elapsed = (performance.now() - startedAt.current) / 1000;
    if (elapsed >= 1.65) {
      group.current.visible = false;
      startedAt.current = null;
      return;
    }
    group.current.visible = true;
    const progress = elapsed / 1.65;
    group.current.scale.setScalar(MathUtils.lerp(0.35, 4.5, progress));
    material.current.opacity = Math.pow(1 - progress, 1.7) * 0.9;
    material.current.emissiveIntensity = 2.2;
  });

  return (
    <group ref={group} visible={false} position={[0, 0.57, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 1.29, 80]} />
        <meshStandardMaterial
          ref={material}
          color={outcomeColor.current}
          emissive={outcomeColor.current}
          emissiveIntensity={2.2}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function StatusLights({ status }: { status: AuctionStatus }) {
  const statusColor =
    status === "live" ? "#34d399" : status === "paused" ? "#fbbf24" : status === "completed" ? "#a78bfa" : "#38bdf8";

  return (
    <>
      <ambientLight intensity={0.32} color="#c7d2fe" />
      <hemisphereLight args={["#93c5fd", "#020308", 0.52]} />
      <spotLight
        position={[0, 10, 4]}
        color="#dbeafe"
        intensity={90}
        angle={0.36}
        penumbra={0.92}
        distance={26}
        castShadow
        shadow-bias={-0.0001}
      />
      <spotLight position={[-8, 5, 3]} color="#06b6d4" intensity={65} angle={0.48} penumbra={1} />
      <spotLight position={[8, 5, 2]} color="#8b5cf6" intensity={60} angle={0.5} penumbra={1} />
      <pointLight position={[0, 5.5, -5]} color={statusColor} intensity={24} distance={15} />
    </>
  );
}

function ArenaScene(props: AuctionArena3DProps) {
  const visibleTeams = props.franchises.slice(0, 12);
  const positions = useMemo(
    () => getBidderPositions(visibleTeams.length),
    [visibleTeams.length],
  );
  const leadingIndex = visibleTeams.findIndex(
    (team) => team.id === props.currentBid.teamId,
  );
  const bidFocus = useMemo<BidCameraFocus | null>(() => {
    if (leadingIndex < 0 || props.currentBid.amount <= 0) return null;
    return {
      key: `${props.player?.id ?? "lot"}:${props.currentBid.teamId}:${props.currentBid.amount}`,
      position: positions[leadingIndex],
    };
  }, [leadingIndex, positions, props.currentBid.amount, props.currentBid.teamId, props.player?.id]);

  return (
    <>
      <color attach="background" args={["#02030a"]} />
      <fog attach="fog" args={["#02030a", 13, 30]} />
      <CameraRig
        mode={props.cameraMode}
        reducedMotion={props.reducedMotion}
        bidFocus={bidFocus}
      />
      <StatusLights status={props.status} />
      <ArenaArchitecture quality={props.quality} />
      <AudienceBowl quality={props.quality} />
      <PlayerHologram
        player={props.player}
        currentBid={props.currentBid}
        timer={props.timer}
        reducedMotion={props.reducedMotion}
      />
      <BidderRing
        franchises={props.franchises}
        leadingId={props.currentBid.teamId}
        bidAmount={props.currentBid.amount}
        reducedMotion={props.reducedMotion}
      />
      <ProceduralGavel soldSequence={props.soldSequence} reducedMotion={props.reducedMotion} />
      <OutcomeShockwave
        soldSequence={props.soldSequence}
        unsoldSequence={props.unsoldSequence}
        reducedMotion={props.reducedMotion}
      />

      <Sparkles
        count={props.renderConfig.sparkles}
        scale={[20, 7, 16]}
        position={[0, 3.2, -1]}
        size={1.5}
        speed={props.reducedMotion ? 0 : 0.18}
        opacity={0.28}
        color="#93c5fd"
      />

      {props.renderConfig.shadows ? (
        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.5}
          scale={20}
          blur={2.8}
          far={9}
          resolution={props.renderConfig.contactShadowResolution}
          color="#00030a"
        />
      ) : null}
    </>
  );
}

export default function AuctionArena3D(props: AuctionArena3DProps) {
  return (
    <div className="absolute inset-0 bg-[#02030a]">
      <Canvas
        shadows={props.renderConfig.shadows}
        frameloop={props.pageVisible ? "always" : "never"}
        dpr={[1, props.renderConfig.maxDpr]}
        camera={{ position: [0, 5.65, 14.6], fov: 40, near: 0.1, far: 70 }}
        style={{ touchAction: "none" }}
        gl={{
          antialias: props.renderConfig.antialias,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        fallback={
          <div className="flex h-full items-center justify-center bg-[#02030a] text-sm text-slate-400">
            WebGL is unavailable in this browser.
          </div>
        }
      >
        <Suspense fallback={null}>
          <ArenaScene {...props} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_32%,rgba(2,3,10,.18)_62%,rgba(2,3,10,.78)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#02030a]/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-[#02030a] via-[#02030a]/65 to-transparent" />
    </div>
  );
}

