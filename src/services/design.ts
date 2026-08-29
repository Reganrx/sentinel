import { API_URL } from "./api";

export type DesignShape = { id: string; label: string; kind: "circle"|"rectangle"|"polygon"|"box"|"cylinder"; x: number; y: number; width: number; height: number; depth: number; radius: number; points: [number,number][]; clearance: number };
export type DesignResult = { assistantMessage: string; needsClarification: boolean; project: { name: string; width: number; height: number; depth: number }; shapes: DesignShape[]; notes: string[] };
export type DesignAttachment = { name: string; type: string; data: string };
export type MachineLookup = { identifiedName: string; machineType: string; workingWidth: number; workingHeight: number; cutterDiameter: number; kerf: number; recommendedTool: string; materialGuidance: string; notes: string[] };

export async function generateDesign(mode: "foam"|"print", message: string, current: object, attachments: DesignAttachment[]) {
  const response = await fetch(`${API_URL}/design/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, message, current, attachments }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to generate design.");
  return result as DesignResult;
}

export async function findFoamMachine(query: string, material: string) {
  const response = await fetch(`${API_URL}/design/machine`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, material }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to identify that machine.");
  return result as MachineLookup;
}

export function readDesignFile(file: File): Promise<DesignAttachment> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, type: file.type || "application/octet-stream", data: String(reader.result) }); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
}
