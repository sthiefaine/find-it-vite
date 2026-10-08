import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { PlayCat } from "./PlayCat";
import "./ButtonXL.css";

export type ButtonXLProps = {
  text: string;
  link?: string;
  variant?: "normal" | "bling";
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
  children?: ReactNode;
};

export const ButtonXL = ({ text, link = "", variant = "normal", children, disabled = false, busy = false, onClick }: ButtonXLProps) => {
  const navigate = useNavigate();
  return <div className={`button-xl-wrapper${variant === "bling" ? " bling-wrapper" : ""}`}>
    <button disabled={disabled} aria-busy={busy || undefined} className={`button-xl${variant === "bling" ? " bling-bling-button" : ""}`}
      onClick={() => { if (onClick) onClick(); else if (link) navigate(link); }}>
      {children && <span className="button-icon" aria-hidden="true">{children}</span>}
      <span className="button-text">{text}</span>
      {variant === "bling" && <span className="golden-shine" aria-hidden="true" />}
    </button>
    {variant === "bling" && <PlayCat />}
  </div>;
};
