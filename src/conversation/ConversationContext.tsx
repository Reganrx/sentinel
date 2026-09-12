import {
  createContext,
  useContext,
  useRef,
  useState,
  ReactNode,
} from "react";

import ConversationManager from "./ConversationManager";
import {
  ChatMessage,
  Conversation,
} from "./Conversation";

import { useMemory } from "../memory/MemoryContext";

type ConversationContextType = {
  conversations: Conversation[];
  currentConversation: Conversation;
  currentConversationId: string;

  setCurrentConversation: (id: string) => void;

  newConversation: () => void;

  deleteConversation: (id: string) => void;

  renameConversation: (
    id: string,
    title: string
  ) => void;

  duplicateConversation: (id: string) => void;

  addMessage: (
    message: ChatMessage
  ) => void;

  updateLastMessage: (
    text: string
  ) => void;

  saveCurrentConversation: () => void;
};

const ConversationContext =
  createContext<ConversationContextType | null>(
    null
  );

export function ConversationProvider({
  children,
}: {
  children: ReactNode;
}) {

  const manager =
    useRef(new ConversationManager());

  const { saveConversation } =
    useMemory();

  const [conversations, setConversations] =
    useState(
      manager.current.getAll()
    );

  const [
    currentConversationId,
    setCurrentConversationId,
  ] = useState(
    manager.current.getCurrent().id
  );

  function refresh() {

    const updated =
      manager.current.getAll();

    setConversations([...updated]);

    if (
      !updated.some(
        conversation =>
          conversation.id ===
          currentConversationId
      )
    ) {

      setCurrentConversationId(
        updated[0].id
      );

    }

  }

  const currentConversation =
    conversations.find(

      conversation =>
        conversation.id ===
        currentConversationId

    ) ?? conversations[0];

  function newConversation() {

    const conversation =
      manager.current.create();

    refresh();

    setCurrentConversationId(
      conversation.id
    );

  }

  function deleteConversation(
    id: string
  ) {

    manager.current.delete(id);

    refresh();

  }

  function renameConversation(
    id: string,
    title: string
  ) {

    manager.current.rename(
      id,
      title
    );

    refresh();

  }

  function duplicateConversation(id: string) {

    const copy = manager.current.duplicate(id);

    refresh();

    if (copy) {
      setCurrentConversationId(copy.id);
    }

  }

  function addMessage(
    message: ChatMessage
  ) {

    manager.current.addMessage(
      currentConversation.id,
      message
    );

    refresh();

  }

  function updateLastMessage(
    text: string
  ) {

    manager.current.updateLastMessage(
      currentConversation.id,
      text
    );

    refresh();

  }

  function saveCurrentConversation() {

    const content =
      currentConversation.messages
        .map(
          message => message.text
        )
        .join("\n");

    saveConversation(

      currentConversation.id,

      currentConversation.title,

      content

    );

  }

  return (

    <ConversationContext.Provider

      value={{

        conversations,

        currentConversation,

        currentConversationId,

        setCurrentConversation:
          setCurrentConversationId,

        newConversation,

        deleteConversation,

        renameConversation,

        duplicateConversation,

        addMessage,

        updateLastMessage,

        saveCurrentConversation,

      }}

    >

      {children}

    </ConversationContext.Provider>

  );

}

export function useConversation() {

  const context =
    useContext(
      ConversationContext
    );

  if (!context) {

    throw new Error(
      "useConversation must be used inside ConversationProvider."
    );

  }

  return context;

}
