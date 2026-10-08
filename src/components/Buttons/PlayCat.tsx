// Small vector sprite: the front paw taps the top edge of the play button.
export function PlayCat() {
  return <span className="play-cat" aria-hidden="true">
    <svg viewBox="0 0 120 110" fill="none" focusable="false">
      <g stroke="#65414a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path className="play-cat-tail" d="M91 80c30 2 22-31 11-26-7 3 8 12-3 15" fill="#edb779" />
        <path d="M29 88c-3-23 3-39 28-40 25-1 36 17 34 40Z" fill="#edb779" />
        <path d="M43 88c-5-20 2-29 14-29s21 10 18 29" fill="#fff1da" stroke="none" />
        <path d="M24 31 22 7 43 19c10-4 24-4 35 0L99 7l-2 25c5 7 6 14 4 23-3 17-24 23-41 23S21 70 18 54c-2-9 0-17 6-23Z" fill="#f5c68b" />
        <path d="m28 17 2 16 10-9Zm64 0-3 16-10-9Z" fill="#eb9e9f" stroke="none" />
        <path d="m50 19 3 9m10-10v9m10-7-3 9" stroke="#cb8b53" strokeWidth="4" />
        <ellipse cx="40" cy="47" rx="4" ry="6" fill="#49353e" stroke="none" />
        <ellipse cx="80" cy="47" rx="4" ry="6" fill="#49353e" stroke="none" />
        <circle cx="41" cy="45" r="1.4" fill="white" stroke="none" />
        <circle cx="81" cy="45" r="1.4" fill="white" stroke="none" />
        <ellipse cx="30" cy="58" rx="7" ry="4" fill="#efa1a0" stroke="none" />
        <ellipse cx="90" cy="58" rx="7" ry="4" fill="#efa1a0" stroke="none" />
        <path d="m55 54 5 5 5-5Z" fill="#d77f88" stroke="#d77f88" />
        <path d="M60 59v3m-8 0q4 6 8 0 4 6 8 0" strokeWidth="2" />
        <path d="m18 51 13 3m-15 6 15-1m58-5 13-3m-13 8 15 1" strokeWidth="2" />
        <path d="M30 81v10q0 8 10 8t10-8v-9" fill="#fff1da" />
        <path d="M37 93v4m7-4v4" strokeWidth="2" />
        <g className="play-cat-paw">
          <path d="M74 75v16q0 9 11 9t11-9V79" fill="#fff1da" />
          <path d="M82 94v4m7-4v4" strokeWidth="2" />
        </g>
      </g>
      <g className="play-cat-tap" stroke="#fff1bd" strokeWidth="3" strokeLinecap="round">
        <path d="m102 90 5-4m-4 12h7m-10 6 5 3" />
      </g>
    </svg>
  </span>;
}
