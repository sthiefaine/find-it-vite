import { useEffect } from "react";

export type ImagesPreloaderProps = {
  imageUrls: string[];
};

export const ImagePreloader = ({ imageUrls }: ImagesPreloaderProps) => {
  useEffect(() => {
    const totalImages = imageUrls.length;

    if (totalImages === 0) {
      return;
    }

    imageUrls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, [imageUrls]);

  return null;
};
