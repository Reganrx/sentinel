import { useRef, useState } from "react";

import ConversationManager from "../conversation/ConversationManager";
import {
  ChatMessage,
  Conversation,
} from "../conversation/Conversation";

export default function useConversation() {
  const manager = useRef(new ConversationManager());

  const [conversations, setConversations] = useState<Conversation[]>(
    manager.current.getAll()
  );

  const [currentConversationId, setCurrentConversationId] =
    useState(conversations[0].id);

  function refresh() {
    setConversations([...manager.current.getAll()]);
  }

  function currentConversation(): Conversation {
    return (
      conversations.find(
        (conversation) =>
          conversation.id === currentConversationId
      ) ?? conversations[0]
    );
  }

  function newConversation() {
    const conversation = manager.current.create();

    refresh();

    setCurrentConversationId(conversation.id);
  }

  function deleteConversation(id: string) {
    manager.current.delete(id);

    refresh();
  }

  function renameConversation(
    id: string,
    title: string
  ) {
    manager.current.rename(id, title);

    refresh();
  }

  function addMessage(message: ChatMessage) {
    manager.current.addMessage(
      currentConversationId,
      message
    );

    refresh();
  }

  function updateLastMessage(text: string) {
    manager.current.updateLastMessage(
      currentConversationId,
      text
    );

    refresh();
  }

  return {
    conversations,
    currentConversation: currentConversation(),
    currentConversationId,
    setCurrentConversationId,
    newConversation,
    deleteConversation,
    renameConversation,
    addMessage,
    updateLastMessage,
  };
}