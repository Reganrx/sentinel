import type {

  LucideIcon,

} from "lucide-react";

import {

  navigation,

} from "../navigation/navigation";

import type {

  NavigationView,

} from "../navigation/NavigationContext";

export interface Command {

  id: string;

  title: string;

  subtitle: string;

  category: string;

  shortcut?: string;

  icon: LucideIcon;

  keywords: string[];

  action: () => void;

}

export function createCommands(

  navigate: (

    page: NavigationView

  ) => void

): Command[] {

  return navigation.map(

    item => ({

      id: item.id,

      title: item.title,

      subtitle:

        `Open ${item.title}`,

      category:

        "Application",

      shortcut: undefined,

      icon: item.icon,

      keywords: [

        item.title,

        "open",

        "application",

      ],

      action: () =>

        navigate(item.id),

    })

  );

}

export function scoreCommand(

  command: Command,

  query: string

): number {

  if (!query.trim()) {

    return 100;

  }

  const search =

    query.toLowerCase();

  const text =

    [

      command.title,

      command.subtitle,

      ...command.keywords,

    ]

      .join(" ")

      .toLowerCase();

  if (

    command.title.toLowerCase() ===

    search

  ) {

    return 1000;

  }

  if (

    command.title

      .toLowerCase()

      .startsWith(search)

  ) {

    return 900;

  }

  if (

    text.includes(search)

  ) {

    return 700;

  }

  let score = 0;

  let index = 0;

  const title =

    command.title.toLowerCase();

  for (

    const character of search

  ) {

    const found =

      title.indexOf(

        character,

        index

      );

    if (

      found === -1

    ) {

      return 0;

    }

    score += 10;

    index =

      found + 1;

  }

  return score;

}