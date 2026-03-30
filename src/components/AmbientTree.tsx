import { useMemo, useRef, useEffect, useState } from "react";

type TreeState = "dead" | "weak" | "healthy" | "thriving";

interface AmbientTreeProps {
  state: TreeState;
  score: number;
  transitionSpeed: number;
}

const stateConfig = {
  dead: { leaves: 0, trunkColor: "#5a3a2a", leafColor: "#8B4513", bgGlow: "rgba(139,69,19,0.08)", label: "Mrtvo" },
  weak: { leaves: 8, trunkColor: "#5a3a2a", leafColor: "#c9a84c", bgGlow: "rgba(201,168,76,0.1)", label: "Šibko" },
  healthy: { leaves: 18, trunkColor: "#5a3a2a", leafColor: "#4a9e5c", bgGlow: "rgba(74,158,92,0.12)", label: "Zdravo" },
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

const AmbientTree = ({ state, score, transitionSpeed }: AmbientTreeProps) => {
  const config = stateConfig[state];
  const baseDuration = Math.max(0.5, 6 - (transitionSpeed - 1) * 1.375);
  const durationMs = baseDuration * 1000;
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

  const visibleCount = config.leaves;

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
      // Remove after animation
      setTimeout(() => {
        setFallingLeaves((f) => f.filter((fl) => !newFalling.find((n) => n.id === fl.id)));
      }, durationMs + 500);
    }
    prevVisibleRef.current = visibleCount;
  }, [visibleCount, leaves, config.leafColor, durationMs]);

  const fallDuration = Math.max(1, baseDuration * 1.5);

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
        viewBox="0 0 300 280"
        className="w-full max-w-md"
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
          `}</style>
        </defs>

        {/* Ground */}
        <ellipse cx="150" cy="260" rx="100" ry="12" fill="hsl(142,20%,85%)" opacity="0.5" />

        {/* Trunk - always visible */}
        <path
          d="M140 260 Q138 200 130 170 Q125 150 135 130 L145 130 Q142 150 145 170 Q148 200 150 260 Z"
          fill="#5a3a2a"
        />
        <path
          d="M150 260 Q152 200 160 170 Q165 150 155 130 L145 130 Q148 150 145 170 Q142 200 140 260 Z"
          fill="#5a3a2a"
          opacity="0.85"
        />

        {/* Branches - always visible */}
        <path d="M135 150 Q110 130 95 120" stroke="#5a3a2a" strokeWidth="4" fill="none" />
        <path d="M155 150 Q180 125 195 115" stroke="#5a3a2a" strokeWidth="3.5" fill="none" />
        <path d="M140 170 Q115 160 100 155" stroke="#5a3a2a" strokeWidth="3" fill="none" />
        <path d="M155 165 Q175 155 190 150" stroke="#5a3a2a" strokeWidth="2.5" fill="none" />

        {/* Leaves around branches */}
        {leaves.map((leaf) => {
          const visible = leaf.key < visibleCount;
          return (
            <g key={leaf.key}>
              <path
                d={leafPath(leaf.cx, leaf.cy, leaf.size)}
                fill={config.leafColor}
                transform={`rotate(${leaf.rotation}, ${leaf.cx}, ${leaf.cy})`}
                style={{
                  opacity: visible ? 0.75 : 0,
                  transition: `opacity ${durationMs}ms ease-out, fill ${durationMs}ms ease-out`,
                }}
              />
              {visible && (
                <line
                  x1={leaf.cx}
                  y1={leaf.cy - leaf.size * 0.6}
                  x2={leaf.cx}
                  y2={leaf.cy + leaf.size * 0.8}
                  stroke="#5a3a2a"
                  strokeWidth="0.5"
                  opacity="0.3"
                  transform={`rotate(${leaf.rotation}, ${leaf.cx}, ${leaf.cy})`}
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
            d={leafPath(fl.cx, fl.cy, fl.size)}
            fill={fl.color}
            style={{
              transformOrigin: `${fl.cx}px ${fl.cy}px`,
              animation: `fall-sway ${fallDuration}s ease-in forwards`,
              opacity: 0.75,
            }}
          />
        ))}

        {/* Dead state: fallen leaves on ground */}
        {state === "dead" && (
          <>
            <path d={leafPath(120, 255, 6)} fill="#8B4513" opacity="0.4" transform="rotate(30, 120, 255)" />
            <path d={leafPath(170, 258, 5)} fill="#a0522d" opacity="0.35" transform="rotate(-20, 170, 258)" />
            <path d={leafPath(145, 256, 4)} fill="#8B4513" opacity="0.3" transform="rotate(60, 145, 256)" />
          </>
        )}
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
