import { useId } from "react";
import "./GameIcon.css";

export type GameIconName =
  | "infinity" | "daily" | "duel" | "album" | "settings"
  | "star" | "trophy" | "ocean" | "people" | "flags"
  | "play" | "paw" | "check";

type Paints = Record<"gold" | "cream" | "teal" | "coral" | "violet" | "blue", string>;
const ink = "#44245f";
const starPath = "M48 9 59 32 85 36 66 55 70 82 48 69 25 82 30 55 11 36 37 32Z";

function Paw({ fill = "#fff7dc" }: { fill?: string }) {
  return <g fill={fill} stroke="none">
    <ellipse cx="35" cy="36" rx="6" ry="8" transform="rotate(-22 35 36)" />
    <ellipse cx="48" cy="29" rx="6" ry="8" />
    <ellipse cx="61" cy="36" rx="6" ry="8" transform="rotate(22 61 36)" />
    <path d="M30 59c0-7 7-10 11-17 3-5 11-5 14 0 4 7 11 10 11 17 0 10-11 10-18 6-7 4-18 4-18-6Z" />
  </g>;
}

function Sparkle({ x, y, size = 5, fill = "#fff1a0" }: { x: number; y: number; size?: number; fill?: string }) {
  return <path d={`M${x} ${y - size}q0 ${size} ${size} ${size}q-${size} 0 -${size} ${size}q0 -${size} -${size} -${size}q${size} 0 ${size} -${size}Z`} fill={fill} stroke="none" />;
}

