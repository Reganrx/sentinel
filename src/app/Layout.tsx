import "./Layout.css";
import "../components/PageErrorBoundary.css";

import Sidebar from "../components/Sidebar/Sidebar";

import HomeView from "../pages/Home/HomeView";
import SystemStatusBar from "../components/SystemStatusBar";
import QuickChatBar from "../pages/Home/components/QuickChatBar";
import PageErrorBoundary from "../components/PageErrorBoundary";

import {
  useNavigation,
} from "../navigation/NavigationContext";
import { lazy, Suspense, useState } from "react";

const ChatView = lazy(() => import("../pages/chat/ChatView"));
const WeatherView = lazy(() => import("../pages/Weather/WeatherView"));
const NavigationView = lazy(() => import("../pages/Navigation/NavigationView"));
const DeviceScannerView = lazy(() => import("../pages/DeviceScanner/DeviceScannerView"));
const MediaControlView = lazy(() => import("../pages/Media/MediaControlView"));
const AutomationView = lazy(() => import("../pages/Automation/AutomationView"));
const SystemView = lazy(() => import("../pages/System/SystemView"));
const SettingsView = lazy(() => import("../pages/Settings/SettingsView"));
const NotificationsView = lazy(() => import("../pages/Notifications/NotificationsView"));
const TravelView = lazy(() => import("../pages/Travel/TravelView"));
const DesignView = lazy(() => import("../pages/Design/DesignView"));
const ConciergeView = lazy(() => import("../pages/Concierge/ConciergeView"));

export default function Layout() {

  const {

    view,

    navigate,

  } = useNavigation();

  const [focusMode, setFocusMode] = useState(false);

  function renderView() {

    switch (view) {

      case "home":

        return <HomeView />;

      case "chat":

        return <ChatView />;

      case "concierge":

        return import.meta.env.VITE_SENTINEL_EDITION === "base" ? <HomeView /> : <ConciergeView />;

      case "design":

        return import.meta.env.VITE_SENTINEL_EDITION === "base" ? <HomeView /> : <DesignView />;

      case "weather":

        return <WeatherView />;

      case "navigation":

        return <NavigationView />;

      case "scanner":

        return <DeviceScannerView />;

      case "media":

        return <MediaControlView />;

      case "automation":

        return <AutomationView />;

      case "system":

        return <SystemView />;

      case "notifications":

        return <NotificationsView />;

      case "settings":

        return <SettingsView />;

      case "travel":

        return <TravelView />;

      default:

        return <HomeView />;

    }

  }

  return (

    <div className={`layout ${focusMode ? "layout--focus" : ""}`}>

      <Sidebar

        currentPage={view}

        onNavigate={navigate}

      />

      <main className="content">

        <SystemStatusBar focusMode={focusMode} onToggleFocus={() => setFocusMode(value => !value)} />

        <div className="content-body">
          <PageErrorBoundary key={view} onReset={() => navigate("home")}>
            <Suspense fallback={<div className="page-loading">Loading Sentinel module…</div>}>
              {renderView()}
            </Suspense>
          </PageErrorBoundary>
        </div>
        <QuickChatBar />

      </main>

    </div>

  );

}
