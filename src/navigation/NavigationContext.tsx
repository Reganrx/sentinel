import {

  createContext,

  useContext,

} from "react";

export type NavigationView =

  | "home"

  | "chat"

  | "concierge"

  | "design"

  | "weather"

  | "navigation"

  | "scanner"

  | "media"

  | "automation"

  | "notifications"

  | "system"

  | "memory"

  | "settings"

  | "travel";

interface NavigationContextValue {

  view: NavigationView;

  navigate: (

    view: NavigationView

  ) => void;

}

const NavigationContext =

  createContext<NavigationContextValue | null>(null);

export function useNavigation() {

  const context =

    useContext(

      NavigationContext

    );

  if (!context) {

    throw new Error(

      "useNavigation must be used inside NavigationProvider."

    );

  }

  return context;

}

export default NavigationContext;
