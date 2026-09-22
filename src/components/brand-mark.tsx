interface BrandMarkProps {
  size?: number;
  showName?: boolean;
}

// The launcher-icon "D" on navy, for sign-in and onboarding screens.
export function BrandMark({ size = 72, showName = true }: BrandMarkProps) {
  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <div
        className="flex items-center justify-center bg-header font-bold text-on-header"
        style={{ width: size, height: size, borderRadius: size * 0.24, fontSize: size * 0.56 }}>
        D
      </div>
      {showName ? <p className="text-[22px] font-bold tracking-wide text-fg">Distro</p> : null}
    </div>
  );
}
