import "./MemoryCard.css";

import { Brain, Pin } from "lucide-react";
import type { MemoryItem } from "./MemoryTypes";

type Props = {
  memory: MemoryItem;
  selected?: boolean;
  onClick?: (memory: MemoryItem) => void;
};

export default function MemoryCard({ memory, selected = false, onClick }: Props) {
  return <button className={selected ? "memory-card selected" : "memory-card"} type="button" onClick={() => onClick?.(memory)}><div className="memory-card-header"><span className="memory-icon"><Brain size={17} /></span>{memory.pinned && <span className="memory-pin"><Pin size={14} /></span>}</div><h3>{memory.title}</h3><p>{memory.summary || memory.content}</p><div className="memory-footer"><span>{memory.category}</span><span>{memory.updated}</span></div></button>;
}
