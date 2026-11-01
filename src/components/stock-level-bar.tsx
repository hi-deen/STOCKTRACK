interface StockLevelBarProps {
  quantity: number;
  reorderLevel: number | null;
  low: boolean;
  className?: string;
}

// Full at twice the reorder level, so the reorder level sits at the midpoint.
export function StockLevelBar({ quantity, reorderLevel, low, className = 'w-16' }: StockLevelBarProps) {
  if (reorderLevel === null || reorderLevel <= 0) return null;

  const filled = Math.max(0, Math.min(1, quantity / (reorderLevel * 2)));

  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-line ${className}`}>
      <div className={`h-full ${low ? 'bg-warning' : 'bg-success'}`} style={{ width: `${filled * 100}%` }} />
    </div>
  );
}
