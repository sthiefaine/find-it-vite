import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { backTarget } from "../components/Headers/headerNav";
import { isNative } from "./native";

// Bouton retour Android : même cible que le retour de l'en-tête, et quitte l'app depuis l'accueil
export function useAndroidBackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const locRef = useRef(location);
  locRef.current = location;

  useEffect(() => {
    if (!isNative()) return;
    let removed = false;
    let remove: (() => void) | undefined;
    App.addListener("backButton", () => {
      const { pathname, search } = locRef.current;
      if (pathname === "/") void App.exitApp();
      else navigate(backTarget(pathname, search));
    })
      .then((handle) => {
        if (removed) void handle.remove();
        else remove = () => void handle.remove();
      })
      .catch(() => undefined);
    return () => {
      removed = true;
      remove?.();
    };
  }, [navigate]);
}
