import "./HomeActions.css";

import {

  MessageCircle,

  CloudSun,

  Cpu,

  Map,

  BellRing,

} from "lucide-react";

import QuickAction from "../../../../components/ui/QuickAction/QuickAction";

import {

  useNavigation,

} from "../../../../navigation/NavigationContext";

import { useSoundEffects } from "../../../../audio/SoundEffectsContext";
import type { WorldState } from "../../../../types/world";

export default function HomeActions({ world, loading }: { world: WorldState | null; loading: boolean }) {

  const {

    navigate,

  } = useNavigation();

  const { playNavigation } = useSoundEffects();

  return (

    <section className="home-actions">

      <QuickAction

        title="Chat"

        subtitle="Ask or continue a conversation"

        icon={

          <MessageCircle

            size={34}

          />

        }

        onClick={() =>

          { playNavigation(); navigate("chat"); }

        }

      />

      <QuickAction

        title="Weather"

        subtitle={loading ? "Updating forecast" : world ? `${Math.round(world.weather.current.temperature)}° · ${world.weather.current.condition}` : "Forecast unavailable"}

        icon={

          <CloudSun

            size={34}

          />

        }

        onClick={() =>

          { playNavigation(); navigate("weather"); }

        }

      />

      <QuickAction

        title="System"

        subtitle={world?.device.platform ? `${world.device.platform} · Running normally` : "Core services online"}

        icon={

          <Cpu

            size={34}

          />

        }

        onClick={() =>

          { playNavigation(); navigate("system"); }

        }

      />

      <QuickAction
        title="Navigation"
        subtitle={world?.location.city ? `Starting from ${world.location.city}` : "Routes and live traffic"}
        icon={<Map size={34} />}
        onClick={() => { playNavigation(); navigate("navigation"); }}
      />

      <QuickAction
        title="Notifications"
        subtitle="Protected · View activity"
        icon={<BellRing size={34} />}
        onClick={() => { playNavigation(); navigate("notifications"); }}
      />

    </section>

  );

}
