import {
  createContext,
  ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

import { MemoryItem } from "./MemoryTypes";
import { MemoryManager } from "./MemoryManager";

type MemoryContextType = {
  memories: MemoryItem[];

  memoryOpen: boolean;

  openMemory: () => void;

  closeMemory: () => void;

  toggleMemory: () => void;

  addMemory: (memory: MemoryItem) => void;

  updateMemory: (memory: MemoryItem) => void;

  removeMemory: (id: string) => void;

  togglePinned: (id: string) => void;

  clearMemories: () => void;

  findMemory: (
    id: string
  ) => MemoryItem | undefined;

  saveConversation: (
    conversationId: string,
    title: string,
    content: string
  ) => void;
};

const MemoryContext =
  createContext<MemoryContextType | null>(
    null
  );

export function MemoryProvider({
  children,
}: {
  children: ReactNode;
}) {

  const manager = useMemo(() => {

    const store =
      new MemoryManager();

    if (
      store.getAll().length === 0
    ) {

      store.add({

        id: crypto.randomUUID(),

        title:"Welcome to Sentinel",

        content:
          "Sentinel will remember important conversations, projects and preferences.",

        category:"system",

        created:
          new Date().toLocaleDateString(),

        updated:"Just now",

        pinned:true,

        tags:[
          "system",
          "welcome",
        ],

      });

    }

    return store;

  }, []);

  const [memories,setMemories] =
    useState(
      manager.getAll()
    );

  const [
    memoryOpen,
    setMemoryOpen,
  ] = useState(false);

  function refresh(){

    setMemories([
      ...manager.getAll(),
    ]);

  }

  function openMemory(){

    setMemoryOpen(true);

  }

  function closeMemory(){

    setMemoryOpen(false);

  }

  function toggleMemory(){

    setMemoryOpen(
      previous => !previous
    );

  }

  function addMemory(
    memory:MemoryItem
  ){

    manager.add(memory);

    refresh();

  }

  function updateMemory(
    memory:MemoryItem
  ){

    manager.update(memory);

    refresh();

  }

  function removeMemory(
    id:string
  ){

    manager.remove(id);

    refresh();

  }

  function togglePinned(
    id:string
  ){

    manager.togglePinned(id);

    refresh();

  }

  function clearMemories(){

    manager.clear();

    refresh();

  }

  function findMemory(
    id:string
  ){

    return manager.find(id);

  }

  function saveConversation(

    conversationId:string,

    title:string,

    content:string

  ){

    manager.createConversationMemory(

      conversationId,

      title,

      content

    );

    refresh();

  }

  return(

    <MemoryContext.Provider

      value={{

        memories,

        memoryOpen,

        openMemory,

        closeMemory,

        toggleMemory,

        addMemory,

        updateMemory,

        removeMemory,

        togglePinned,

        clearMemories,

        findMemory,

        saveConversation,

      }}

    >

      {children}

    </MemoryContext.Provider>

  );

}

export function useMemory(){

  const context =
    useContext(
      MemoryContext
    );

  if(!context){

    throw new Error(
      "useMemory must be used inside MemoryProvider."
    );

  }

  return context;

}