import { Slider } from "@/components/ui/slider";
import { LucideIcon } from "lucide-react";

interface ConsumptionSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  icon: LucideIcon;
  onChange: (value: number) => void;
  color: string;
}

const ConsumptionSlider = ({ label, value, min, max, step, unit, icon: Icon, onChange, color }: ConsumptionSliderProps) => {
  return (
    <div className="space-y-3 p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" style={{ color }} />
          <span className="font-body font-medium text-foreground text-sm">{label}</span>
        </div>
        <span className="font-body font-semibold text-foreground tabular-nums">
          {value} {unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        className="cursor-pointer"
      />
      <div className="flex justify-between text-xs text-muted-foreground font-body">
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  );
};

export default ConsumptionSlider;
