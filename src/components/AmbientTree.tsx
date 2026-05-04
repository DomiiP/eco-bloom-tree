import { useMemo, useRef, useEffect, useState } from "react";

type TreeState = "dead" | "dying" | "weak" | "healthy" | "thriving";

interface AmbientTreeProps {
  state: TreeState;
  score: number;
  transitionSpeed: number;
  waterLevel?: number;
  lightLevel?: number;
  humanWaterLevel?: number;
  humanLightLevel?: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const stateConfig = {
  dead: { leaves: 0, trunkColor: "#5a3a2a", leafColor: "#8B4513", bgGlow: "rgba(139,69,19,0.08)", label: "Mrtvo" },
  dying: { leaves: 4, trunkColor: "#5a3a2a", leafColor: "#a86a2a", bgGlow: "rgba(168,106,42,0.09)", label: "Umirajoče" },
  weak: { leaves: 11, trunkColor: "#5a3a2a", leafColor: "#c9a84c", bgGlow: "rgba(201,168,76,0.1)", label: "Šibko" },
  healthy: { leaves: 19, trunkColor: "#5a3a2a", leafColor: "#4a9e5c", bgGlow: "rgba(74,158,92,0.12)", label: "Zdravo" },
  thriving: { leaves: 28, trunkColor: "#5a3a2a", leafColor: "#2d7a3e", bgGlow: "rgba(45,122,62,0.15)", label: "Cvetoče" },
};

// Branch endpoints and midpoints where leaves grow
const branchPoints = [
  // Left branch 1 (top)
  { x: 95, y: 120 }, { x: 105, y: 128 }, { x: 115, y: 135 },
  // Right branch 1 (top)
  { x: 195, y: 115 }, { x: 185, y: 123 }, { x: 175, y: 130 },
  // Left branch 2 (lower)
  { x: 100, y: 155 }, { x: 110, y: 158 }, { x: 120, y: 162 },
  // Right branch 2 (lower)
  { x: 190, y: 150 }, { x: 180, y: 153 }, { x: 170, y: 157 },
  // Crown top area
  { x: 140, y: 105 }, { x: 160, y: 105 }, { x: 150, y: 95 },
  { x: 130, y: 112 }, { x: 170, y: 112 },
  // Between branches
  { x: 125, y: 140 }, { x: 165, y: 137 }, { x: 145, y: 118 },
  // Extra canopy fill
  { x: 108, y: 145 }, { x: 185, y: 140 }, { x: 135, y: 98 },
  { x: 158, y: 100 }, { x: 145, y: 108 },
  // Outer edges
  { x: 90, y: 130 }, { x: 200, y: 125 }, { x: 150, y: 88 },
];

const leafPath = (cx: number, cy: number, size: number) => {
  const s = size / 10;
  return `M ${cx} ${cy - 8 * s} C ${cx + 5 * s} ${cy - 8 * s} ${cx + 9 * s} ${cy - 3 * s} ${cx + 9 * s} ${cy + 2 * s} C ${cx + 9 * s} ${cy + 6 * s} ${cx + 5 * s} ${cy + 8 * s} ${cx} ${cy + 10 * s} C ${cx - 5 * s} ${cy + 8 * s} ${cx - 9 * s} ${cy + 6 * s} ${cx - 9 * s} ${cy + 2 * s} C ${cx - 9 * s} ${cy - 3 * s} ${cx - 5 * s} ${cy - 8 * s} ${cx} ${cy - 8 * s} Z`;
};

interface FallingLeaf {
  id: number;
  cx: number;
  cy: number;
  size: number;
  rotation: number;
  color: string;
}

const AmbientTree = ({
  state,
  score,
  transitionSpeed,
  waterLevel = 1,
  lightLevel = 1,
  humanWaterLevel = 0,
  humanLightLevel = 0,
}: AmbientTreeProps) => {
  const config = stateConfig[state];
  const personPanelX = 34;
  const personPanelY = 44;
  const treePanelX = 286;
  const treePanelY = 44;
  const treeTankCenterX = treePanelX + 55;
  const treeTrunkBaseX = 245;
  const treeOffsetX = treeTankCenterX - treeTrunkBaseX;
  const normalizedWaterLevel = clamp(waterLevel, 0, 1.6);
  const normalizedLightLevel = clamp(lightLevel, 0, 1.6);
  const normalizedHumanWaterLevel = clamp(humanWaterLevel, 0, 1);
  const normalizedHumanLightLevel = clamp(humanLightLevel, 0, 1);
  const waterTankFill = clamp(normalizedWaterLevel / 1.6, 0, 1);
  const energyTankFill = clamp(normalizedLightLevel / 1.6, 0, 1);
  const waterFlowOpacity = clamp(0.2 + waterTankFill * 0.75, 0.2, 0.95);
  const energyFlowOpacity = clamp(0.2 + energyTankFill * 0.75, 0.2, 0.95);
  const personEnergy = clamp(0.35 + normalizedHumanLightLevel * 0.6, 0.35, 0.95);
  const personWater = clamp(0.35 + normalizedHumanWaterLevel * 0.6, 0.35, 0.95);
  // Color/opacity transitions stay smooth (independent of sim speed)
  const baseDuration = 1.5;
  const durationMs = baseDuration * 1000;
  // Falling leaf animation must scale inversely with simulation speed,
  // so leaves visibly fall even at high speeds (1x = full duration, 14x = ~14× faster)
  const speedFactor = Math.max(1, transitionSpeed);
  const prevVisibleRef = useRef<number>(config.leaves);
  const [fallingLeaves, setFallingLeaves] = useState<FallingLeaf[]>([]);
  const fallingIdRef = useRef(0);

  const leaves = useMemo(() => {
    return branchPoints.map((pt, i) => ({
      cx: pt.x,
      cy: pt.y,
      size: 7 + (((i * 11 + 3) % 13) / 13) * 10,
      rotation: ((i * 37 + 15) % 360),
      key: i,
    }));
  }, []);

  const visibleCount = Math.round(leaves.length * waterTankFill);
  const leafColor =
    energyTankFill < 0.2
      ? "#9b7a42"
      : energyTankFill < 0.4
        ? "#b8a14a"
        : energyTankFill < 0.6
          ? "#7ea85a"
          : energyTankFill < 0.8
            ? "#4f9a57"
            : "#2d7a3e";

  // Detect leaves disappearing and trigger falling animation
  useEffect(() => {
    const prev = prevVisibleRef.current;
    if (visibleCount < prev) {
      const newFalling: FallingLeaf[] = [];
      for (let i = visibleCount; i < prev && i < leaves.length; i++) {
        const leaf = leaves[i];
        newFalling.push({
          id: fallingIdRef.current++,
          cx: leaf.cx,
          cy: leaf.cy,
          size: leaf.size,
          rotation: leaf.rotation,
          color: config.leafColor,
        });
      }
      setFallingLeaves((f) => [...f, ...newFalling]);
      const fallMs = (Math.max(1.2, 4 / speedFactor)) * 1000;
      setTimeout(() => {
        setFallingLeaves((f) => f.filter((fl) => !newFalling.find((n) => n.id === fl.id)));
      }, fallMs + 300);
    }
    prevVisibleRef.current = visibleCount;
  }, [visibleCount, leaves, config.leafColor, speedFactor]);


  const fallDuration = Math.max(1.2, 4 / speedFactor);

  return (
    <div className="relative flex flex-col items-center">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 rounded-3xl"
        style={{
          background: `radial-gradient(ellipse at center 60%, ${config.bgGlow}, transparent 70%)`,
          transition: `all ${durationMs}ms ease-out`,
        }}
      />

      <svg
        viewBox="0 0 440 300"
        className="w-full max-w-2xl"
        style={{ transition: `all ${durationMs}ms ease-out` }}
      >
        <defs>
          <style>{`
            @keyframes fall-sway {
              0% { transform: translate(0, 0) rotate(0deg); opacity: 0.75; }
              25% { transform: translate(8px, 30px) rotate(15deg); opacity: 0.6; }
              50% { transform: translate(-5px, 70px) rotate(-10deg); opacity: 0.45; }
              75% { transform: translate(10px, 110px) rotate(25deg); opacity: 0.25; }
              100% { transform: translate(3px, 150px) rotate(40deg); opacity: 0; }
            }
            @keyframes flow-pulse {
              0% { stroke-dashoffset: 0; opacity: 0.45; }
              100% { stroke-dashoffset: -24; opacity: 0.95; }
            }
            @keyframes energy-pulse {
              0%, 100% { opacity: 0.45; }
              50% { opacity: 0.95; }
            }
          `}</style>
          <linearGradient id="water-tank-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8fd3ff" />
            <stop offset="100%" stopColor="#2f8fd8" />
          </linearGradient>
          <linearGradient id="energy-tank-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffe58f" />
            <stop offset="100%" stopColor="#f2b705" />
          </linearGradient>
          <linearGradient id="person-energy" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={`rgba(255, 229, 143, ${personEnergy})`} />
            <stop offset="100%" stopColor={`rgba(242, 183, 5, ${personEnergy * 0.8})`} />
          </linearGradient>
          <linearGradient id="person-water" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={`rgba(143, 211, 255, ${personWater})`} />
            <stop offset="100%" stopColor={`rgba(47, 143, 216, ${personWater * 0.8})`} />
          </linearGradient>
        </defs>

        {/* Ground */}
        <ellipse cx={treeTankCenterX} cy="272" rx="88" ry="14" fill="hsl(142,20%,85%)" opacity="0.45" />
        <ellipse cx="98" cy="272" rx="60" ry="10" fill="hsl(142,18%,88%)" opacity="0.35" />

        {/* Person side */}
        <g transform={`translate(${personPanelX} ${personPanelY})`}>
          <circle cx="58" cy="48" r="18" fill="url(#person-energy)" stroke="rgba(70,70,70,0.18)" />
          <path d="M58 70 C42 70 34 84 34 102 L34 148 C34 154 38 158 44 158 L72 158 C78 158 82 154 82 148 L82 102 C82 84 74 70 58 70 Z" fill="url(#person-water)" stroke="rgba(70,70,70,0.12)" />
          <path d="M34 104 L20 144" stroke="rgba(70,70,70,0.18)" strokeWidth="8" strokeLinecap="round" />
          <path d="M82 104 L96 144" stroke="rgba(70,70,70,0.18)" strokeWidth="8" strokeLinecap="round" />
          <path d="M48 158 L40 198" stroke="rgba(70,70,70,0.18)" strokeWidth="9" strokeLinecap="round" />
          <path d="M68 158 L76 198" stroke="rgba(70,70,70,0.18)" strokeWidth="9" strokeLinecap="round" />

          <g transform="translate(8 118)">
            <rect x="0" y="0" width="28" height="78" rx="12" fill="rgba(255,255,255,0.72)" stroke="rgba(47,143,216,0.28)" />
            <rect x="4" y={74 - 70 * normalizedHumanWaterLevel} width="20" height={70 * normalizedHumanWaterLevel} rx="8" fill="url(#water-tank-fill)" style={{ transition: `all ${durationMs}ms ease-out` }} />
            <text x="14" y="94" textAnchor="middle" fontSize="9" fill="rgba(70,70,70,0.7)">Voda</text>
          </g>

          <g transform="translate(82 118)">
            <rect x="0" y="0" width="28" height="78" rx="12" fill="rgba(255,255,255,0.72)" stroke="rgba(242,183,5,0.28)" />
            <rect x="4" y={74 - 70 * normalizedHumanLightLevel} width="20" height={70 * normalizedHumanLightLevel} rx="8" fill="url(#energy-tank-fill)" style={{ transition: `all ${durationMs}ms ease-out` }} />
            <text x="14" y="94" textAnchor="middle" fontSize="8" fill="rgba(70,70,70,0.7)">Energ.</text>
          </g>
        </g>

        {/* Resource flow lines */}
        <path
          d={`M156 188 C196 182 236 182 ${treeTankCenterX} 188`}
          fill="none"
          stroke="#4aa8e8"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray="10 8"
          style={{ opacity: waterFlowOpacity, animation: "flow-pulse 1.8s linear infinite", transition: `opacity ${durationMs}ms ease-out` }}
        />
        <path
          d={`M156 154 C196 146 236 146 ${treeTankCenterX} 154`}
          fill="none"
          stroke="#f2b705"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="6 10"
          style={{ opacity: energyFlowOpacity, animation: "flow-pulse 1.2s linear infinite", transition: `opacity ${durationMs}ms ease-out` }}
        />
        <circle cx="224" cy="184" r="4" fill="#4aa8e8" style={{ opacity: waterFlowOpacity, animation: "energy-pulse 1.6s ease-in-out infinite" }} />
        <circle cx="232" cy="148" r="4" fill="#f2b705" style={{ opacity: energyFlowOpacity, animation: "energy-pulse 1.1s ease-in-out infinite" }} />

        {/* Tree-side tanks */}
        <g transform={`translate(${treePanelX} ${treePanelY})`}>
          <g transform="translate(8 118)">
            <rect x="0" y="0" width="28" height="78" rx="12" fill="rgba(255,255,255,0.72)" stroke="rgba(47,143,216,0.28)" />
            <rect x="4" y={74 - 70 * waterTankFill} width="20" height={70 * waterTankFill} rx="8" fill="url(#water-tank-fill)" style={{ transition: `all ${durationMs}ms ease-out` }} />
            <text x="14" y="94" textAnchor="middle" fontSize="9" fill="rgba(70,70,70,0.7)">Voda</text>
          </g>

          <g transform="translate(82 118)">
            <rect x="0" y="0" width="28" height="78" rx="12" fill="rgba(255,255,255,0.72)" stroke="rgba(242,183,5,0.28)" />
            <rect x="4" y={74 - 70 * energyTankFill} width="20" height={70 * energyTankFill} rx="8" fill="url(#energy-tank-fill)" style={{ transition: `all ${durationMs}ms ease-out` }} />
            <text x="14" y="94" textAnchor="middle" fontSize="8" fill="rgba(70,70,70,0.7)">Energ.</text>
          </g>
        </g>

        <g transform={`translate(${treeOffsetX} 0)`}>
          {/* Trunk - always visible */}
          <path
            d="M240 260 Q238 200 230 170 Q225 150 235 130 L245 130 Q242 150 245 170 Q248 200 250 260 Z"
            fill="#5a3a2a"
          />
          <path
            d="M250 260 Q252 200 260 170 Q265 150 255 130 L245 130 Q248 150 245 170 Q242 200 240 260 Z"
            fill="#5a3a2a"
            opacity="0.85"
          />

          {/* Branches - always visible */}
          <path d="M235 150 Q214 132 200 122" stroke="#5a3a2a" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M255 150 Q274 130 288 120" stroke="#5a3a2a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M240 170 Q220 160 206 154" stroke="#5a3a2a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M255 166 Q272 158 284 152" stroke="#5a3a2a" strokeWidth="2.5" fill="none" strokeLinecap="round" />

          {/* Leaves around branches */}
          {leaves.map((leaf) => {
            const visible = leaf.key < visibleCount;
            const shiftedCx = leaf.cx + 100;
            return (
              <g key={leaf.key}>
                <path
                  d={leafPath(shiftedCx, leaf.cy, leaf.size)}
                  fill={leafColor}
                  transform={`rotate(${leaf.rotation}, ${shiftedCx}, ${leaf.cy})`}
                  style={{
                    opacity: visible ? 0.75 : 0,
                    transition: visible ? `opacity ${durationMs}ms ease-out, fill ${durationMs}ms ease-out` : "opacity 0s",
                  }}
                />
                {visible && (
                  <line
                    x1={shiftedCx}
                    y1={leaf.cy - leaf.size * 0.6}
                    x2={shiftedCx}
                    y2={leaf.cy + leaf.size * 0.8}
                    stroke="#5a3a2a"
                    strokeWidth="0.5"
                    opacity="0.3"
                    transform={`rotate(${leaf.rotation}, ${shiftedCx}, ${leaf.cy})`}
                    style={{ transition: `opacity ${durationMs}ms ease-out` }}
                  />
                )}
              </g>
            );
          })}

          {/* Falling leaves animation */}
          {fallingLeaves.map((fl) => (
            <path
              key={fl.id}
              d={leafPath(fl.cx + 100, fl.cy, fl.size)}
              fill={leafColor}
              style={{
                transformOrigin: `${fl.cx + 100}px ${fl.cy}px`,
                animation: `fall-sway ${fallDuration}s ease-in forwards`,
                opacity: 0.75,
              }}
            />
          ))}

          {/* Dead state: fallen leaves on ground */}
          {state === "dead" && (
            <>
              <path d={leafPath(220, 255, 6)} fill="#8B4513" opacity="0.4" transform="rotate(30, 220, 255)" />
              <path d={leafPath(270, 258, 5)} fill="#a0522d" opacity="0.35" transform="rotate(-20, 270, 258)" />
              <path d={leafPath(245, 256, 4)} fill="#8B4513" opacity="0.3" transform="rotate(60, 245, 256)" />
            </>
          )}
        </g>
      </svg>

      {/* State label */}
      <div className="mt-2 text-center">
        <span
          className="font-display text-2xl"
          style={{ color: config.leafColor, transition: `color ${durationMs}ms ease-out` }}
        >
          {config.label}
        </span>
        <p className="text-sm text-muted-foreground font-body mt-1">
          Eco rezultat: {Math.round(score)}/100
        </p>
      </div>
    </div>
  );
};

export default AmbientTree;
