// Les portraits humains ont plus de marge autour du visage que les animaux.
// Même agrandissement dans les aperçus DOM, la foule Pixi et le multijoueur Canvas.
export const getPortraitScale = (imageSrc: string) =>
  imageSrc.includes("/assets/images/characters/people/") ? 1.1 : 1;

export const portraitStyle = (imageSrc: string) =>
  getPortraitScale(imageSrc) === 1 ? undefined : { transform: `scale(${getPortraitScale(imageSrc)})` };