function IconDrawing({ name, paint }: { name: GameIconName; paint: Paints }) {
  switch (name) {
    case "infinity": return <>
      <ellipse cx="48" cy="78" rx="35" ry="5" fill={ink} opacity=".18" stroke="none" />
      <path d="M47 46c-12-18-18-19-25-19C11 27 6 38 6 49s5 22 16 22c10 0 17-10 27-23 10-13 16-22 26-22 11 0 15 12 15 23S85 71 74 71c-8 0-16-8-26-22" fill="none" stroke={ink} strokeWidth="17" />
      <path d="M47 43c-12-18-18-19-25-19C11 24 6 35 6 46s5 22 16 22c10 0 17-10 27-23 10-13 16-22 26-22 11 0 15 12 15 23S85 68 74 68c-8 0-16-8-26-22" fill="none" stroke={paint.gold} strokeWidth="11" />
      <path d="M10 43c0-11 6-16 12-16 7 0 14 9 20 16M53 39c8-10 15-17 22-13 6 3 10 10 10 19" fill="none" stroke="#fff6b8" strokeWidth="3" />
      <path d="m52 53 5 6" stroke="#dd840e" strokeWidth="4" />
      <Sparkle x={33} y={13} size={6} />
      <Sparkle x={73} y={83} size={4} fill="#b0fff0" />
    </>;
    case "daily": return <>
      <path d="m29 74-6 13m41-13 6 13" stroke={ink} strokeWidth="7" />
      <path d="m29 74-6 13m41-13 6 13" stroke="#ffd470" strokeWidth="3" />
      <circle cx="43" cy="48" r="35" fill="#ca4773" />
      <circle cx="43" cy="43" r="35" fill={paint.coral} />
      <circle cx="43" cy="43" r="27" fill={paint.cream} stroke="#b44269" strokeWidth="2" />
      <circle cx="43" cy="43" r="19" fill={paint.coral} stroke="#e38b8c" strokeWidth="2" />
      <circle cx="43" cy="43" r="10" fill={paint.cream} stroke="#b44269" strokeWidth="2" />
      <circle cx="43" cy="43" r="3" fill={ink} stroke="none" />
      <path d="M17 36a28 28 0 0 1 20-20" fill="none" stroke="#fff9dc" strokeWidth="3" opacity=".8" />
      <path d="m45 44 33-29" stroke={ink} strokeWidth="8" />
      <path d="m45 43 34-30" stroke="#ffec9a" strokeWidth="4" />
      <path d="m66 17 2-12 10 3 9-3 1 12-12 11-1-11Z" fill={paint.teal} strokeWidth="2.5" />
      <path d="m77 15 7-7m-15 1 1 8" stroke="#c6fff1" strokeWidth="2" />
      <Sparkle x={85} y={61} size={5} />
    </>;
    case "duel": return <>
      <path d="M5 43 8 12 27 28 45 18 51 51 42 72 20 76 6 62Z" fill={paint.coral} />
      <path d="m12 24 2 17 9-7m18-7-10 8 13 4" fill="#ffdab2" stroke="#b94a70" strokeWidth="2" />
      <path d="M8 48c12-2 14 11 20 13 7-2 9-15 20-15l-5 19-14 11-15-9Z" fill={paint.cream} stroke="none" />
      <path d="m15 47 7 2m14-1 6-3" strokeWidth="3" />
      <path d="m24 58 8-1-4 5Z" fill={ink} strokeWidth="2" />
      <path d="M28 62v4m-4 0q4 5 8 0" fill="none" strokeWidth="2" />
      <path d="m53 34 9-18 12 13 13-8 6 31c1 15-10 26-24 25-14-1-23-12-22-24Z" fill={paint.teal} />
      <path d="m62 23-5 16 12-4m16-6-8 6 11 6" fill="#c5ffec" stroke="#329e96" strokeWidth="2" />
      <path d="M52 55c7-7 15-3 18 1 4-4 10-5 17-1-3 11-12 16-19 15-9 0-14-7-16-15Z" fill={paint.cream} stroke="none" />
      <ellipse cx="60" cy="46" rx="3" ry="4" fill={ink} stroke="none" />
      <ellipse cx="79" cy="46" rx="3" ry="4" fill={ink} stroke="none" />
      <path d="m66 56 7 0-3 4Z" fill="#ae5371" strokeWidth="1.5" />
      <path d="M70 60v3m-4 0q4 4 8 0M51 57l7 1m-8 4 7-1m23-3 8-1m-7 5 8 1" fill="none" strokeWidth="1.5" />
      <path d="m47 57-12 19 12-1-3 16 18-24-13 1 5-11Z" fill={paint.gold} strokeWidth="2.5" />
      <path d="m44 72 6-9" stroke="#fff8c9" strokeWidth="2" />
    </>;
    case "album": return <>
      <path d="M11 17h55c8 0 14 6 14 14v51H24c-8 0-13-5-13-12Z" fill="#513078" />
      <path d="M18 15h62v61H23c-8 0-12 2-12 6V24c0-6 3-9 7-9Z" fill={paint.cream} />
      <path d="M22 22h51m-51 6h51m-51 6h51M22 75h54m-54 5h53" stroke="#cdaabd" strokeWidth="1.5" />
      <path d="M17 11h49a7 7 0 0 1 7 7v56H22c-7 0-11 4-11 8V19c0-4 2-8 6-8Z" fill={paint.violet} />
      <path d="M20 12v61" stroke="#eed0ff" strokeWidth="2" opacity=".75" />
      <path d="M25 17h36a6 6 0 0 1 6 6v42H25Z" fill="none" stroke="#e4b9ff" strokeWidth="1.5" opacity=".65" />
      <path d="M58 11h10v22l-5-4-5 4Z" fill={paint.coral} strokeWidth="2" />
      <circle cx="45" cy="46" r="18" fill={paint.gold} stroke="#704277" strokeWidth="2" />
      <g transform="translate(14 15) scale(.65)"><Paw fill={ink} /></g>
      <path d="M81 37h9v27h-9" fill={paint.teal} strokeWidth="2.5" />
      <path d="M83 43h4m-4 6h4" stroke="#c4ffeb" strokeWidth="2" />
      <Sparkle x={86} y={17} size={6} />
    </>;
    case "settings": return <>
      <path d="m39 7 18 0 3 12 7 4 12-4 9 15-9 9v9l9 8-9 16-12-4-7 4-3 13H39l-3-13-7-4-12 4-9-16 9-8v-9l-9-9 9-15 12 4 7-4Z" fill="#8a549c" transform="translate(0 3)" />
      <path d="m39 5 18 0 3 12 7 4 12-4 9 15-9 9v9l9 8-9 16-12-4-7 4-3 13H39l-3-13-7-4-12 4-9-16 9-8v-9l-9-9 9-15 12 4 7-4Z" fill={paint.gold} />
      <path d="m43 11 10 0 3 12 11 6 10-4 4 7M14 58l6 9 10-4m11 16h11" fill="none" stroke="#fff5c7" strokeWidth="3" />
      <circle cx="48" cy="46" r="25" fill="#ce883a" stroke="#9b5462" strokeWidth="2" />
      <circle cx="48" cy="44" r="21" fill={paint.violet} strokeWidth="3" />
      <circle cx="48" cy="44" r="12" fill={paint.teal} stroke="#e4c4ff" strokeWidth="2" />
      <path d="M41 43a8 8 0 0 1 8-7" fill="none" stroke="#c8fff0" strokeWidth="3" />
      <circle cx="48" cy="16" r="2" fill={ink} stroke="none" opacity=".45" />
      <circle cx="23" cy="60" r="2" fill={ink} stroke="none" opacity=".45" />
      <circle cx="74" cy="60" r="2" fill={ink} stroke="none" opacity=".45" />
    </>;
    case "star": return <>
      <path d={starPath} fill="#ce772d" transform="translate(0 4)" />
      <path d={starPath} fill={paint.gold} />
      <path d="m48 18 8 20 21 3-29 10Z" fill="#fff6ad" stroke="none" />
      <path d="m48 51 15 25-15-10-17 10Z" fill="#e28c21" stroke="none" />
      <path d="m48 18 0 33-29-10 21-3Z" fill="#ffe374" stroke="none" />
      <path d="m48 51 29-10-15 14 1 21Z" fill="#ffc84b" stroke="none" />
      <path d="m32 35 7-1 5-10" fill="none" stroke="#fffbe0" strokeWidth="3" />
    </>;
    case "trophy": return <>
      <path d="M28 20H10v14c0 14 8 20 22 20m36-34h18v14c0 14-8 20-22 20" fill="none" stroke={ink} strokeWidth="11" />
      <path d="M28 20H10v14c0 14 8 20 22 20m36-34h18v14c0 14-8 20-22 20" fill="none" stroke={paint.gold} strokeWidth="6" />
      <path d="M41 52h14v19l10 8H31l10-8Z" fill={paint.gold} />
      <path d="M24 10h48l-4 26c-2 16-11 23-20 23s-18-7-20-23Z" fill={paint.gold} />
      <path d="M31 16h34m-31 7 2 14c1 5 3 9 6 11" fill="none" stroke="#fff7bc" strokeWidth="4" />
      <path d="m48 22 4 7 8 1-6 6 1 8-7-4-7 4 1-8-6-6 8-1Z" fill="#d68425" stroke="#9f5960" strokeWidth="1.5" />
      <path d="M31 73h34l4 14H27Z" fill={paint.violet} />
      <path d="M35 78h26v5H35Z" fill={paint.cream} stroke="none" />
      <Sparkle x={82} y={8} size={6} />
    </>;
    case "ocean": return <>
      <path d="M8 72c9-8 17 8 27 0s18 8 27 0 17 8 27 0v12H8Z" fill={paint.blue} stroke="none" opacity=".55" />
      <path d="M8 47c0-18 13-29 31-29 18 0 30 10 32 28 9-1 10-5 10-9-7-1-10-5-10-11 7 0 12 2 14 7 2-5 5-8 9-8 2 15-3 26-20 34C62 78 27 80 13 65 10 60 8 54 8 47Z" fill={paint.blue} />
      <path d="M12 55c7 9 32 12 55-1-6 14-28 20-43 12-5-2-9-6-12-11Z" fill={paint.cream} stroke="none" />
      <path d="M21 33c6-7 15-9 24-7" fill="none" stroke="#c6f6ff" strokeWidth="3" />
      <path d="M42 54c2 0 9-2 11-5 3 6-1 15-7 17-4-3-6-9-4-12Z" fill={paint.teal} strokeWidth="2" />
      <ellipse cx="25" cy="46" rx="3" ry="4" fill={ink} stroke="none" />
      <circle cx="26" cy="45" r="1" fill="#fff" stroke="none" />
      <path d="M19 55q7 4 13-1M41 18V8m0 4c-5-7-10-5-10-2m10 2c5-7 10-5 10-2" fill="none" strokeWidth="2.5" />
      <circle cx="65" cy="12" r="4" fill="#c5f6ff" stroke="#748dcc" strokeWidth="1.5" />
      <circle cx="73" cy="5" r="2" fill="#c5f6ff" stroke="none" />
      <path d="M6 80c10-9 17 9 28 0s17 9 28 0 17 9 28 0" fill="none" stroke="#91eee4" strokeWidth="4" />
    </>;
    case "people": return <>
      <path d="M49 79V63c0-11 8-18 20-18s20 7 20 18v16Z" fill={paint.teal} />
      <path d="M55 47V29c0-13 7-19 16-19 11 0 18 8 18 21v18Z" fill="#54344f" />
      <path d="M63 44v10q7 7 14 0V43Z" fill="#ba785b" strokeWidth="2" />
      <path d="M59 28c8 0 14-2 19-7l6 9v6c0 10-5 15-12 15s-13-6-13-15Z" fill="#dda581" strokeWidth="2" />
      <path d="M61 22c4-7 12-8 18-2" fill="none" stroke="#97616a" strokeWidth="2.5" />
      <path d="m64 34 3 0m10 0h2m-11 8q4 3 7 0" fill="none" strokeWidth="2" />
      <path d="M9 85V64c0-13 11-19 25-19s26 6 26 19v21Z" fill={paint.coral} />
      <path d="M27 44v12q8 8 16 0V44Z" fill="#efb897" strokeWidth="2" />
      <path d="M17 29c-2-12 4-21 18-21s22 10 19 24l-5 7H21Z" fill="#975735" />
      <path d="M23 26c6 2 16-1 20-7l6 10v8c0 11-6 18-14 18s-15-7-15-18v-6Z" fill={paint.cream} strokeWidth="2" />
      <path d="M25 17c7-5 14-4 18-1" fill="none" stroke="#df995b" strokeWidth="3" />
      <ellipse cx="28" cy="34" rx="2" ry="3" fill={ink} stroke="none" />
      <ellipse cx="43" cy="34" rx="2" ry="3" fill={ink} stroke="none" />
      <path d="M30 44q6 5 11-1" fill="none" strokeWidth="2" />
      <path d="M23 62q11 10 22 0m-29 9v9m36-9v9" fill="none" stroke="#ffc4b5" strokeWidth="2" />
      <Sparkle x={9} y={43} size={5} fill="#f7cd66" />
    </>;
    case "flags": return <>
      <path d="m16 86 11-66m40 66-10-71" fill="none" strokeWidth="7" />
      <path d="m16 86 11-66m40 66-10-71" fill="none" stroke="#ffe399" strokeWidth="3" />
      <path d="M28 17c12-8 23 10 35 0l-5 30c-12 8-21-9-35-1Z" fill={paint.coral} strokeWidth="2.5" />
      <path d="M26 29c13-7 23 9 35-1l-2 9c-13 8-23-7-35 0Z" fill="#fff1c5" stroke="none" />
      <path d="M55 12c14-7 22 11 36 4l3 28c-14 9-22-10-36-3Z" fill={paint.teal} strokeWidth="2.5" />
      <path d="M68 17c5 2 9 5 14 5l2 15c-5 0-9-4-15-5Z" fill="#fff2ae" stroke="none" />
      <path d="m43 90 1-43" strokeWidth="7" />
      <path d="m43 90 1-43" stroke="#ffe399" strokeWidth="3" />
      <path d="M46 44c13-9 24 11 37 1v26c-13 10-24-10-37-1Z" fill={paint.violet} strokeWidth="2.5" />
      <path d="m62 48 3 7 7 2-5 4 1 7-6-4-6 2 2-6-4-6 7 1Z" fill="#ffe59b" stroke="none" />
      <path d="M49 49c4-1 7 0 10 1M61 17l2 19" fill="none" stroke="#fff3d2" strokeWidth="2" opacity=".65" />
      <circle cx="27" cy="15" r="4" fill={paint.gold} strokeWidth="2" />
      <circle cx="57" cy="9" r="4" fill={paint.gold} strokeWidth="2" />
      <circle cx="44" cy="43" r="4" fill={paint.gold} strokeWidth="2" />
    </>;
    case "play": return <>
      <path d="M24 15q0-8 7-4l50 33q7 5 0 10L31 86q-7 4-7-4Z" fill="#a86a49" />
      <path d="M22 12q0-8 7-4l50 33q7 5 0 10L29 83q-7 4-7-4Z" fill={paint.cream} />
      <path d="M29 16v59l45-29Z" fill={paint.gold} stroke="#cd9642" strokeWidth="2" />
      <path d="m29 16 1 11 36 20 8-1Z" fill="#fff5be" stroke="none" />
      <path d="m35 34 16 10" stroke="#fffbe0" strokeWidth="3" />
    </>;
    case "paw": return <>
      <circle cx="48" cy="48" r="40" fill={paint.violet} />
      <circle cx="48" cy="48" r="33" fill="none" stroke="#dcb5ff" strokeWidth="2" />
      <g transform="translate(0 5)"><Paw fill="#8753ad" /></g>
      <Paw fill={paint.gold} />
      <Sparkle x={71} y={22} size={4} />
    </>;
    case "check": return <>
      <path d="m20 49 18 19 40-43" fill="none" stroke="#b16e21" strokeWidth="16" transform="translate(0 3)" />
      <path d="m20 47 18 19 40-43" fill="none" stroke={ink} strokeWidth="13" />
      <path d="m20 47 18 19 40-43" fill="none" stroke="#fff2b0" strokeWidth="7" />
    </>;
  }
}

