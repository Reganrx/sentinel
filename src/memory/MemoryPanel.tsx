import "./MemoryPanel.css";

import { useMemo, useState } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";

import MemoryCard from "./MemoryCard";
import { useMemory } from "./MemoryContext";
import type { MemoryCategory, MemoryItem } from "./MemoryTypes";

const categories: Array<MemoryCategory | "all"> = [
  "all",
  "conversation",
  "preference",
  "project",
  "system",
];

export default function MemoryPanel() {
  const {
    memories,
    closeMemory,
    addMemory,
    removeMemory,
    togglePinned,
  } = useMemory();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MemoryCategory | "all">("all");
  const [selected, setSelected] = useState<MemoryItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return memories.filter(memory =>
      (category === "all" || memory.category === category) &&
      (!needle || `${memory.title} ${memory.content} ${memory.tags.join(" ")}`.toLowerCase().includes(needle))
    );
  }, [category, memories, query]);

  function createMemory() {
    if (!title.trim() || !content.trim()) return;

    addMemory({
      id: crypto.randomUUID(),
      title: title.trim(),
      content: content.trim(),
      category: "preference",
      created: new Date().toLocaleDateString(),
      updated: "Just now",
      pinned: false,
      tags: ["manual"],
    });

    setTitle("");
    setContent("");
    setAdding(false);
  }

  function removeSelected() {
    if (!selected) return;
    removeMemory(selected.id);
    setSelected(null);
  }

  return (
    <aside className="memory-panel">
      <header className="memory-panel-header">
        <div><p>CONTEXT VAULT</p><h2>Memory</h2><span>{memories.length} saved items</span></div>
        <button className="memory-close" type="button" onClick={closeMemory} aria-label="Close memory"><X size={18} /></button>
      </header>

      <div className="memory-controls">
        <label className="memory-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search memories" /></label>
        <div className="memory-filters">{categories.map(item => <button key={item} type="button" className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <button className="memory-add" type="button" onClick={() => setAdding(open => !open)}><Plus size={17} /> Add memory</button>
      </div>

      {adding && <form className="memory-compose" onSubmit={event => { event.preventDefault(); createMemory(); }}><input value={title} onChange={event => setTitle(event.target.value)} placeholder="What should Sentinel remember?" /><textarea value={content} onChange={event => setContent(event.target.value)} placeholder="Add the detail that will be useful later…" rows={3} /><div><button type="button" onClick={() => setAdding(false)}>Cancel</button><button type="submit">Save memory</button></div></form>}

      <div className="memory-list">
        {filtered.length === 0 ? <div className="memory-empty"><Search size={28} /><h3>No matching memories</h3><p>Saved chats, preferences, and notes will appear here.</p></div> : filtered.map(memory => <MemoryCard key={memory.id} memory={memory} selected={selected?.id === memory.id} onClick={setSelected} />)}
      </div>

      {selected && <section className="memory-detail"><div className="memory-detail-top"><span>{selected.category}</span><div><button type="button" onClick={() => togglePinned(selected.id)}>{selected.pinned ? "Unpin" : "Pin"}</button><button type="button" className="memory-delete" onClick={removeSelected} aria-label="Delete memory"><Trash2 size={16} /></button></div></div><h3>{selected.title}</h3><p>{selected.content}</p><small>Updated {selected.updated}</small></section>}
    </aside>
  );
}
