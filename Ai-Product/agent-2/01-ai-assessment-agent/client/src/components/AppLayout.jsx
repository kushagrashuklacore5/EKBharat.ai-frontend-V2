import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, Sparkles } from "lucide-react";
import { useAuth } from "../auth/auth";
import NotificationBell from "./NotificationBell";

/*
 * Standalone replacement for the LMS's MentorLayout / StudentLayout (sidebar, header, branding).
 * Keep the page content exactly as the LMS rendered it; only the frame is simpler.
 */
const LINKS = {
  mentor: [
    { to: "/teacher/assessments", label: "AI Assessments" },
    { to: "/teacher/assessments/assignments", label: "Assignments" },
  ],
  student: [
    { to: "/student/assessment-agent/tests", label: "My Tests" },
    { to: "/student/assessment-agent/assignments", label: "My Assignments" },
  ],
};

export default function AppLayout({ children }) {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const links = LINKS[user?.role === "student" ? "student" : "mentor"];
  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#172e42]">
      <header className="bg-white/95 backdrop-blur-md border-b border-[#e5d8b8] shadow-[0_2px_15px_rgba(185,150,82,0.07)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 font-serif font-bold text-lg text-[#172e42] tracking-wide">
              <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-[#b99652] to-[#9a6f22] text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </span>
              <span>AI Assessment Agent</span>
            </div>
            <nav className="flex gap-1.5 text-xs sm:text-sm font-medium">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg transition-all ${
                      isActive
                        ? "bg-[#faf5ea] text-[#9a6f22] font-semibold border border-[#e5d8b8] shadow-2xs"
                        : "text-[#55697a] hover:text-[#172e42] hover:bg-[#faf6ee]"
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <NotificationBell />
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#faf5ea] border border-[#e5d8b8] text-[#9a6f22] font-mono text-xs font-medium">
              <span>{user?.name}</span>
              <span className="text-[#c9b489]">·</span>
              <span className="font-semibold">{user?.role === "student" ? "Student" : "Teacher"}</span>
            </span>
            <button
              type="button"
              onClick={() => { logoutUser(); navigate("/login"); }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[#6e7f8d] hover:text-[#b84848] hover:bg-rose-50 rounded-lg transition text-xs font-medium"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  );
}
