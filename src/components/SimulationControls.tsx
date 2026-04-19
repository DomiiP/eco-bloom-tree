import { Play, Pause, RotateCcw, FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SimulationControlsProps {
  isPlaying: boolean;
  speed: number;
  onPlayPause: () => void;
  onReset: () => void;
  onSpeedChange: (s: number) => void;
}

const speeds = [1, 3, 7, 14];

const SimulationControls = ({ isPlaying, speed, onPlayPause, onReset, onSpeedChange }: SimulationControlsProps) => {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border">
      <Button size="sm" variant="default" onClick={onPlayPause}>
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        {isPlaying ? "Pavza" : "Predvajaj"}
      </Button>
      <Button size="sm" variant="outline" onClick={onReset}>
        <RotateCcw className="w-4 h-4" />
        Ponastavi
      </Button>
      <div className="ml-auto flex items-center gap-1">
        <FastForward className="w-4 h-4 text-muted-foreground" />
        {speeds.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={speed === s ? "default" : "ghost"}
            onClick={() => onSpeedChange(s)}
            className="h-8 px-2 text-xs"
          >
            {s}×
          </Button>
        ))}
      </div>
    </div>
  );
};

export default SimulationControls;
