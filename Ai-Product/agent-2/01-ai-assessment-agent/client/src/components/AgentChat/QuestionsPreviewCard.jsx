import { useState } from "react";
import { Check, HelpCircle, Layers, Clock, BookOpen, Printer, FileText } from "lucide-react";

export function QuestionsPreviewCard({ preview }) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (!preview || !preview.questions || preview.questions.length === 0) return null;

  const currentQ = preview.questions[selectedIdx] || preview.questions[0];

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=850,height=1000");
    if (!printWindow) {
      alert("Please allow popups to print/download the exam paper.");
      return;
    }

    const schoolName = "DELHI PUBLIC SCHOOL";
    const subject = preview.subject || "General Science";
    const className = preview.className || "Grade 8 - A";
    const duration = preview.durationMinutes || 15;
    const totalMarks = preview.questions.length;
    const title = preview.title || "Diagnostic Assessment";

    const questionsHtml = preview.questions
      .map((q, idx) => {
        const optionsHtml = (q.options || [])
          .map((opt, oIdx) => {
            const letter = String.fromCharCode(65 + oIdx);
            return `<div style="margin-bottom: 6px; padding-left: 10px; display: flex; align-items: center;">
              <span style="display:inline-block; width: 22px; height: 22px; border: 1.5px solid #4b5563; border-radius: 50%; text-align: center; line-height: 20px; font-weight: 600; font-size: 11px; margin-right: 10px;">${letter}</span>
              <span>${opt.text}</span>
            </div>`;
          })
          .join("");

        return `
          <div style="margin-bottom: 22px; page-break-inside: avoid;">
            <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px; line-height: 1.4;">
              Q${idx + 1}. ${q.questionText} <span style="float: right; font-weight: normal; font-size: 12px; color: #64748b;">[1 Mark]</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-left: 8px;">
              ${optionsHtml}
            </div>
          </div>
        `;
      })
      .join("");

    const answerKeyHtml = preview.questions
      .map((q, idx) => {
        const correctOpt = (q.options || []).find((o) => o.isCorrect) || q.options?.[0];
        const correctIdx = (q.options || []).indexOf(correctOpt);
        const correctLetter = correctIdx >= 0 ? String.fromCharCode(65 + correctIdx) : "A";
        return `
          <div style="margin-bottom: 12px; font-size: 12px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 8px;">
            <strong>Q${idx + 1}: (${correctLetter}) ${correctOpt?.text || ""}</strong><br/>
            <span style="color: #475569; font-style: italic;">Explanation: ${q.explanation || "Direct conceptual question"}</span>
          </div>
        `;
      })
      .join("");

    const docContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - ${className}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            padding: 30px 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 18px;
          }
          .school-title {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin: 0 0 4px 0;
          }
          .exam-title {
            font-size: 15px;
            font-weight: 600;
            color: #334155;
            margin: 0 0 8px 0;
          }
          .meta-table {
            width: 100%;
            font-size: 12px;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          .meta-table td {
            padding: 4px 6px;
          }
          .student-info {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            border: 1px solid #cbd5e1;
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            background: #f8fafc;
          }
          .btn-print {
            background: #4f46e5;
            color: #fff;
            padding: 8px 16px;
            border-radius: 6px;
            border: none;
            font-weight: 600;
            cursor: pointer;
            margin-bottom: 20px;
          }
          .teacher-key {
            page-break-before: always;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px dashed #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align: right;">
          <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
        </div>

        <div class="header">
          <div class="school-title">${schoolName}</div>
          <div class="exam-title">${title}</div>
          <table class="meta-table">
            <tr>
              <td><strong>Class:</strong> ${className}</td>
              <td style="text-align: center;"><strong>Subject:</strong> ${subject}</td>
              <td style="text-align: right;"><strong>Max Marks:</strong> ${totalMarks}</td>
            </tr>
            <tr>
              <td><strong>Time Allowed:</strong> ${duration} Minutes</td>
              <td style="text-align: center;"><strong>Session:</strong> 2026-27</td>
              <td style="text-align: right;"><strong>Paper Code:</strong> AIA-${preview.assessmentId || 101}</td>
            </tr>
          </table>
        </div>

        <div class="student-info">
          <div><strong>Student Name:</strong> _____________________________</div>
          <div><strong>Roll No:</strong> __________</div>
          <div><strong>Date:</strong> ____________</div>
        </div>

        <div style="font-size: 11px; color: #475569; margin-bottom: 18px;">
          <em><strong>Instructions:</strong> Read each question carefully. Darken the circle or tick the box corresponding to the single best answer. All questions carry equal marks.</em>
        </div>

        ${questionsHtml}

        <div class="teacher-key">
          <div style="text-align: center; margin-bottom: 15px;">
            <h3 style="margin: 0; font-size: 16px; text-transform: uppercase;">Teacher's Answer Key & Marking Guide</h3>
            <span style="font-size: 11px; color: #64748b;">(Confidential - For Evaluator Reference Only)</span>
          </div>
          ${answerKeyHtml}
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(docContent);
    printWindow.document.close();
  };

  const formattedSchedule = preview.opensAt
    ? new Date(preview.opensAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="my-3 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
      {/* Header matching #1e1b4b & #B99652 */}
      <div className="bg-[#1e1b4b] text-white p-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-medium text-[#B99652]">
            {preview.subject || "Subject"} · {preview.className || "Class"}
          </span>
          <div className="flex items-center gap-2">
            <span className="bg-white/10 px-2 py-0.5 rounded text-[11px] text-slate-200">
              {preview.durationMinutes || 15} mins
            </span>
            <button
              type="button"
              onClick={handlePrint}
              title="Print exam paper or save as PDF"
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium border border-white/20 transition-all cursor-pointer"
            >
              Print / PDF
            </button>
          </div>
        </div>
        <h4 className="font-semibold text-sm text-white line-clamp-1">{preview.title || "Assessment Preview"}</h4>
        {formattedSchedule && (
          <div className="mt-1 text-[11px] text-[#B99652] font-mono">
            Scheduled to open: {formattedSchedule}
          </div>
        )}
      </div>

      {/* Question tabs */}
      <div className="flex items-center justify-between p-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="text-[11px] text-slate-500 font-medium mr-1">Questions:</span>
          {preview.questions.map((q, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedIdx(i)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${selectedIdx === i
                ? "bg-[#1e1b4b] text-white"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
            >
              Q{i + 1}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="text-[11px] text-[#1e1b4b] font-medium hover:underline shrink-0 ml-2 cursor-pointer"
        >
          Exam Sheet
        </button>
      </div>

      {/* Selected question view */}
      <div className="p-3 text-xs">
        <div className="flex items-start gap-2 mb-3">
          <span className="font-bold text-[#1e1b4b] bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
            Q{selectedIdx + 1}
          </span>
          <p className="font-medium text-slate-900 leading-snug">{currentQ.questionText}</p>
        </div>

        {/* Options */}
        <div className="space-y-1.5 mb-3">
          {currentQ.options &&
            currentQ.options.map((opt, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx);
              return (
                <div
                  key={optIdx}
                  className={`p-2 rounded border text-xs flex items-center gap-2 ${opt.isCorrect
                    ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-medium"
                    : "bg-white border-slate-200 text-slate-700"
                    }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${opt.isCorrect ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                  >
                    {letter}
                  </span>
                  <span className="flex-1">{opt.text}</span>
                  {opt.isCorrect && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.2 rounded">
                      Correct
                    </span>
                  )}
                </div>
              );
            })}
        </div>

        {/* Explanation */}
        {currentQ.explanation && (
          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-700 text-[11px] leading-relaxed">
            <span className="font-semibold text-slate-900">Explanation: </span>
            {currentQ.explanation}
          </div>
        )}
      </div>
    </div>
  );
}
