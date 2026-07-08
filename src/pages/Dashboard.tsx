import TopBar from "../components/TopBar";
import Sidebar from "../components/Sidebar";
import StatusCard from "../components/StatusCard";
import AIChat from "../components/AIChat";

export default function Dashboard() {
  return (
    <div className="dashboard">
      <TopBar />
      <div className="dashboard-content">
        <Sidebar />
        <main className="dashboard-main">
          <section className="status-grid">
            <StatusCard title="Sentinel Core" icon="🛡️" status="ONLINE" />
            <StatusCard title="Voice" icon="🎤" status="Listening..." />
            <StatusCard title="AI Engine" icon="🧠" status="Ready" />
            <StatusCard title="Weather" icon="🌦️" status="Loading..." />
          </section>
          <AIChat />
        </main>
      </div>
    </div>
  );
}
