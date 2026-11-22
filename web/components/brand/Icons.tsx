import type { SVGProps } from "react";

export type IconName =
  | "housing"
  | "job"
  | "parttime"
  | "benefit"
  | "training"
  | "exam"
  | "bell"
  | "settings"
  | "analysis"
  | "edit"
  | "pin"
  | "search"
  | "lock"
  | "warning"
  | "target"
  | "smile"
  | "phone";

const paths: Record<IconName, string[]> = {
  housing: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5", "M9 21v-7h6v7"],
  job: ["M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M3 7h18v13H3z", "M3 12h18", "M10 12v2h4v-2"],
  parttime: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  benefit: ["M4 7h16v13H4z", "M4 11h16", "M8 7c-2.5 0-3.5-3-1-3 2 0 5 3 5 3", "M16 7c2.5 0 3.5-3 1-3-2 0-5 3-5 3", "M12 7v13"],
  training: ["M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23Z", "M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23Z"],
  exam: ["M6 3h9l3 3v15H6z", "M15 3v4h4", "m9 13 2 2 4-5", "M9 9h3", "M9 18h6"],
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.05 1.57V20.5h-5.38v-.27a1.7 1.7 0 0 0-1.05-1.57A1.7 1.7 0 0 0 6.38 19l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.57-1.05H2.5V10.5h.53A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88L4.2 7.06l2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 9.31 3.77V3.5h5.38v.27a1.7 1.7 0 0 0 1.05 1.57 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.57 1.05h.53v3.45h-.53A1.7 1.7 0 0 0 19.4 15Z"],
  analysis: ["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2"],
  edit: ["M4 20h4L19 9l-4-4L4 16z", "m13.5 6.5 4 4"],
  pin: ["M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z", "M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.35-4.35"],
  lock: ["M6 10h12v11H6z", "M8 10V7a4 4 0 0 1 8 0v3"],
  warning: ["M12 3 2 21h20Z", "M12 9v5", "M12 18h.01"],
  target: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z", "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"],
  smile: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M8 10h.01", "M16 10h.01", "M8 14s1.5 3 4 3 4-3 4-3"],
  phone: ["M7 2h10v20H7z", "M10 18h4"],
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.875"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

export function iconSvg(name: IconName): string {
  const content = paths[name].map((d) => `<path d="${d}"/>`).join("");
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.875" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
}
