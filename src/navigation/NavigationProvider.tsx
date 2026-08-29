import {

  ReactNode,

  useCallback,

  useState,

} from "react";

import NavigationContext, {

  NavigationView,

} from "./NavigationContext";
import { isPageVisible } from "../services/pageVisibility";

interface Props {

  children: ReactNode;

}

export default function NavigationProvider({

  children,

}: Props) {

  const [

    view,

    setView,

  ] = useState<NavigationView>(

    "home"

  );

  const navigate =

    useCallback(

      (

        next: NavigationView

      ) => {

        setView(isPageVisible(next) ? next : "home");

      },

      []

    );

  return (

    <NavigationContext.Provider

      value={{

        view,

        navigate,

      }}

    >

      {children}

    </NavigationContext.Provider>

  );

}
