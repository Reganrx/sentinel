import "./StatusBadge.css";

type StatusType =
  | "online"
  | "offline"
  | "warning"
  | "thinking"
  | "listening"
  | "streaming";

interface StatusBadgeProps {

  status: StatusType;

  text?: string;

}

const LABELS: Record<StatusType, string> = {

  online: "ONLINE",

  offline: "OFFLINE",

  warning: "WARNING",

  thinking: "THINKING",

  listening: "LISTENING",

  streaming: "STREAMING",

};

export default function StatusBadge({

  status,

  text,

}: StatusBadgeProps) {

  return (

    <div

      className={`status-badge ${status}`}

    >

      <span className="status-dot" />

      <span>

        {text ?? LABELS[status]}

      </span>

    </div>

  );

}