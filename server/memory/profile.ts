export type UserProfile = {
  name: string;
  assistantName: string;
  projects: string[];
  preferredLanguage: string;
  preferredStyle: string;
  personality: string[];
};

const profile: UserProfile = {
  name: "Regan",

  assistantName: "Sentinel",

  projects: [
    "Sentinel Desktop AI",
  ],

  preferredLanguage: "TypeScript",

  preferredStyle: "Complete production-ready files",

  personality: [
    "Friendly",
    "Professional",
    "Natural",
    "Concise",
    "Proactive",
  ],
};

export function getUserProfile() {
  return profile;
}