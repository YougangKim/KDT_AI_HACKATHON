import type { SVGProps } from "react";

export function LogoSymbol({
  className,
  title = "My News",
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label={title}
      {...props}
    >
      <path
        d="M5.5 6.5h14a6 6 0 0 1 6 6v5a6 6 0 0 1-6 6h-6.2L8 27v-4.7a5.9 5.9 0 0 1-2.5-4.8v-11Z"
        fill="currentColor"
      />
      <path
        d="M11 15.2a5 5 0 0 1 7.7-4.2M12.8 17.5a2.5 2.5 0 0 1 3.7-2.2"
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle cx="15.7" cy="18.9" r="1.6" fill="#5eead4" />
      <circle cx="25.5" cy="7" r="4" fill="#5eead4" stroke="white" strokeWidth="2" />
    </svg>
  );
}

export function Logo({
  className = "",
  symbolClassName = "h-8 w-8",
  subtitle = true,
}: {
  className?: string;
  symbolClassName?: string;
  subtitle?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoSymbol className={`shrink-0 text-indigo-600 ${symbolClassName}`} />
      <span className="text-left leading-none">
        <span className="block text-xl font-extrabold tracking-[-0.04em] text-slate-900">
          My News
        </span>
        {subtitle && (
          <span className="mt-1 block text-xs font-semibold tracking-[-0.01em] text-slate-500">
            나만의 소식통
          </span>
        )}
      </span>
    </span>
  );
}
