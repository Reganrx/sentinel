import {
  registerCapability,
} from "./capabilityRegistry.js";

import {
  CapabilityCategory,
} from "./capabilityTypes.js";

export function loadCapabilities() {

  registerCapability({

    id: "brain.reason",

    name: "Reasoning",

    description:
      "Perform multi-step reasoning.",

    category:
      CapabilityCategory.Brain,

    enabled: true,

    version: "1.0.0",

    tags: [

      "reason",

      "thinking",

      "analysis",

    ],

  });

  registerCapability({

    id: "brain.plan",

    name: "Planning",

    description:
      "Create execution plans.",

    category:
      CapabilityCategory.Brain,

    enabled: true,

    version: "1.0.0",

    tags: [

      "planning",

      "tasks",

    ],

  });

  registerCapability({

    id: "brain.execute",

    name: "Execution",

    description:
      "Execute planned actions.",

    category:
      CapabilityCategory.Brain,

    enabled: true,

    version: "1.0.0",

    tags: [

      "execute",

      "actions",

    ],

  });

  registerCapability({

    id: "workspace.search",

    name: "Workspace Search",

    description:
      "Search the loaded workspace.",

    category:
      CapabilityCategory.Workspace,

    enabled: true,

    version: "1.0.0",

    tags: [

      "workspace",

      "search",

      "files",

    ],

  });

  registerCapability({

    id: "workspace.index",

    name: "Project Intelligence",

    description:
      "Index project structure and symbols.",

    category:
      CapabilityCategory.Workspace,

    enabled: true,

    version: "1.0.0",

    tags: [

      "index",

      "symbols",

      "project",

    ],

  });

  registerCapability({

    id: "memory.store",

    name: "Memory Storage",

    description:
      "Store long-term memories.",

    category:
      CapabilityCategory.Memory,

    enabled: true,

    version: "1.0.0",

    tags: [

      "memory",

      "store",

    ],

  });

  registerCapability({

    id: "memory.search",

    name: "Memory Search",

    description:
      "Search long-term memories.",

    category:
      CapabilityCategory.Memory,

    enabled: true,

    version: "1.0.0",

    tags: [

      "memory",

      "search",

    ],

  });

  registerCapability({

    id: "goals.manage",

    name: "Goal Management",

    description:
      "Manage long-running goals.",

    category:
      CapabilityCategory.Goals,

    enabled: true,

    version: "1.0.0",

    tags: [

      "goals",

      "queue",

      "tasks",

    ],

  });

  registerCapability({

    id: "source.control",

    name: "Safe Source Control",

    description:
      "Read and search Sentinel's source, with changes staged for explicit approval.",

    category:
      CapabilityCategory.Coding,

    enabled: true,

    version: "1.0.0",

    tags: [

      "source",

      "search",

      "proposals",

    ],

  });

  registerCapability({

    id: "coding.refactor",

    name: "Code Refactoring",

    description:
      "Refactor source code.",

    category:
      CapabilityCategory.Coding,

    enabled: true,

    version: "1.0.0",

    tags: [

      "code",

      "refactor",

      "typescript",

      "javascript",

    ],

  });

}
