import {

  ReactNode,

  useCallback,

  useEffect,

  useState,

} from "react";

import WorldContext from "./WorldContext";

import {

  getWorldState,

} from "../services/world";

import type {

  WorldState,

} from "../types/world";

interface Props {

  children: ReactNode;

}

export default function WorldProvider({

  children,

}: Props) {

  const [

    world,

    setWorld,

  ] = useState<WorldState | null>(null);

  const [

    loading,

    setLoading,

  ] = useState(true);

  const refresh = useCallback(

    async () => {

      try {

        const state =

          await getWorldState();

        setWorld(state);

      }

      catch (error) {

        console.error(

          "Failed to refresh world state:",

          error

        );

      }

      finally {

        setLoading(false);

      }

    },

    []

  );

  useEffect(() => {

    refresh();

    const timer =

      setInterval(

        refresh,

        60000

      );

    return () =>

      clearInterval(timer);

  }, [

    refresh,

  ]);

  useEffect(() => {

    const handleLocationUpdate = () => {

      refresh();

    };

    window.addEventListener(
      "sentinel:location-updated",
      handleLocationUpdate
    );

    return () =>
      window.removeEventListener(
        "sentinel:location-updated",
        handleLocationUpdate
      );

  }, [

    refresh,

  ]);

  return (

    <WorldContext.Provider

      value={{

        world,

        loading,

        refresh,

      }}

    >

      {children}

    </WorldContext.Provider>

  );

}
