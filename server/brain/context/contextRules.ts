import {
  ContextSource,
} from "./contextTypes.js";

export interface ContextRule {

  keywords: string[];

  sources: ContextSource[];

}

export const CONTEXT_RULES: ContextRule[] = [

  {

    keywords: [

      "weather",

      "temperature",

      "forecast",

      "rain",

      "sun",

      "snow",

      "humid",

      "wind",

      "outside",

    ],

    sources: [

      ContextSource.World,

      ContextSource.Location,

      ContextSource.Weather,

      ContextSource.Time,

    ],

  },

  {

    keywords: [

      "where",

      "location",

      "near",

      "postcode",

      "city",

      "country",

    ],

    sources: [

      ContextSource.World,

      ContextSource.Location,

    ],

  },

  {

    keywords: [

      "remember",

      "memory",

      "forget",

      "recall",

    ],

    sources: [

      ContextSource.Memory,

      ContextSource.Conversation,

    ],

  },

  {

    keywords: [

      "workspace",

      "project",

      "code",

      "typescript",

      "react",

      "file",

      "folder",

    ],

    sources: [

      ContextSource.Workspace,

      ContextSource.Conversation,

    ],

  },

  {

    keywords: [

      "goal",

      "task",

      "plan",

      "todo",

    ],

    sources: [

      ContextSource.Goals,

      ContextSource.Execution,

    ],

  },

  {

    keywords: [

      "computer",

      "pc",

      "device",

      "battery",

      "cpu",

      "gpu",

      "ram",

      "internet",

      "wifi",

    ],

    sources: [

      ContextSource.Device,

    ],

  },

];