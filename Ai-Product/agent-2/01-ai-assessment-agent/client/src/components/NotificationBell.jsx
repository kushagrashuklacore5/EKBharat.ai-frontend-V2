import { useState, useEffect, useRef } from "react";
import { Bell, Check, ExternalLink } from "lucide-react";
import { API_BASE } from "../config/api";
import { useAuth } from "../auth/auth";

export default function NotificationBell() {
  const { token, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/agent/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 4000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = async () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      try {
        await fetch(`${API_BASE}/agent/notifications/read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
        setUnreadCount(0);
      } catch (e) {}
    }
  };

  if (user?.role === "student") return null;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleOpen}
        title="Teacher Notifications"
        className="relative p-1.5 rounded hover:bg-white/10 text-white transition-colors cursor-pointer flex items-center justify-center"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-slate-200" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#B99652] text-slate-900 font-bold rounded-full text-[10px] flex items-center justify-center shadow-xs">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 z-50 text-slate-900 text-xs overflow-hidden animate-in fade-in duration-100">
          <div className="bg-[#1e1b4b] text-white p-2.5 flex items-center justify-between">
            <span className="font-semibold text-xs text-[#B99652]">Teacher Notifications</span>
            <span className="text-[10px] text-slate-300 font-mono">Real-time</span>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                No recent student notifications.
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`p-3 hover:bg-slate-50 transition-colors ${!n.read ? "bg-amber-50/40" : ""}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900 text-xs">{n.title}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(n.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-snug">
                    <strong className="text-slate-800">{n.studentName}</strong> submitted{" "}
                    <em>"{n.assessmentTitle}"</em>.
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      Score: {n.score}/{n.total} ({n.percentage}%)
                    </span>
                    <span className="text-indigo-900 font-semibold hover:underline cursor-pointer">
                      Report ready
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
