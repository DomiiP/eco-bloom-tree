import { CheckCircle2, AlertTriangle, Droplets, Zap, TrendingUp, TrendingDown } from "lucide-react";

export type StatusKind =
  | "ok"
  | "low-water"
  | "low-light"
  | "low-both"
  | "excess-water"
  | "excess-light"
  | "excess-both";

export interface StatusInfo {
  kind: StatusKind;
  title: string;
  description: string;
}

interface Props {
  status: StatusInfo;
  recentChange?: { direction: "up" | "down"; from: string; to: string } | null;
  onDismissChange?: () => void;
}

const TreeStatusBanner = ({ status, recentChange, onDismissChange }: Props) => {
  const isProblem = status.kind !== "ok";
  const isExcess = status.kind.startsWith("excess");

  const Icon = status.kind === "ok" ? CheckCircle2 : AlertTriangle;
  const colorClasses = !isProblem
    ? "bg-primary/10 border-primary/40 text-primary"
    : isExcess
    ? "bg-destructive/10 border-destructive/40 text-destructive"
    : "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400";

  return (
    <div className="space-y-2">
      <div className={`p-3 rounded-lg border text-sm font-body ${colorClasses}`}>
        <div className="flex items-start gap-2">
          <Icon className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-0.5">
            <p className="font-medium">{status.title}</p>
            <p className="text-xs opacity-90">{status.description}</p>
          </div>
          <div className="flex gap-1">
            {(status.kind === "low-water" || status.kind === "low-both" || status.kind === "excess-water") && (
              <Droplets className="w-4 h-4 opacity-70" />
            )}
            {(status.kind === "low-light" || status.kind === "low-both" || status.kind === "excess-light") && (
              <Zap className="w-4 h-4 opacity-70" />
            )}
          </div>
        </div>
      </div>

      {recentChange && (
        <div
          className={`p-2 rounded-lg border text-xs font-body flex items-center gap-2 animate-fade-in ${
            recentChange.direction === "up"
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-muted border-border text-muted-foreground"
          }`}
        >
          {recentChange.direction === "up" ? (
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="flex-1">
            Sprememba stopnje: <strong>{recentChange.from} → {recentChange.to}</strong>
          </span>
          {onDismissChange && (
            <button onClick={onDismissChange} className="opacity-60 hover:opacity-100">×</button>
          )}
        </div>
      )}
    </div>
  );
};

export default TreeStatusBanner;
