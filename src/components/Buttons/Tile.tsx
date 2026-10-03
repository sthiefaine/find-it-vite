import { Link } from "react-router-dom";
import "./Tile.css";

export type TileProps = {
  to: string;
  icon: string;
  label: string;
  sub?: string;
  badge?: string;
  color: "orange" | "pink" | "teal" | "purple" | "slate";
  size?: "md" | "sm";
};

// Tuile de menu : grosse icône, mot court, info en petit
export const Tile = ({ to, icon, label, sub, badge, color, size = "md" }: TileProps) => (
  <Link to={to} className={`fi-tile fi-tile-${color} fi-tile-${size}`}>
    {badge && <span className="fi-tile-badge">{badge}</span>}
    <span className="fi-tile-icon" aria-hidden="true">
      {icon}
    </span>
    <span className="fi-tile-label">{label}</span>
    {sub && <span className="fi-tile-sub">{sub}</span>}
  </Link>
);
