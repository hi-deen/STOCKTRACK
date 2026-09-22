interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  className?: string;
}

// A softly pulsing block that stands in for content while it loads.
export function Skeleton({ width = '100%', height = 14, radius = 8, className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} style={{ width, height, borderRadius: radius }} />;
}

// Placeholder for a list of avatar + two-line rows.
export function SkeletonRows({ count = 6, avatar = true }: { count?: number; avatar?: boolean }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-4">
          {avatar ? <Skeleton width={44} height={44} radius={22} className="shrink-0" /> : null}
          <div className="flex-1 space-y-2">
            <Skeleton width="55%" height={14} />
            <Skeleton width="35%" height={12} />
          </div>
          <Skeleton width={56} height={14} />
        </div>
      ))}
    </div>
  );
}
