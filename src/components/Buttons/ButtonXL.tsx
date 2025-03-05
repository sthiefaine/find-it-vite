/* eslint-disable @typescript-eslint/no-explicit-any */
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import "./ButtonXL.css";

const CoinIcon = ({ size = 24 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="coin-svg"
    >
      <circle cx="12" cy="12.5" r="10" fill="rgba(0,0,0,0.2)" />
      <circle cx="12" cy="12" r="10" fill="url(#coinEdgeGradient)" />
      <circle cx="12" cy="12" r="9" fill="url(#coinSideGradient)" stroke="#FFC700" strokeWidth="0.2" />
      <circle cx="12" cy="12" r="7.5" fill="url(#coinFaceGradient)" />
      <path
        d="M12 4.5C8.5 4.5 6 6 6 6C6 6 8.5 5 12 5C15.5 5 18 6 18 6C18 6 15.5 4.5 12 4.5Z"
        fill="rgba(255, 255, 255, 0.6)"
      />
      <circle cx="9" cy="9" r="1.5" fill="rgba(255, 255, 255, 0.4)" />
      <defs>
        <linearGradient
          id="coinEdgeGradient"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#D4AF37" />
          <stop offset="1" stopColor="#AA8C2C" />
        </linearGradient>
        <linearGradient
          id="coinSideGradient"
          x1="3"
          y1="3"
          x2="21"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFD700" />
          <stop offset="0.2" stopColor="#FFC123" />
          <stop offset="0.5" stopColor="#FFA500" />
          <stop offset="0.8" stopColor="#FFC123" />
          <stop offset="1" stopColor="#FFD700" />
        </linearGradient>
        <linearGradient
          id="coinFaceGradient"
          x1="4.5"
          y1="4.5"
          x2="19.5"
          y2="19.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFEA80" />
          <stop offset="0.5" stopColor="#FFD700" />
          <stop offset="1" stopColor="#FFA500" />
        </linearGradient>
      </defs>
    </svg>
  );
};

const BlingStarIcon = ({ size = 20 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="bling-star-svg"
    >
      <path
        d="M12 2L14.2 8.2L21 9.2L16.5 14L17.6 21L12 17.8L6.4 21L7.5 14L3 9.2L9.8 8.2L12 2Z"
        fill="url(#starGradient)"
      />
      <defs>
        <linearGradient
          id="starGradient"
          x1="3"
          y1="2"
          x2="21"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFFA0" />
          <stop offset="1" stopColor="#FFD700" />
        </linearGradient>
      </defs>
    </svg>
  );
};

type Spark = {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  type: "star" | "coin";
};

export type ButtonXLProps = {
  text: string;
  link?: string;
  variant?: "normal" | "bling";
  disabled?: boolean;
  children?: React.ReactNode;
};

export const ButtonXL = ({
  text,
  link = "",
  variant = "normal",
  children,
  disabled = false
}: ButtonXLProps) => {
  const navigate = useNavigate();
  const [blingSparks, setBlingSparks] = useState<Spark[]>([]);

  // Refs pour gérer les intervalles
  const initialAnimationRef = useRef<NodeJS.Timeout | null>(null);
  const continuousAnimationRef = useRef<NodeJS.Timeout | null>(null);
  const [isAnimatingRef, setIsAnimatingRef] = useState<boolean>(true);

  const createBlingSparks = (count = 3) => {
    if (!isAnimatingRef) return;

    const newSparks: Spark[] = [];

    for (let i = 0; i < count; i++) {
      const type = Math.random() > 0.4 ? "star" : "coin";

      newSparks.push({
        id: Date.now() + i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 12 + (type === "coin" ? 12 : 8),
        delay: Math.random() * 0.3,
        type,
      });
    }

    setBlingSparks((prev: Spark[]) => [...prev, ...newSparks]);

    setTimeout(() => {
      if (isAnimatingRef) {
        setBlingSparks((prev:Spark[]) =>
          prev.filter((spark:Spark) => !newSparks?.includes(spark))
        );
      }
    }, 2000);
  };

  useEffect(() => {
    if (variant === "bling") {
      setIsAnimatingRef(true);

      if(initialAnimationRef) {
        initialAnimationRef.current = setTimeout(() => createBlingSparks(20), 100);

      }
      if(continuousAnimationRef) {
        continuousAnimationRef.current = setInterval(() => createBlingSparks(8), 800);
      }

      return () => {
        setIsAnimatingRef(false)
        if (initialAnimationRef.current) clearTimeout(initialAnimationRef.current);
        if (continuousAnimationRef.current) clearInterval(continuousAnimationRef.current);
        setBlingSparks([]);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  const handleClickNavigate = (link: string) => {
    if (link === "") return;

    if (location.pathname !== link) {
      navigate(link);
    }
  };

  return (
    <div
      className={`button-xl-wrapper ${
        variant === "bling" ? "bling-wrapper" : ""
      }`}
    >
      <button
        disabled={disabled}
        aria-disabled={disabled}
        className={`button-xl ${
          variant === "bling" ? "bling-bling-button" : ""
        }`}
        onClick={() => handleClickNavigate(link)}
      >
        {children && <div className="button-icon">{children}</div>}
        <span className="button-text">{text}</span>

        {variant === "bling" && (
          <>
            <div className="golden-shine"></div>

            {blingSparks.map((spark: any) => (
              <div
                key={spark.id}
                className={`bling-element bling-${spark.type}`}
                style={{
                  left: `${spark.x}%`,
                  top: `${spark.y}%`,
                  animationDelay: `${spark.delay}s`,
                }}
              >
                {spark.type === "coin" ? (
                  <CoinIcon size={spark.size} />
                ) : (
                  <BlingStarIcon size={spark.size} />
                )}
              </div>
            ))}
          </>
        )}
      </button>
    </div>
  );
};
