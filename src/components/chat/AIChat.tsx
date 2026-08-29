import { useEffect, useRef, useState } from "react";

import {
  sendMessage,
} from "../../services/chat";

import { useConversation } from "../../conversation/ConversationContext";
import { useSentinel } from "../../state/SentinelContext";
import { useMemory } from "../../memory/MemoryContext";
import { useNavigation } from "../../navigation/NavigationContext";
import type { NavigationView } from "../../navigation/NavigationContext";

import ConversationHeader from "../conversation/ConversationHeader";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import { Camera, CloudSun, Navigation, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { Code2 } from "lucide-react";
import { getDeveloperStatus, getDeveloperToken } from "../../services/developer";
import { API_URL } from "../../services/api";

import "./AIChat.css";

const TEXT_FILE_TYPES = [
  "txt",
  "md",
  "json",
  "csv",
  "js",
  "jsx",
  "ts",
  "tsx",
  "html",
  "css",
  "scss",
  "py",
  "java",
  "cs",
  "cpp",
  "c",
  "xml",
  "sql",
  "yml",
  "yaml",
  "ini",
  "toml",
  "log",
];

type WindowsControlPlan = {
  id: string;
  diagnostics: {
    os: string;
    memory: { usedPercent: number };
    systemDrive: { freePercent: number };
    network: { internetReachable: boolean };
    pendingRestart: boolean;
    notes: string[];
  };
  actions: Array<{ label: string; command: string; effect: string; risk: "low" | "medium" | "high"; requiresElevation: boolean }>;
};

function isWindowsControlRequest(value: string) {
  return /\b(?:windows|this pc|computer|operating system|taskbar|explorer|microsoft store|dns)\b.*\b(?:check|diagnos|repair|fix|control|change|maintain|maintenance|restart|reset)|\b(?:check|diagnos|repair|fix|control|change|maintain|maintenance|restart|reset)\b.*\b(?:windows|this pc|computer|operating system|taskbar|explorer|microsoft store|dns)\b/i.test(value);
}

function imageGenerationPrompt(value: string) {
  const match = value.match(/\b(?:generate|create|make|draw|design)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|illustration|artwork|poster)\s+(?:of|showing|for)?\s*(.+)/i);
  return match?.[1]?.trim() || null;
}

function windowsPlanReply(plan: WindowsControlPlan) {
  const d = plan.diagnostics;
  const lines = [
    `Windows diagnostics complete on ${d.os}.`,
    `Memory use: ${d.memory.usedPercent}% · System drive free: ${d.systemDrive.freePercent}% · Internet: ${d.network.internetReachable ? "reachable" : "not confirmed"} · Restart: ${d.pendingRestart ? "pending" : "not pending"}.`,
  ];
  if (d.notes.length) lines.push(`Findings: ${d.notes.join(" ")}`);
  if (!plan.actions.length) {
    lines.push("This was a read-only check. Sentinel did not infer a safe allowlisted change from the request.");
    return lines.join("\n\n");
  }
  lines.push("Proposed changes (nothing has run yet):");
  lines.push(...plan.actions.map((action, index) => `${index + 1}. ${action.label} — ${action.effect}\nCommand: ${action.command}\nRisk: ${action.risk}${action.requiresElevation ? " · Windows elevation required" : ""}`));
  lines.push(`To continue, type: approve windows proposal ${plan.id}`);
  return lines.join("\n\n");
}

