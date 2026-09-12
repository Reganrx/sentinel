import {

  Home,

  MessageSquare,

  CloudSun,

  Monitor,

  Map,

  Radar,

  SlidersHorizontal,

  Settings,

  Music2,

  BellRing,

  Plane,

  DraftingCompass,

  Pizza,

} from "lucide-react";

import type {

  NavigationView,

} from "./NavigationContext";

export interface NavigationItem {

  id: NavigationView;

  title: string;

  icon: typeof Home;

  personalOnly?: boolean;

}

export const navigation: NavigationItem[] = ([

  {

    id: "home",

    title: "Home",

    icon: Home,

  },

  {

    id: "chat",

    title: "Chat",

    icon: MessageSquare,

  },

  {

    id: "weather",

    title: "Weather",

    icon: CloudSun,

  },

  {

    id: "design",

    title: "Design",

    icon: DraftingCompass,

    personalOnly: true,

  },

  {

    id: "concierge",

    title: "Concierge",

    icon: Pizza,

    personalOnly: true,

  },

  {

    id: "navigation",

    title: "Navigation",

    icon: Map,

  },

  {

    id: "scanner",

    title: "Device Scanner",

    icon: Radar,

  },

  {

    id: "media",

    title: "Audio Control",

    icon: Music2,

  },

  {

    id: "automation",

    title: "Mission Control",

    icon: SlidersHorizontal,

  },

  {

    id: "system",

    title: "System",

    icon: Monitor,

  },

  {

    id: "notifications",

    title: "Notifications",

    icon: BellRing,

  },

  {

    id: "settings",

    title: "Settings",

    icon: Settings,

  },

  {

    id: "travel",

    title: "Travel",

    icon: Plane,

  },

] satisfies NavigationItem[]).sort((a, b) => {
  if (a.id === "home") return -1;
  if (b.id === "home") return 1;
  return a.title.localeCompare(b.title);
});

export const availableNavigation = navigation.filter(
  (item) => !item.personalOnly || import.meta.env.VITE_SENTINEL_EDITION !== "base",
);
