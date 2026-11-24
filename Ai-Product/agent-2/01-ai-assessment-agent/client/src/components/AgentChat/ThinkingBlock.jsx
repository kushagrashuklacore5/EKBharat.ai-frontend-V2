import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export function ThinkingBlock({ content, isLive = false }) {
  const [expanded, setExpanded] = useState(true);

  if (!content) return null;

  return (
    <div className="my-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 transition-all">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left font-medium text-slate-700 hover:text-slate-900 focus:outline-none cursor-pointer"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#B99652]"></span>
        <span>Agent Reasoning</span>
        {isLive && (
          <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#1e1b4b] text-white">
            running
          </span>
        )}
        <span className="ml-auto text-slate-400">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 text-slate-700 font-mono text-[11px] leading-relaxed whitespace-pre-wrap bg-white p-2 rounded border border-slate-200">
          {content}
        </div>
      )}
    </div>
  );
}
