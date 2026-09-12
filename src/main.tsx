import React from "react";
import ReactDOM from "react-dom/client";

import "./styles/theme.css";
import "./index.css";

import App from "./App";

import {
  SentinelProvider,
} from "./state/SentinelContext";

import { SoundEffectsProvider } from "./audio/SoundEffectsContext";

import WorldProvider from "./world/WorldProvider";

import NavigationProvider from "./navigation/NavigationProvider";

import CommandProvider from "./command/CommandProvider";

import {
  MemoryProvider,
} from "./memory/MemoryContext";

import {
  ConversationProvider,
} from "./conversation/ConversationContext";

import {
  updateLocation,
  startLiveLocationTracking,
} from "./services/location";

async function initialiseSentinel() {

  try {

    await updateLocation();

    startLiveLocationTracking();

    console.log(
      "📍 Location synced with Sentinel."
    );

    setInterval(

      updateLocation,

      1000 * 60 * 5

    );

  }

  catch (err) {

    console.warn(

      "Location unavailable.",

      err

    );

  }

}

initialiseSentinel();

ReactDOM.createRoot(

  document.getElementById(

    "root"

  ) as HTMLElement

).render(

  <React.StrictMode>

    <SentinelProvider>

      <SoundEffectsProvider>

      <WorldProvider>

        <NavigationProvider>

          <CommandProvider>

            <MemoryProvider>

              <ConversationProvider>

                <App />

              </ConversationProvider>

            </MemoryProvider>

          </CommandProvider>

        </NavigationProvider>

      </WorldProvider>

      </SoundEffectsProvider>

    </SentinelProvider>

  </React.StrictMode>

);
