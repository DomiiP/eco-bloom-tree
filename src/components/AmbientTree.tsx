import { useMemo } from "react";

type TreeState = "dead" | "weak" | "healthy" | "thriving";

interface AmbientTreeProps {
  state: TreeState;
  score: number; // 0-100
}

const stateConfig = {
  dead: { leaves: 0, trunkColor: "#5a3a2a", leafColor: "#8B4513", bgGlow: "rgba(139,69,19,0.08)", label: "Mrtvo" },
  weak: { leaves: 8, trunkColor: "#6b4c3b", leafColor: "#c9a84c", bgGlow: "rgba(201,168,76,0.1)", label: "Šibko" },
  healthy: { leaves: 18, trunkColor: "#5a3a2a", leafColor: "#4a9e5c", bgGlow: "rgba(74,158,92,0.12)", label: "Zdravo" },
  thriving: { leaves: 28, trunkColor: "#4a3020", leafColor: "#2d7a3e", bgGlow: "rgba(45,122,62,0.15)", label: "Cvetoče" },
};

const AmbientTree = ({ state, score }: AmbientTreeProps) => {
  const config = stateConfig[state];
  
  const leaves = useMemo(() => {
    const result = [];
    for (let i = 0; i < config.leaves; i++) {
      const angle = (i / config.leaves) * Math.PI * 2;
      const radius = 30 + Math.random() * 50;
      const cx = 150 + Math.cos(angle) * radius;
      const cy = 100 + Math.sin(angle) * radius * 0.7;
      const size = 8 + Math.random() * 12;
      const delay = i * 0.08;
      result.push({ cx, cy, size, delay, key: i });
    }
    return result;
  }, [config.leaves]);

  return (
    <div className="relative flex flex-col items-center">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 rounded-3xl transition-all duration-[3000ms]"
        style={{ background: `radial-gradient(ellipse at center 60%, ${config.bgGlow}, transparent 70%)` }}
      />
      
      <svg
        viewBox="0 0 300 280"
        className="w-full max-w-md transition-all duration-[2000ms]"
        style={{ animation: state !== "dead" ? "gentle-sway 6s ease-in-out infinite" : "none" }}
      >
        {/* Ground */}
        <ellipse cx="150" cy="260" rx="100" ry="12" fill="hsl(142,20%,85%)" opacity="0.5" />
        
        {/* Trunk */}
        <path
          d="M140 260 Q138 200 130 170 Q125 150 135 130 L145 130 Q142 150 145 170 Q148 200 150 260 Z"
          fill={config.trunkColor}
          className="transition-all duration-[2000ms]"
        />
        <path
          d="M150 260 Q152 200 160 170 Q165 150 155 130 L145 130 Q148 150 145 170 Q142 200 140 260 Z"
          fill={config.trunkColor}
          opacity="0.85"
          className="transition-all duration-[2000ms]"
        />
        
        {/* Branches */}
        {state !== "dead" && (
          <>
            <path d="M135 150 Q110 130 95 120" stroke={config.trunkColor} strokeWidth="4" fill="none" className="transition-all duration-[2000ms]" />
            <path d="M155 150 Q180 125 195 115" stroke={config.trunkColor} strokeWidth="3.5" fill="none" className="transition-all duration-[2000ms]" />
            <path d="M140 170 Q115 160 100 155" stroke={config.trunkColor} strokeWidth="3" fill="none" className="transition-all duration-[2000ms]" />
            <path d="M155 165 Q175 155 190 150" stroke={config.trunkColor} strokeWidth="2.5" fill="none" className="transition-all duration-[2000ms]" />
          </>
        )}
        
        {/* Crown / Leaves */}
        {leaves.map((leaf) => (
          <circle
            key={leaf.key}
            cx={leaf.cx}
            cy={leaf.cy}
            r={leaf.size}
            fill={config.leafColor}
            opacity={0.7 + Math.random() * 0.3}
            className="transition-all duration-[2000ms]"
            style={{
              animation: `leaf-grow 1.5s ease-out ${leaf.delay}s both`,
            }}
          />
        ))}
        
        {/* Dead state: fallen leaves */}
        {state === "dead" && (
          <>
            <circle cx="120" cy="255" r="5" fill="#8B4513" opacity="0.4" />
            <circle cx="170" cy="258" r="4" fill="#a0522d" opacity="0.35" />
            <circle cx="145" cy="256" r="3.5" fill="#8B4513" opacity="0.3" />
          </>
        )}
      </svg>
      
      {/* State label */}
      <div className="mt-2 text-center">
        <span
          className="font-display text-2xl transition-all duration-[2000ms]"
          style={{ color: config.leafColor }}
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
