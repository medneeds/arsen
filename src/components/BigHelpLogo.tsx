import { cn } from "@/lib/utils";

interface BigHelpLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
  /** Glow effect behind the icon */
  glow?: boolean;
}

const sizes = {
  xs: { icon: 24, pin: 28, text: "text-sm" },
  sm: { icon: 40, pin: 48, text: "text-lg" },
  md: { icon: 64, pin: 76, text: "text-2xl" },
  lg: { icon: 96, pin: 112, text: "text-4xl" },
  xl: { icon: 120, pin: 140, text: "text-5xl" },
};

export function BigHelpLogo({ size = "md", showText = false, className, glow = false }: BigHelpLogoProps) {
  const s = sizes[size];
  const viewW = s.pin;
  const viewH = s.pin + Math.round(s.pin * 0.17);

  // Scale factor relative to 120x140 base
  const scale = s.pin / 120;

  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)}>
      <div className="relative">
        {glow && (
          <div
            className="absolute inset-0 rounded-full blur-[40px] bg-[#2dd4bf]/[0.15]"
            style={{ margin: `-${Math.round(s.icon * 0.3)}px` }}
          />
        )}
        <svg
          width={viewW}
          height={viewH}
          viewBox={`0 0 120 140`}
          fill="none"
          className="relative z-10"
          style={{ width: viewW, height: viewH }}
        >
          <defs>
            <linearGradient id={`crossGrad-${size}`} x1="20" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34d9c3" />
              <stop offset="50%" stopColor="#2bb5a6" />
              <stop offset="100%" stopColor="#0e7490" />
            </linearGradient>
            <linearGradient id={`crossHL-${size}`} x1="30" y1="0" x2="90" y2="80" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#5eead4" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
            </linearGradient>
            <radialGradient id={`starGlow-${size}`} cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="50%" stopColor="white" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#c4f0eb" stopOpacity="0.7" />
            </radialGradient>
            <filter id={`glow-${size}`}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={`star3d-${size}`}>
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="shadow" />
              <feOffset dx="0" dy="2" in="shadow" result="offsetShadow" />
              <feFlood floodColor="#0e7490" floodOpacity="0.3" />
              <feComposite in2="offsetShadow" operator="in" result="colorShadow" />
              <feMerge>
                <feMergeNode in="colorShadow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Cross body */}
          <path
            d="M45 8C45 4 49 0 53 0H67C71 0 75 4 75 8V35H102C106 35 110 39 110 43V57C110 61 106 65 102 65H75V92C75 96 71 100 67 100H60L60 100L53 100C49 100 45 96 45 92V65H18C14 65 10 61 10 57V43C10 39 14 35 18 35H45V8Z"
            fill={`url(#crossGrad-${size})`}
            filter={`url(#glow-${size})`}
          />
          {/* Highlight */}
          <path
            d="M45 8C45 4 49 0 53 0H67C71 0 75 4 75 8V35H102C106 35 110 39 110 43V57C110 61 106 65 102 65H75V92C75 96 71 100 67 100H53C49 100 45 96 45 92V65H18C14 65 10 61 10 57V43C10 39 14 35 18 35H45V8Z"
            fill={`url(#crossHL-${size})`}
          />
          {/* Pin point */}
          <path
            d="M50 98L60 130L70 98"
            fill={`url(#crossGrad-${size})`}
            filter={`url(#glow-${size})`}
          />
          {/* AI Gemini star */}
          <g transform="translate(60, 50)">
            <path
              d="M0 -20 C4 -8, 8 -4, 20 0 C8 4, 4 8, 0 20 C-4 8, -8 4, -20 0 C-8 -4, -4 -8, 0 -20Z"
              fill={`url(#starGlow-${size})`}
              filter={`url(#star3d-${size})`}
            />
            <path
              d="M0 -14 C2.5 -6, 5 -3, 12 0 C5 1.5, 2 3, 0 8 C-1 3, -2 1.5, -6 0 C-2 -2, -1 -5, 0 -14Z"
              fill="white"
              fillOpacity="0.35"
            />
          </g>
        </svg>
      </div>
      {showText && (
        <div className={cn(s.text, "text-white tracking-tight leading-none")}>
          <span className="font-extrabold">BigHelp</span>
          <span className="font-extralight opacity-70 ml-0.5">Map</span>
        </div>
      )}
    </div>
  );
}
