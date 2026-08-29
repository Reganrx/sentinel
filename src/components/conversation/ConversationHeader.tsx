import { useState } from "react";

import "../../conversation/ConversationHeader.css";

import {
  MoreHorizontal,
  Star,
  Pencil,
  Trash2,
  CopyPlus,
} from "../../shared/icons";

import { useConversation } from "../../conversation/ConversationContext";

import DropdownMenu from "../ui/DropdownMenu";
import IconButton from "../ui/IconButton";

export default function ConversationHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState("");

  const {
    currentConversation,
    renameConversation,
    deleteConversation,
    duplicateConversation,
    saveCurrentConversation,
  } = useConversation();

  function handleSave() {
    saveCurrentConversation();
    setMenuOpen(false);
    setNotice("Conversation saved to Context Vault");
  }

  function openRename() {
    setMenuOpen(false);
    setTitle(currentConversation.title);
    setDialog("rename");
  }

  function handleRename(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    renameConversation(currentConversation.id, title.trim());
    setDialog(null);
    setNotice("Conversation renamed");
  }

  function handleDuplicate() {
    duplicateConversation(currentConversation.id);
    setMenuOpen(false);
    setNotice("Conversation duplicated");
  }

  function openDelete() {
    setMenuOpen(false);
    setDialog("delete");
  }

  function handleDelete() {
    deleteConversation(currentConversation.id);
    setDialog(null);
  }

  return (
    <header className="conversation-header">

      <div className="conversation-info">

        <h2>{currentConversation.title}</h2>

        <p>
          {currentConversation.messages.length}
          {" "}
          message
          {currentConversation.messages.length !== 1 ? "s" : ""}
        </p>

      </div>

      {notice && <div className="conversation-toast" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}

      <div className="conversation-menu">

        <IconButton
          icon={<MoreHorizontal size={20} />}
          title="Conversation Options"
          active={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        />

        <DropdownMenu
          open={menuOpen}
          items={[
            {
              icon: <Star size={16} />,
              label: "Save Conversation",
              onClick: handleSave,
            },
            {
              icon: <Pencil size={16} />,
              label: "Rename",
              onClick: openRename,
            },
            {
              icon: <CopyPlus size={16} />,
              label: "Duplicate",
              onClick: handleDuplicate,
            },
            {
              icon: <Trash2 size={16} />,
              label: "Delete Conversation",
              danger: true,
              onClick: openDelete,
            },
          ]}
        />

      </div>

      {dialog && <div className="conversation-dialog-backdrop" role="presentation" onMouseDown={() => setDialog(null)}>
        <div className="conversation-dialog" role="dialog" aria-modal="true" aria-labelledby="conversation-dialog-title" onMouseDown={event => event.stopPropagation()}>
          {dialog === "rename" ? <form onSubmit={handleRename}>
            <h3 id="conversation-dialog-title">Rename conversation</h3>
            <p>Choose a clear name so it is easy to find in Context Vault.</p>
            <input autoFocus value={title} maxLength={80} onChange={event => setTitle(event.target.value)} />
            <div className="conversation-dialog-actions"><button type="button" onClick={() => setDialog(null)}>Cancel</button><button className="conversation-dialog-primary" type="submit">Save name</button></div>
          </form> : <>
            <h3 id="conversation-dialog-title">Delete this conversation?</h3>
            <p>“{currentConversation.title}” and its messages will be removed from this device. This cannot be undone.</p>
            <div className="conversation-dialog-actions"><button onClick={() => setDialog(null)}>Cancel</button><button className="conversation-dialog-danger" onClick={handleDelete}>Delete conversation</button></div>
          </>}
        </div>
      </div>}

    </header>
  );
}
