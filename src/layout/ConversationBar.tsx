import "./ConversationBar.css";
import { Plus, Search, MessageSquare } from "lucide-react";
import { useConversation } from "../conversation/ConversationContext";

export default function ConversationBar() {
  const { conversations, currentConversationId, currentConversation, setCurrentConversation, newConversation } = useConversation();
  return <div className="conversation-bar">
    <div className="conversation-top">
      <button className="new-chat" onClick={newConversation}><Plus size={18}/>New Chat</button>
      <div className="conversation-title"><h2>{currentConversation.title}</h2><span>{currentConversation.messages.length} messages</span></div>
      <button className="search-chat"><Search size={18}/></button>
    </div>
    <div className="conversation-strip">{conversations.map(conversation => <button key={conversation.id} className={conversation.id === currentConversationId ? "chat-card active" : "chat-card"} onClick={() => setCurrentConversation(conversation.id)}><MessageSquare size={18}/><div><strong>{conversation.title}</strong><span>{conversation.messages.length} messages</span></div></button>)}</div>
  </div>;
}
