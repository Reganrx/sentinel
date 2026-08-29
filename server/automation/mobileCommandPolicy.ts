/** No device access here: validate before dispatching any mobile command. */
export function approvedMobileCommand(value: unknown): string | null {
  if (!value || typeof value !== "object") throw new Error("Invalid relay command.");
  const command = value as Record<string, unknown>;
  const payload = command.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid relay payload.");
  const fields = payload as Record<string, unknown>;
  // Existing authenticated Alexa/desktop commands retain their legacy path.
  // Any typed action uses this policy, even if its source label was altered.
  if (command.source !== "sentinel-ios" && fields.action === undefined) return null;
  if (command.type !== "sentinel.command") throw new Error("Unsupported mobile command type.");
  if (fields.action !== "smart_home_control") {
    throw new Error("This mobile action needs a dedicated desktop handler; it cannot run as an automation command.");
  }
  if (fields.approved !== true) throw new Error("Explicit approval is required for smart-home changes.");
  if (typeof fields.target !== "string" || typeof fields.command !== "string") throw new Error("A command and approved target are required.");
  const target = fields.target.trim();
  const text = fields.command.trim();
  if (!target || target.length > 120 || text.length > 280 || /[\r\n;&|]/.test(target) || /\b(?:and|then|turn|switch)\b/i.test(target)) throw new Error("Use one approved device target.");
  const match = text.match(/^(?:please\s+)?(?:turn|switch)\s+(on|off)\s+(.+?)(?:\s+please)?[.!]?$/i);
  const normalise = (s: string) => s.toLowerCase().replace(/^(?:the|my)\s+/, "").replace(/\s+/g, " ").replace(/[.!]$/, "").trim();
  if (!match || normalise(match[2]) !== normalise(target)) throw new Error("The command does not match the approved target.");
  return `turn ${match[1].toLowerCase()} ${target}`;
}
