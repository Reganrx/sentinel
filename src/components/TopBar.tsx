import { useEffect, useState } from "react";

function TopBar() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();

      setTime(
        now.toLocaleTimeString([], {
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

  return (
    <header className="topbar">
      <div className="logo">
        🛡 SENTINEL
      </div>

      <div className="status">
        <span>🕒 {time}</span>
        <span>📶 Online</span>
        <span>🔋 100%</span>
      </div>
    </header>
  );
}

export default TopBar;