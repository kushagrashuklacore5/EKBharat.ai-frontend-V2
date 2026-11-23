import { ReactNode } from "react";

// Renders the proctoring app on a tablet screen (pure-CSS tablet, landscape).
// The screen is a non-scrolling flex area — content is laid out to fit.
export function TabletFrame({ children }: { children: ReactNode }) {
  return (
    <div className="tablet-wrap">
      <div className="tablet">
        <span className="tablet-camera" />
        <div className="tablet-screen">{children}</div>
      </div>
    </div>
  );
}