/** Hand-drawn menu artwork. Labels belong to the surrounding button or card. */
export function GameIcon({ name, className = "" }: { name: GameIconName; className?: string }) {
  const id = `game-icon-${useId().replace(/:/g, "")}`;
  const paint: Paints = {
    gold: `url(#${id}-gold)`, cream: `url(#${id}-cream)`, teal: `url(#${id}-teal)`,
    coral: `url(#${id}-coral)`, violet: `url(#${id}-violet)`, blue: `url(#${id}-blue)`,
  };

  return (
    <svg className={`game-icon ${className}`.trim()} viewBox="0 0 96 96" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2=".3" y2="1"><stop stopColor="#fff0a3" /><stop offset=".48" stopColor="#ffce53" /><stop offset="1" stopColor="#f39b2e" /></linearGradient>
        <linearGradient id={`${id}-cream`} x1="0" y1="0" x2=".2" y2="1"><stop stopColor="#fffcef" /><stop offset="1" stopColor="#ffe1af" /></linearGradient>
        <linearGradient id={`${id}-teal`} x1="0" y1="0" x2=".2" y2="1"><stop stopColor="#aaf8dc" /><stop offset=".5" stopColor="#5ed6c1" /><stop offset="1" stopColor="#2aa4ad" /></linearGradient>
        <linearGradient id={`${id}-coral`} x1="0" y1="0" x2=".3" y2="1"><stop stopColor="#ffb69a" /><stop offset=".55" stopColor="#ff867e" /><stop offset="1" stopColor="#de5c81" /></linearGradient>
        <linearGradient id={`${id}-violet`} x1="0" y1="0" x2=".3" y2="1"><stop stopColor="#cc9cf2" /><stop offset=".55" stopColor="#a270cf" /><stop offset="1" stopColor="#744aab" /></linearGradient>
        <linearGradient id={`${id}-blue`} x1="0" y1="0" x2=".3" y2="1"><stop stopColor="#a7eafa" /><stop offset=".55" stopColor="#78c2ec" /><stop offset="1" stopColor="#658ed0" /></linearGradient>
      </defs>
      <IconDrawing name={name} paint={paint} />
    </svg>
  );
}
