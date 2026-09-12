import dotenv from "dotenv";

dotenv.config();

import OpenAI from "openai";

// Base must be able to start before its owner enters an API key. Resolve the
// client lazily so setup remains available and newly saved keys are used.
const client = new Proxy({} as OpenAI, {
  get(_target, property) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI is not configured. Add an API key in Setup Centre.");
    const activeClient = new OpenAI({ apiKey });
    return Reflect.get(activeClient, property, activeClient);
  },
});

export default client;
