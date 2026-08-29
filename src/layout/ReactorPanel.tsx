import "./ReactorPanel.css";
import "../styles/glass.css";

import AICore from "../components/effects/AICore";

import { useSentinel } from "../state/SentinelContext";

export default function ReactorPanel() {
  const { state } = useSentinel();

  const statusText = {
    initialising: "INITIALISING",
    idle: "ONLINE",
    thinking: "THINKING",
    streaming: "STREAMING",
    listening: "LISTENING",
    offline: "OFFLINE",
  }[state];

  const activityWidth = {
    initialising: "18%",
    idle: "35%",
    thinking: "70%",
    streaming: "100%",
    listening: "50%",
    offline: "8%",
  }[state];

  return (
    <section className="reactor-panel glass">

      <div className="reactor-header">

        <h2>Sentinel Core</h2>

        <div className={`reactor-status ${state}`}>

          <span className="status-dot" />

          {statusText}

        </div>

      </div>

      <div className="reactor-core">

        <AICore size={260} />

      </div>

      <div className="reactor-metrics">

        <div className="metric">

          <span className="metric-value">48</span>

          <span className="metric-label">
            Nodes
          </span>

        </div>

        <div className="metric">

          <span className="metric-value">
            99.8%
          </span>

          <span className="metric-label">
            Stability
          </span>

        </div>

      </div>

      <div className="activity">

        <div className="activity-top">

          <span>AI Activity</span>

          <span>{statusText}</span>

        </div>

        <div className="activity-bar">

          <div
            className="activity-fill"
            style={{
              width: activityWidth,
            }}
          />

        </div>

      </div>

    </section>
  );
}
