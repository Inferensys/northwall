import { cn } from "@/lib/utils";

/** The Northwall mark: shield perimeter, system graph, and risk signal. */
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
    >
      <path
        d="M16 3.5 25 7v7.3c0 5.8-3.6 10.8-9 14.2-5.4-3.4-9-8.4-9-14.2V7l9-3.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M11 18.5 16 13l5 5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12h8M16 13v8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="11" cy="18.5" r="1.8" fill="currentColor" />
      <circle cx="16" cy="13" r="1.8" fill="currentColor" />
      <circle cx="21" cy="18.5" r="1.8" fill="currentColor" />
    </svg>
  );
}
