export function StudyPlanCard({ plan }) {
  if (!plan) return null;

  return (
    <div className="my-3 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs text-xs">
      {/* Header matching #1e1b4b & #B99652 */}
      <div className="bg-[#1e1b4b] text-white p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-[#B99652] font-medium">Adaptive Recovery Plan</span>
          <span className="bg-white/10 text-white font-medium px-2 py-0.5 rounded text-[11px]">
            {plan.estimatedHours || "3 days"}
          </span>
        </div>
        <h4 className="font-semibold text-sm text-white">{plan.planTitle || "Personalized Micro-Study Plan"}</h4>
      </div>

      {/* Modules */}
      <div className="p-3 space-y-2.5">
        {plan.modules &&
          plan.modules.map((m, idx) => (
            <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-slate-900">{m.day}</span>
                <span className="text-[10px] bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                  {m.focus}
                </span>
              </div>
              <p className="text-slate-700 text-[11px] leading-relaxed mb-2">{m.action}</p>

              {/* Action Links */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200">
                {m.youtubeUrl && (
                  <a
                    href={m.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white font-medium text-[11px] hover:bg-rose-700 transition-colors cursor-pointer"
                  >
                    YouTube Lecture
                  </a>
                )}
                {m.articleUrl && (
                  <a
                    href={m.articleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-medium text-[11px] hover:bg-slate-100 transition-colors"
                  >
                    {m.articleTitle || "Read Article"}
                  </a>
                )}
              </div>
            </div>
          ))}

        {/* Tutorial Agent Integration Note */}
        <div className="mt-3 p-2.5 bg-slate-100 border border-slate-200 rounded text-slate-800">
          <div className="font-medium text-[11px] text-[#1e1b4b] mb-1">
            Connected Module: Socratic Tutorial Agent (Product 04)
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            {plan.upcomingHandoff ||
              "Student can proceed directly to interactive 1-on-1 tutoring on these specific weak topics."}
          </p>
        </div>
      </div>
    </div>
  );
}
