import type { CSSProperties } from "react";
import { portraitStyle } from "../../helpers/portraitScale";
import { ACCESSORY_OUTLINE_OFFSETS, getAccessory, getAccessoryBox, needsAccessoryOutline, type AccessoryId } from "../../content/accessories";
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
  const style: CSSProperties = { ...(size ? { width: size, height: size } : {}), ...portraitStyle(imageSrc) };
  return <span className={`animal-portrait ${className}`} style={style} hidden={hidden}
    role="img" aria-label={accessory ? `${label}, ${accessory.label.toLocaleLowerCase("fr")}` : label}
    data-accessory={accessory?.id ?? "none"}>
    <img className="animal-portrait__head" src={imageSrc} alt="" draggable={false} />
    {accessory && box && needsAccessoryOutline(accessory) ? ACCESSORY_OUTLINE_OFFSETS.map((offset, index) => (
      <img key={`outline-${index}`} className="animal-portrait__accessory animal-portrait__accessory-outline"
        src={accessory.imageSrc} alt="" draggable={false}
        style={{ left: `${(box.x + offset.x) * 100}%`, top: `${(box.y + offset.y) * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }} />
    )) : null}
    {accessory && box ? <img className="animal-portrait__accessory" src={accessory.imageSrc} alt="" draggable={false}
      style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }} /> : null}
  </span>;
}
