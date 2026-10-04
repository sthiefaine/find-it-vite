import { useEffect } from "react";
import { preloadImages } from "../../game/assetReadiness";

export type ImagesPreloaderProps = {
  imageUrls: string[];
};

export const ImagePreloader = ({ imageUrls }: ImagesPreloaderProps) => {
  useEffect(() => {
    // Réutilisé par le chargement bloquant du niveau. Un échec de préchauffage
    // reste récupérable : le niveau réessaiera et affichera son propre message.
    void preloadImages(imageUrls).catch(() => undefined);
  }, [imageUrls]);

  return null;
};
