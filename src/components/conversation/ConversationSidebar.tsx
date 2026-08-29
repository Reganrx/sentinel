import "./ConversationSidebar.css";

import {
  Plus,
  MessageSquare,
} from "../../shared/icons";

import { useConversation } from "../../conversation/ConversationContext";

export default function ConversationSidebar() {
  const {
    conversations,
    currentConversationId,
    setCurrentConversation,
    newConversation,
  } = useConversation();

  return (
    <aside className="conversation-sidebar">

      <button
        className="new-chat-button"
        onClick={newConversation}
      >
        <Plus size={18} />
        <span>New Chat</span>
      </button>

      <div className="conversation-list">

        {conversations.map((conversation) => {

          const active =
            conversation.id === currentConversationId;

          return (

            <button
              key={conversation.id}
              className={
                active
                  ? "conversation-item active"
                  : "conversation-item"
              }
              onClick={() =>
                setCurrentConversation(
                  conversation.id
                )
              }
            >

              <MessageSquare
                size={16}
              />

              <div className="conversation-details">

                <div className="conversation-title">

                  {conversation.title}

                </div>

                <div className="conversation-meta">

                  {conversation.messages.length}
                  {" "}
                  messages

                </div>

              </div>

            </button>

          );

        })}

      </div>

    </aside>
  );
}