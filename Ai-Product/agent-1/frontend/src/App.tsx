import { LiveProctorView } from "./components/LiveProctorView";
import { TabletFrame } from "./components/TabletFrame";

export function App() {
  return (
    <TabletFrame>
      <div className="app">
        <header className="appbar">
          <span className="appbar-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l8 3v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V5l8-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </span>
          <div className="appbar-txt">
            <div className="appbar-name">Anti-Cheat Agent</div>
            <div className="appbar-sub">AI exam monitoring</div>
          </div>
          <span className="appbar-status"><span className="appbar-pulse" /> Secure</span>
        </header>
        <LiveProctorView />
      </div>
    </TabletFrame>
  );
}