export default function AIChat() {

  const { navigate } = useNavigation();

  const { setState } =
    useSentinel();

  const {

    currentConversation,

    addMessage,

  } = useConversation();

  const {
    saveConversation,
  } = useMemory();

  const [input, setInput] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [chatEngine, setChatEngine] = useState<"sentinel" | "codex">("sentinel");
  const [developerUnlocked, setDeveloperUnlocked] = useState(false);
  const [codexReady, setCodexReady] = useState(false);
  const [codexDetail, setCodexDetail] = useState("");

  const isDeveloperRequest = (value: string) =>
    /\b(?:codex|source\s*code|source|codebase|workspace|repository|repo|tsx?|typescript|component|backend|frontend|implementation|inspect\s+(?:the\s+)?files?|read\s+(?:the\s+)?files?|search\s+(?:the\s+)?files?)\b/i.test(value);

  const [attachment, setAttachment] =
    useState<File | null>(null);

  const bottomRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {

    bottomRef.current?.scrollIntoView({

      behavior: "smooth",

    });

  }, [

    currentConversation?.messages,

  ]);

  useEffect(() => {
    const receiveGeneratedImage = (event: Event) => {
      const detail = (event as CustomEvent<{ imageUrl?: string; prompt?: string }>).detail;
      if (!detail?.imageUrl) return;
      addMessage({
        id: crypto.randomUUID(),
        sender: "sentinel",
        text: "Your generated image is ready.",
        timestamp: getTime(),
        imageUrl: detail.imageUrl.startsWith("http") ? detail.imageUrl : `${API_URL}${detail.imageUrl}`,
        imagePrompt: detail.prompt,
      });
    };
    window.addEventListener("sentinel:generated-image", receiveGeneratedImage);
    return () => window.removeEventListener("sentinel:generated-image", receiveGeneratedImage);
  }, [addMessage]);

  useEffect(() => {
    let active = true;
    async function refreshDeveloperEngine() {
      try {
        const status = await getDeveloperStatus();
        if (!active) return;
        setDeveloperUnlocked(status.unlocked);
        if (!status.unlocked) { setChatEngine("sentinel"); setCodexReady(false); return; }
        const codex = await window.sentinelDesktop?.codexStatus(getDeveloperToken());
        if (!active) return;
        setCodexReady(Boolean(codex?.available && codex.authenticated));
        setCodexDetail(codex?.version || codex?.error || "Codex unavailable");
      } catch { if (active) { setDeveloperUnlocked(false); setCodexReady(false); setChatEngine("sentinel"); } }
    }
    void refreshDeveloperEngine();
    const timer = window.setInterval(() => void refreshDeveloperEngine(), 15_000);
    window.addEventListener("focus", refreshDeveloperEngine);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refreshDeveloperEngine); };
  }, []);

  if (!currentConversation) {

    return (

      <section className="ai-chat">

        <div
          style={{
            color: "white",
            padding: 40,
          }}
        >

          Loading conversation...

        </div>

      </section>

    );

  }

  async function buildPrompt(voiceText?: string) {

    let prompt =
      voiceText?.trim() || input.trim();

    if (!attachment) {

      return prompt;

    }

    const extension =
      attachment.name
        .split(".")
        .pop()
        ?.toLowerCase();

    if (

      extension &&

      TEXT_FILE_TYPES.includes(extension)

    ) {

      try {

        const contents =
          await attachment.text();

        prompt +=

`\n\nAttached File: ${attachment.name}

\`\`\`${extension}
${contents}
\`\`\``;

      }

      catch {

        prompt +=

`\n\nAttached File: ${attachment.name}`;

      }

    }

    return prompt;

  }

  async function handleSend(voiceText?: string) {

    if (

      loading ||

      (!voiceText?.trim() && !input.trim() && !attachment)

    ) {

      return;

    }

    const prompt =
      await buildPrompt(voiceText);

    addMessage({

      id: crypto.randomUUID(),

      sender: "user",

      text: prompt,

      timestamp: getTime(),

    });

    setInput("");

    setAttachment(null);

    setLoading(true);

    setState("thinking");

    try {

      let reply = "";
      let generatedImage: { url: string; revisedPrompt?: string } | undefined;
      const approvalMatch = prompt.match(/^approve\s+windows\s+proposal\s+([0-9a-f-]{36})$/i);
      const requestedImage = imageGenerationPrompt(prompt);
      if (requestedImage) {
        const response = await fetch(`${API_URL}/image/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: requestedImage }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Sentinel could not generate the image.");
        generatedImage = result;
        reply = "Your generated image is ready. You can preview it below or save the full PNG.";
      } else if (approvalMatch) {
        if (!developerUnlocked) throw new Error("Developer Mode must be unlocked before approving Windows changes.");
        const password = window.prompt("Enter your developer password to approve this Windows proposal.");
        if (!password) throw new Error("Windows approval was cancelled.");
        const confirmed = window.confirm("Review the proposal in chat. Approve Sentinel to run exactly those allowlisted Windows changes now? High-risk repairs may also show a Windows UAC prompt.");
        if (!confirmed) throw new Error("Windows approval was cancelled.");
        const response = await fetch(`${API_URL}/windows/control/${approvalMatch[1]}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-sentinel-developer-token": getDeveloperToken() },
          body: JSON.stringify({ password, confirmation: "APPROVE WINDOWS CONTROL" }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "The Windows proposal could not be applied.");
        reply = `Windows proposal completed.\n\n${(result.results ?? []).map((item: any) => `${item.action.label}: ${item.ok ? "completed" : "failed"}`).join("\n")}`;
      } else if (isWindowsControlRequest(prompt)) {
        if (!developerUnlocked) throw new Error("Unlock Developer Mode before asking Sentinel to control Windows.");
        const response = await fetch(`${API_URL}/windows/control/plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-sentinel-developer-token": getDeveloperToken() },
          body: JSON.stringify({ request: prompt }),
        });
        const plan = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(plan.error ?? "Windows diagnostics failed.");
        reply = windowsPlanReply(plan as WindowsControlPlan);
      } else {
      // Developer/source requests belong to Codex even when the user started
      // typing on the Sentinel tab.  This removes the misleading "no active
      // workspace" response from the general assistant while ordinary chat
      // continues to use Sentinel's connected services and memory.
      const requestEngine = chatEngine === "codex" ||
        (developerUnlocked && codexReady && isDeveloperRequest(prompt))
          ? "codex"
          : "sentinel";
      if (requestEngine === "codex") {
        setChatEngine("codex");
        const result = await window.sentinelDesktop!.codexChat(
            getDeveloperToken(),
            [
              "Recent Sentinel conversation:",
              ...currentConversation.messages.slice(-8).map((message) => `${message.sender === "sentinel" ? "Assistant" : "User"}: ${message.text}`),
              `User: ${prompt}`,
            ].join("\n\n"),
          );
        reply = result.reply;
      } else {
        const result = await sendMessage(
            prompt,
            currentConversation.messages.map(
              message => ({
                role: message.sender === "sentinel" ? "assistant" as const : "user" as const,
                content: message.text,
              })
            )
          );
        reply = result.reply;
        if (result.action?.type === "open_page") navigate(result.action.page as NavigationView);
        if (result.action?.type === "open_camera") navigate("automation");
      }
      }

      addMessage({

        id: crypto.randomUUID(),

        sender: "sentinel",

        text: reply,

        timestamp: getTime(),
        imageUrl: generatedImage?.url ? `${API_URL}${generatedImage.url}` : undefined,
        imagePrompt: generatedImage?.revisedPrompt ?? requestedImage ?? undefined,

      });

      const conversationContent = [
        ...currentConversation.messages,
        {
          sender: "user" as const,
          text: prompt,
        },
        {
          sender: "sentinel" as const,
          text: reply,
        },
      ]
        .map(message =>
          `${message.sender === "user" ? "You" : "Sentinel"}: ${message.text}`
        )
        .join("\n\n");

      saveConversation(
        currentConversation.id,
        currentConversation.title,
        conversationContent
      );

    }

    catch (error) {

      console.error(error);

      addMessage({

        id: crypto.randomUUID(),

        sender: "sentinel",

        text: "⚠️ Unable to contact Sentinel.",

        timestamp: getTime(),

      });

    }

    finally {

      setLoading(false);

      setState("idle");

    }

  }

  return (

    <section className="ai-chat">

      <header className="chat-toolbar">
        <ConversationHeader />
        {developerUnlocked && <div className="chat-engine-switch" title={codexDetail}>
          <button className={chatEngine === "sentinel" ? "active" : ""} onClick={() => setChatEngine("sentinel")}>Sentinel AI</button>
          <button className={chatEngine === "codex" ? "active" : ""} disabled={!codexReady} onClick={() => setChatEngine("codex")}><Code2 size={15} /> Codex Developer</button>
        </div>}
        <div className={`sentinel-live-state ${loading ? "thinking" : "ready"}`}>
          <div className="sentinel-orb"><span/><span/><Sparkles size={17}/></div>
          <div><strong>{loading ? `${chatEngine === "codex" ? "Codex" : "Sentinel"} is thinking` : chatEngine === "codex" ? "Codex Developer ready" : "Sentinel ready"}</strong><small>{loading ? "Analysing your request" : chatEngine === "codex" ? "Read-only source access · changes require approval" : "Memory and connected services available"}</small></div>
        </div>

      </header>

      <main className="message-area">

        {currentConversation.messages.map(

          message => (

            <ChatMessage

              key={message.id}

              sender={message.sender}

              text={message.text}

              timestamp={message.timestamp}
              imageUrl={message.imageUrl}
              imagePrompt={message.imagePrompt}

            />

          )

        )}

        {loading && <TypingIndicator />}

        <div ref={bottomRef} />

      </main>

      <footer className="chat-composer">

        <div className="chat-suggestions" aria-label="Suggested commands">
          {[
            ["Check my home", ShieldCheck],
            ["Show cameras", Camera],
            ["Plan a route", Navigation],
            ["Check weather", CloudSun],
            ["Scan devices", ScanLine],
          ].map(([label, Icon]) => <button key={String(label)} type="button" onClick={() => setInput(String(label))}><Icon size={14}/>{String(label)}</button>)}
        </div>

        <ChatInput

          value={input}

          onChange={setInput}

          onSend={handleSend}
          onVoiceSend={(text) => void handleSend(text)}

          streaming={loading}

          onStop={() => {}}

          attachment={attachment}

          onAttachment={setAttachment}

        />

      </footer>

    </section>

  );

}

function getTime() {

  return new Date().toLocaleTimeString([], {

    hour: "2-digit",

    minute: "2-digit",

  });

}
