import "./ChatWorkspace.css";
import ConversationBar from "./ConversationBar";
import AIChat from "../components/chat/AIChat";
import MemoryPanel from "../memory/MemoryPanel";
import { useMemory } from "../memory/MemoryContext";

export default function ChatWorkspace() {
  const { memoryOpen } = useMemory();
  return <div className="chat-workspace">
    <ConversationBar />
    <div className="workspace-chat"><AIChat />{memoryOpen && <MemoryPanel />}</div>
  </div>;
}
