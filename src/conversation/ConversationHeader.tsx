import "./ConversationHeader.css";

import { useConversation } from "./ConversationContext";

export default function ConversationHeader() {

  const {

    currentConversation,

    renameConversation,

    deleteConversation,

    saveCurrentConversation,

  } = useConversation();

  function rename() {

    const title = prompt(

      "Conversation name",

      currentConversation.title

    );

    if (!title) return;

    renameConversation(

      currentConversation.id,

      title

    );

  }

  function remove() {

    if (

      confirm(

        "Delete this conversation?"

      )

    ) {

      deleteConversation(

        currentConversation.id

      );

    }

  }

  return (

    <header className="conversation-header">

      <div>

        <h2>

          {currentConversation.title}

        </h2>

        <span>

          {

            currentConversation.messages.length

          } Messages

        </span>

      </div>

      <div className="conversation-actions">

        <button
          onClick={
            saveCurrentConversation
          }
        >
          ⭐ Save
        </button>

        <button
          onClick={rename}
        >
          ✏ Rename
        </button>

        <button
          onClick={remove}
        >
          🗑 Delete
        </button>

      </div>

    </header>

  );

}