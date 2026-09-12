import {

  ReactNode,

  useCallback,

  useEffect,

  useState,

} from "react";

import CommandContext from "./CommandContext";

import CommandPalette from "./CommandPalette";

interface Props {

  children: ReactNode;

}

export default function CommandProvider({

  children,

}: Props) {

  const [

    open,

    setOpen,

  ] = useState(false);

  const openPalette =

    useCallback(() => {

      setOpen(true);

    }, []);

  const closePalette =

    useCallback(() => {

      setOpen(false);

    }, []);

  const togglePalette =

    useCallback(() => {

      setOpen(

        value => !value

      );

    }, []);

  useEffect(() => {

    function handleKeyDown(

      event: KeyboardEvent

    ) {

      if (

        event.ctrlKey &&

        event.code === "Space"

      ) {

        event.preventDefault();

        togglePalette();

      }

      if (

        event.key === "Escape"

      ) {

        closePalette();

      }

    }

    window.addEventListener(

      "keydown",

      handleKeyDown

    );

    return () =>

      window.removeEventListener(

        "keydown",

        handleKeyDown

      );

  }, [

    closePalette,

    togglePalette,

  ]);

  return (

    <CommandContext.Provider

      value={{

        open,

        openPalette,

        closePalette,

        togglePalette,

      }}

    >

      {children}

      {open && (

        <CommandPalette />

      )}

    </CommandContext.Provider>

  );

}