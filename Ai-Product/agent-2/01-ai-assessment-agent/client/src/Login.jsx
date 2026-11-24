import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, CheckCircle2, ShieldCheck, ArrowRight, UserCheck, GraduationCap } from "lucide-react";
import { useAuth } from "./auth/auth";
import { API_BASE } from "./config/api";

export default function Login() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(null);
  const [ai, setAi] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/demo/accounts`).then((r) => (r.ok ? r.json() : null)).then(setDemo).catch(() => { });
    fetch(`${API_BASE}/health`).then((r) => r.json()).then((h) => setAi(h.ai)).catch(() => { });
  }, []);

  const signIn = async (e, as) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = await loginUser(as?.email ?? email, as?.password ?? password);
      navigate(u.role === "student" ? "/student/assessment-agent/tests" : "/teacher/assessments");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-3 sm:p-6 relative overflow-hidden">
      {/* Ambient background gold glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#b99652]/15 via-[#ecdcb5]/20 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Wide 2-Column Luxury Login Card */}
      <div className="relative z-10 w-full max-w-4xl bg-white/95 backdrop-blur-md border border-[#e5d8b8] shadow-[0_15px_50px_rgba(185,150,82,0.12)] rounded-3xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
        
        {/* Left Column: Branding, Features & One-Click Role Launchers */}
        <div className="md:col-span-6 bg-gradient-to-b from-[#faf5ea] via-[#f7f0df] to-[#faf5ea] p-6 sm:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#ebdcaa]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-[#b99652] to-[#9a6f22] text-white shadow-md shadow-[#b99652]/20">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-serif font-bold text-[#172e42] tracking-tight">AI Assessment Agent</h2>
                <p className="text-xs text-[#8f7035] font-medium">Evaluation &amp; Assessment Studio</p>
              </div>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-[#55697a] leading-relaxed">
              Objective, rubric-grounded AI evaluation with instant curriculum-aligned test generation and anti-tamper autosave.
            </p>

            <div className="mt-4 space-y-2 text-xs text-[#617482]">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-[#b99652] shrink-0" />
                <span>Automated multi-criteria rubric scoring</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-[#b99652] shrink-0" />
                <span>Bloom&apos;s Taxonomy &amp; curriculum alignment</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-[#b99652] shrink-0" />
                <span>Zero-wait student submission analytics</span>
              </div>
            </div>
          </div>

          {demo && (
            <div className="mt-6 pt-5 border-t border-[#ebdcaa]">
              <div className="flex items-center justify-between text-xs text-[#758694] font-medium mb-2.5">
                <span>⚡ 1-Click Instant Demo Launch:</span>
                <span className="font-mono text-[10px] text-[#9a6f22] bg-[#fff] px-2 py-0.5 rounded-md border border-[#ebdcaa]">
                  pwd: {demo.password}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#9a6f22] w-14 shrink-0 flex items-center gap-1">
                    <UserCheck size={11} /> Teacher:
                  </span>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {demo.teachers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={(e) => signIn(e, { email: u.email, password: demo.password })}
                        className="text-xs bg-white hover:bg-[#b99652] text-[#8f7035] hover:text-white border border-[#ebdcaa] px-2.5 py-1 rounded-lg font-medium transition shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <span>{u.name.split(" ")[0]}</span>
                        <ArrowRight size={10} className="opacity-60" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#9a6f22] w-14 shrink-0 flex items-center gap-1">
                    <GraduationCap size={11} /> Student:
                  </span>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {demo.students.slice(0, 3).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={(e) => signIn(e, { email: u.email, password: demo.password })}
                        className="text-xs bg-white hover:bg-[#b99652] text-[#8f7035] hover:text-white border border-[#ebdcaa] px-2.5 py-1 rounded-lg font-medium transition shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <span>{u.name.split(" ")[0]}</span>
                        <ArrowRight size={10} className="opacity-60" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sign In Form */}
        <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-center">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-[#172e42]">Sign In</h3>
            <p className="text-xs text-[#758694]">Enter your credentials or choose a quick role</p>
          </div>

          {ai && (
            <div className="mb-4 text-xs px-3 py-2 rounded-xl border font-mono flex items-center gap-2 bg-[#faf5ea] border-[#e5d8b8] text-[#9a6f22]">
              <ShieldCheck size={13} className="shrink-0 text-[#b99652]" />
              <span className="truncate">
                {ai.configured ? "Enterprise AI Evaluation Engine Online" : "AI mode active"}
              </span>
            </div>
          )}

          <form onSubmit={signIn} className="space-y-3.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#55697a]">
              Email Address
              <input
                className="mt-1 w-full border border-[#d9ccb0] focus:border-[#b99652] focus:ring-1 focus:ring-[#b99652] rounded-xl px-3.5 py-2.5 bg-[#fdfbf9] text-[#172e42] text-sm outline-none transition"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@demo.local"
                required
                autoComplete="username"
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-wider text-[#55697a]">
              Password
              <input
                className="mt-1 w-full border border-[#d9ccb0] focus:border-[#b99652] focus:ring-1 focus:ring-[#b99652] rounded-xl px-3.5 py-2.5 bg-[#fdfbf9] text-[#172e42] text-sm outline-none transition"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </label>

            {error && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-lg" role="alert">
                {error}
              </p>
            )}

            <button
              disabled={busy}
              className="w-full mt-2 bg-gradient-to-r from-[#b99652] via-[#c9a764] to-[#9a6f22] hover:brightness-105 text-white py-2.5 rounded-xl font-bold text-sm shadow-[0_2px_12px_rgba(185,150,82,0.3)] transition disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{busy ? "Signing in..." : "Enter Assessment Portal"}</span>
              <ArrowRight size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
