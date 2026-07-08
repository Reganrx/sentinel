import { useState } from "react";

function AIConsole() {
  const [messages, setMessages] = useState<string[]>([
    "Sentinel Initialising...",
    "Core Systems Online",
    "Voice Engine Ready",
    "Awaiting Commands..."
  ]);

  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, `> ${input}`]);
    setInput("");
  };

  return (
    <div className="console">
      <h2>AI Conversation</h2>

      <div className="terminal">
        {messages.map((message, index) => (
          <p key={index}>{message}</p>
        ))}
      </div>

      <div className="inputBar">
        <input
          type="text"
          placeholder="Type a command..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />

        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default AIConsole;