export const showPointsEffect = (
  container: HTMLDivElement,
  position: { x: number; y: number },
  isPositive: boolean,
  color: string,
  duration: number = 800,
): void => {
  const span = document.createElement("span");
  span.style.pointerEvents = "none";
  span.classList.add("pointsDisplay");
  span.style.position = "absolute";
  span.style.color = color;
  span.style.left = `${isPositive ? position.x : position.x + 10}px`;
  span.style.top = `${position.y - 10}px`;
  span.style.fontSize = "20px";
  span.style.fontWeight = "bold";
  span.textContent = isPositive ? "+1" : "-1";

  container.appendChild(span);

  setTimeout(() => {
    if (container && container.contains(span)) {
      container.removeChild(span);
    }
  }, duration);
};

export const handleBlinkEffect = (
  _elementId: number,
  setBlinkState: (isVisible: boolean) => void,
  duration: number = 500,
  cycles: number = 2,
  onComplete?: () => void
): (() => void) => {
  const interval = duration / (cycles * 2);
  let count = 0;
  let blinkInterval: NodeJS.Timeout | null = null;

  blinkInterval = setInterval(() => {
    setBlinkState(count % 2 === 0);
    count++;

    if (count >= cycles * 2) {
      if (blinkInterval) {
        clearInterval(blinkInterval);
        blinkInterval = null;
      }

      setBlinkState(true);

      if (onComplete) {
        onComplete();
      }
    }
  }, interval);

  return () => {
    if (blinkInterval) {
      clearInterval(blinkInterval);
      blinkInterval = null;
      setBlinkState(true);
    }
  };
};
