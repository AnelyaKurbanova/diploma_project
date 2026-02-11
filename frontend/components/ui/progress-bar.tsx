type ProgressBarProps = {
  value: number;
  color?: string;
  size?: "sm" | "md";
};

const SIZE_MAP = {
  sm: "h-1.5",
  md: "h-2.5",
};

export function ProgressBar({
  value,
  color = "bg-blue-600",
  size = "md",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={`w-full overflow-hidden rounded-full bg-gray-100 ${SIZE_MAP[size]}`}>
      <div
        className={`${SIZE_MAP[size]} rounded-full ${color} transition-all duration-500`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
