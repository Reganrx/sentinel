type Props = { sender: "user" | "sentinel" };

export default function MessageAvatar({ sender }: Props) {
  return (
    <div className="avatar">
      {sender === "user" ? "🙂" : "🛡️"}
    </div>
  );
}
