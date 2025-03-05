import styles from "./button.module.css";
import { useShallow } from "zustand/react/shallow";
import { GameStateEnum, useGameStore } from "../../../../store/store";

type ButtonProps = {
  icon: React.ReactNode;
  text?: string;
  onClick?: () => void;
  gameState?: GameStateEnum;
  shake?: boolean;
};

export function Button({
  icon,
  text,
  onClick,
  gameState,
  shake = false,
}: ButtonProps) {
  const { setGameState } = useGameStore(
    useShallow((state) => {
      return {
        setGameState: state.setGameState,
      };
    })
  );

  const handleOnClick = () => {
    if (onClick) {
      onClick();
    }
    if (gameState) {
      setGameState(gameState);
    }
  };
  return (
    <button
      className={`${text ? styles.button : styles.buttonSmall} ${
        shake ? styles.shake : ""
      }`}
      onClick={handleOnClick}
    >
      <span className={styles.icon}>{icon}</span>{" "}
      {text && <span className={styles.text}>{text}</span>}
    </button>
  );
}
