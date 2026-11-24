export function ToolCallItem({ tool, label, status = "running", summary }) {
  return (
    <div className="my-1 bg-white border border-slate-200 rounded p-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${status === "running" ? "bg-amber-500 animate-pulse" : "bg-emerald-600"}`}></span>
          <span className="font-medium text-slate-800">{label || tool}</span>
        </div>
        <div>
          {status === "running" ? (
            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-mono">
              executing
            </span>
          ) : (
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">
              done
            </span>
          )}
        </div>
      </div>

      {summary && (
        <div className="mt-1 text-[11px] text-slate-500 pl-3.5 border-l border-slate-200">
          {summary}
        </div>
      )}
    </div>
  );
}
