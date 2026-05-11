import { cn } from "@/lib/utils";

export function NorthwallLogo({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <span
      className={cn(
        "brand-wordmark select-none whitespace-nowrap",
        inverted ? "text-white" : "text-[#051914]",
        className,
      )}
    >
      Northwall
    </span>
  );
}

/** Compact mark used where the full wordmark will not fit. */
export function NorthwallMark({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="6" fill="currentColor" />
      <path d="M8 23V9h3.2l9.6 13.8V9H24v14h-3.2L11.2 9.2V23H8Z" fill="white" />
    </svg>
  );
}
