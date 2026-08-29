export enum CapabilityCategory {

  Brain = "brain",

  Workspace = "workspace",

  Memory = "memory",

  Goals = "goals",

  Coding = "coding",

  Tools = "tools",

  System = "system",

  Plugin = "plugin",

}

export interface Capability {

  id: string;

  name: string;

  description: string;

  category: CapabilityCategory;

  enabled: boolean;

  version: string;

  tags: string[];

}