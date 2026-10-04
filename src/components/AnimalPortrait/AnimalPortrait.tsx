import type { CSSProperties } from "react";
import { getAccessory, getAccessoryBox, type AccessoryId } from "../../content/accessories";
import "./AnimalPortrait.css";

type Props = {
  imageSrc: string;
  label: string;
  accessoryId?: AccessoryId | null;
  size?: number;
  className?: string;
  hidden?: boolean;
};

export function AnimalPortrait({ imageSrc, label, accessoryId, size, className = "", hidden = false }: Props) {
  const accessory = getAccessory(accessoryId);
  const box = accessory ? getAccessoryBox(accessory, imageSrc) : undefined;
  const style: CSSProperties | undefined = size ? { width: size, height: size } : undefined;
  return <span className={`animal-portrait ${className}`} style={style} hidden={hidden}
    role="img" aria-label={accessory ? `${label}, ${accessory.label.toLocaleLowerCase("fr")}` : label}
    data-accessory={accessory?.id ?? "none"}>
    <img className="animal-portrait__head" src={imageSrc} alt="" draggable={false} />
    {accessory && box ? <img className="animal-portrait__accessory" src={accessory.imageSrc} alt="" draggable={false}
      style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }} /> : null}
  </span>;
}
