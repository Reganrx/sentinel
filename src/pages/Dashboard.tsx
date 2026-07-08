import { useEffect, useState } from "react";

export default function Dashboard() {
  const [time, setTime] = useState("");
  const [bootComplete, setBootComplete] = useState(false);

  const bootSequence = [
    "Sentinel Initialising...",
    "Loading AI Core...",
    "Loading Voice Engine...",
    "Checking System Security...",
    "Connecting Services...",
    "All Systems Operational."
  ];

  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");

  // Live Clock
  useEffect(() => {
    const updateClock = () => {
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };

    updateClock();

    const timer = setInterval(updateClock, 1000);

    return () => clearInterval(timer);
  }, []);

  // Boot Animation
  useEffect(() => {
    let index = 0;

    const timer = setInterval(() => {
      setMessages((previous) => [...previous, bootSequence[index]]);

      index++;

      if (index >= bootSequence.length) {
        clearInterval(timer);
        setBootComplete(true);
      }
    }, 700);

    return () => clearInterval(timer);
  }, []);

  function sendMessage() {
    if (!input.trim()) return;

    setMessages((previous) => [...previous, `You: ${input}`]);

    setTimeout(() => {
      setMessages((previous) => [
        ...previous,
        "Sentinel: AI connection coming soon..."
      ]);
    }, 600);

    setInput("");
  }

  return (
    <div className="app">

      <header className="topbar">

        <div className="logo">
          🛡 SENTINEL
        </div>

        <div className="status">
          <span>🕒 {time}</span>
          <span>🟢 Online</span>
          <span>🔋100%</span>
        </div>

      </header>

      <div className="layout">

        <aside className="sidebar">

          <button>🏠 Dashboard</button>
          <button>🤖 AI</button>
          <button>🎤 Voice</button>
          <button>📁 Files</button>
          <button>📷 Cameras</button>
          <button>🎵 Music</button>
          <button>⚙ Settings</button>

        </aside>

        <main className="content">

          <section className="cards">

            <div className="card">
              <h2>🛡 Sentinel Core</h2>
              <p>ONLINE</p>
            </div>

            <div className="card">
              <h2>🎤 Voice</h2>
              <p>Listening...</p>
            </div>

            <div className="card">
              <h2>🧠 AI Engine</h2>
              <p>{bootComplete ? "READY" : "BOOTING..."}</p>
            </div>

            <div className="card">
              <h2>🌦 Weather</h2>
              <p>Loading...</p>
            </div>

          </section>

          <section className="console">

            <h2>AI Conversation</h2>

            <div className="terminal">

              {messages.map((message, index) => (
                <p key={index}>
                  &gt; {message}
                </p>
              ))}

              <span className="cursor">▋</span>

            </div>

            <div className="inputBar">

              <input
                placeholder="Talk to Sentinel..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
              />

              <button onClick={sendMessage}>
                Send
              </button>

            </div>

          </section>

        </main>

      </div>

    </div>
  );
}