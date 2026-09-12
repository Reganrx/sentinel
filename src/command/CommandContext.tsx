import {

  createContext,

  useContext,

} from "react";

export interface CommandContextValue {

  open: boolean;

  openPalette: () => void;

  closePalette: () => void;

  togglePalette: () => void;

}

const CommandContext =

  createContext<CommandContextValue | null>(null);

export function useCommand() {

  const context =

    useContext(CommandContext);

  if (!context) {

    throw new Error(

      "useCommand must be used inside CommandProvider."

    );

  }

  return context;

}

export default CommandContext;