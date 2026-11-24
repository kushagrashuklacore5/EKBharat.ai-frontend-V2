import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Send,
  RotateCcw,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  Lock,
  ArrowRight,
  Sparkles,
  UserCheck,
  GraduationCap
} from "lucide-react";
import { useAgentChat } from "./useAgentChat";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallItem } from "./ToolCallItem";
import { QuestionsPreviewCard } from "./QuestionsPreviewCard";
import { ReportCard } from "./ReportCard";
import { StudyPlanCard } from "./StudyPlanCard";
import { useAuth } from "../../auth/auth";

// Helper to strip markdown and symbols for clean speech synthesis
function cleanTextForSpeech(text) {
  if (!text) return "";
  return text
    .replace(/[*_#`~>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/#(\d+)/g, "number $1")
    .replace(/(\d+)\/(\d+)/g, "$1 out of $2")
    .replace(/%/g, " percent")
    .replace(/&/g, " and ")
    .replace(/Q(\d+)/g, "Question $1")
    .replace(/[-*•]\s+/g, "")
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function AgentChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(() => {
    return localStorage.getItem("aia_voice_output") !== "false";
  });
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const lastSpokenIndexRef = useRef(-1);
  const { user, loginUser } = useAuth();
  const navigate = useNavigate();

  const {
    messages,
    isStreaming,
    currentThinking,
    activeTools,
    sendMessage,
    resetSession
  } = useAgentChat();

  // Speech Synthesis
  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const speakText = useCallback((rawText) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const clean = cleanTextForSpeech(rawText);
    if (!clean) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice =
      voices.find((v) => v.lang.startsWith("en-IN")) ||
      voices.find((v) => v.lang.startsWith("en-GB")) ||
      voices.find((v) => v.lang.startsWith("en") && !v.name.includes("David")) ||
      voices[0];

    if (naturalVoice) utterance.voice = naturalVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const toggleTts = () => {
    const next = !isTtsEnabled;
    setIsTtsEnabled(next);
    localStorage.setItem("aia_voice_output", next ? "true" : "false");
    if (!next) stopSpeaking();
  };

  useEffect(() => {
    if (!isStreaming && messages.length > 0 && isTtsEnabled) {
      const lastIdx = messages.length - 1;
      const lastMsg = messages[lastIdx];
      if (lastMsg.role === "assistant" && lastIdx > lastSpokenIndexRef.current && lastMsg.content) {
        lastSpokenIndexRef.current = lastIdx;
        speakText(lastMsg.content);
      }
    }
  }, [messages, isStreaming, isTtsEnabled, speakText]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  // Speech Recognition
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    stopSpeaking();

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText((prev) => (prev ? prev + " " + transcript : transcript));
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, currentThinking, activeTools, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isStreaming) return;
    stopSpeaking();
    sendMessage(inputText);
    setInputText("");
  };

  const handleOptionClick = (val) => {
    if (isStreaming) return;
    stopSpeaking();
    sendMessage(val);
  };

  const handleSwitchToStudent = async (studentEmail) => {
    try {
      await loginUser(studentEmail || "aarav@demo.local", "demo1234");
      navigate("/student/assessment-agent/tests");
      sendMessage("Switched to student session. Submitting test attempt.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleSwitchToTeacher = async () => {
    try {
      await loginUser("asha.teacher@demo.local", "demo1234");
      navigate("/teacher/assessments");
      sendMessage("Switched to teacher portal. Generating diagnostic performance report.");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      {/* Floating Trigger Button matching Webpage #172e42 & #b99652 Theme */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3.5 py-2 bg-[#172e42] text-white rounded-xl shadow-xl hover:bg-[#1e3b54] transition-all border border-[#b99652]/50 hover:border-[#b99652] cursor-pointer"
          aria-label="Open AI Assistant"
        >
          <span className="w-2 h-2 rounded-full bg-[#b99652] animate-pulse"></span>
          <span className="font-semibold text-xs tracking-tight text-white">AI Assistant</span>
          <span className="text-[10px] text-[#b99652] font-mono bg-white/10 px-1.5 py-0.5 rounded">
            Agent
          </span>
        </button>
      )}

      {/* Slide-in Agent Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[95vw] sm:w-[440px] h-[85vh] max-h-[680px] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          
          {/* Header matching Navbar #1e1b4b and #B99652 */}
          <div className="bg-[#1e1b4b] text-white px-4 py-3 flex items-center justify-between border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${user ? "bg-[#B99652]" : "bg-amber-400"}`}></span>
              <div>
                <h3 className="font-semibold text-sm leading-tight text-white flex items-center gap-1.5">
                  AI Assessment Assistant
                  <span className="text-[10px] text-[#B99652] font-mono bg-white/10 px-1.5 py-0.5 rounded">
                    {user ? "Active" : "Sign In Required"}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-300">
                  {user ? `${user.name} · ${user.role === "student" ? "Student" : "Teacher"}` : "Guest · Sign In to Start"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {isSpeaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  title="Stop speaking"
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-medium transition-all"
                >
                  <Square className="w-2.5 h-2.5 inline mr-1 fill-current" /> Stop
                </button>
              )}

              {user && (
                <button
                  type="button"
                  onClick={toggleTts}
                  title={isTtsEnabled ? "Voice active (click to mute)" : "Voice muted (click to enable)"}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                    isTtsEnabled ? "text-[#B99652] hover:bg-white/10" : "text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {isTtsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              )}

              {user && (
                <button
                  type="button"
                  onClick={resetSession}
                  title="Reset conversation"
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {!user ? (
            /* Sign In Required Overlay Card inside Chatbot */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#faf8f5] via-white to-[#faf8f5] overflow-y-auto">
              <div className="size-14 rounded-2xl bg-gradient-to-br from-[#faf2e0] to-[#f4e4bf] border border-[#d6be8c] flex items-center justify-center text-[#9a6f22] mb-3.5 shadow-sm">
                <Lock className="w-6 h-6 text-[#9a6f22]" />
              </div>

              <h4 className="text-base font-bold text-[#172e42] mb-1.5">
                Sign In Required
              </h4>

              <p className="text-xs text-slate-600 max-w-[280px] mb-5 leading-relaxed">
                Please sign in to activate the AI Assessment Agent, generate rubric-aligned tests, and evaluate assignments in real time.
              </p>

              <div className="w-full max-w-xs space-y-2.5">
                <button
                  type="button"
                  onClick={handleSwitchToTeacher}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#b99652] to-[#9a6f22] hover:from-[#c5a35d] hover:to-[#a77a28] text-white text-xs font-semibold shadow-md shadow-[#b99652]/20 transition-all flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    <span>Sign In as Teacher (Asha)</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchToStudent("aarav@demo.local")}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 border border-[#e2d5b5] text-[#172e42] text-xs font-medium transition-all flex items-center justify-between cursor-pointer shadow-xs"
                >
                  <span className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-[#9a6f22]" />
                    <span>Sign In as Student (Aarav)</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-slate-400 mt-5">
                Or enter credentials directly in the main portal
              </p>
            </div>
          ) : (
            <>
              {/* Sub Header Status */}
              <div className="bg-slate-50 border-b border-slate-200 px-3.5 py-1.5 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
                <span className="font-medium text-slate-700">Autonomous Assessment Workflow</span>
                <span className="text-[10px] text-slate-500">
                  {isTtsEnabled ? "Voice Output Active" : "Voice Output Muted"}
                </span>
              </div>

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-gray-50/70">
                {messages.map((msg, index) => {
                  const isUser = msg.role === "user";
                  return (
                    <div key={index} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                      <div className="max-w-[94%]">
                        {/* Bubble without cartoon avatars */}
                        <div
                          className={`p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                            isUser
                              ? "bg-[#1e1b4b] text-white rounded-br-none shadow-xs"
                              : "bg-white text-slate-900 border border-slate-200 rounded-bl-none shadow-xs"
                          }`}
                        >
                          {msg.content}

                          {!isUser && msg.content && (
                            <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                              <span>Assistant</span>
                              <button
                                type="button"
                                onClick={() => speakText(msg.content)}
                                title="Listen"
                                className="text-[#1e1b4b] hover:text-[#B99652] font-medium cursor-pointer"
                              >
                                Listen
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Embedded Questions Preview Card */}
                        {msg.questionsPreview && (
                          <QuestionsPreviewCard preview={msg.questionsPreview} />
                        )}

                        {/* Embedded Student Session Switcher */}
                        {msg.studentSession && user?.role !== "student" && (
                          <div className="my-2 p-2.5 bg-slate-100 border border-slate-300 rounded-lg text-xs">
                            <div className="font-medium text-slate-900 mb-1">
                              Demo Student: {msg.studentSession.studentName}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSwitchToStudent(msg.studentSession.studentEmail)}
                              className="w-full py-1.5 px-3 bg-[#1e1b4b] hover:bg-[#2b2766] text-white rounded font-medium text-xs transition-colors cursor-pointer"
                            >
                              Switch to Student ({msg.studentSession.studentName})
                            </button>
                          </div>
                        )}

                        {/* Embedded Performance Report Card */}
                        {msg.reportPreview && (
                          <ReportCard report={msg.reportPreview} />
                        )}

                        {/* Embedded Study Plan Card */}
                        {msg.studyPlan && (
                          <StudyPlanCard plan={msg.studyPlan} />
                        )}

                        {/* Clean Action Options */}
                        {msg.optionsPrompt && msg.optionsPrompt.length > 0 && (
                          <div className="pt-2 flex flex-col gap-1.5">
                            {msg.optionsPrompt.map((opt, optIdx) => (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => handleOptionClick(opt.value)}
                                disabled={isStreaming}
                                className="w-full text-left p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-medium text-xs transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Live streaming status */}
                {isStreaming && (
                  <div className="space-y-2">
                    {currentThinking && (
                      <ThinkingBlock content={currentThinking} isLive={true} />
                    )}

                    {activeTools.map((t, idx) => (
                      <ToolCallItem
                        key={idx}
                        tool={t.tool}
                        label={t.label}
                        status={t.status}
                        summary={t.summary}
                      />
                    ))}

                    {!currentThinking && activeTools.length === 0 && (
                      <div className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                        Executing agent workflow...
                      </div>
                    )}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick role switch helper bar */}
              <div className="bg-slate-100 px-3 py-1.5 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
                <span className="text-[10px] text-slate-500">Demo Role:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSwitchToTeacher}
                    className="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-[10px] font-medium text-slate-700 border border-slate-300 cursor-pointer"
                  >
                    Teacher (Asha)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchToStudent("aarav@demo.local")}
                    className="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-[10px] font-medium text-slate-700 border border-slate-300 cursor-pointer"
                  >
                    Student (Aarav)
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Input Bar or Sign In Prompt */}
          {!user ? (
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5 shrink-0">
              <Lock className="w-3.5 h-3.5 text-[#b99652]" />
              <span>Sign in with a role above to activate chat input</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isListening
                    ? "Listening... speak now..."
                    : isStreaming
                    ? "Processing request..."
                    : "Type: '14 questions on photosynthesis for 8th A'..."
                }
                disabled={isStreaming}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1e1b4b] focus:bg-white transition-all disabled:opacity-60"
              />
              <button
                type="button"
                onClick={toggleListening}
                title={isListening ? "Stop listening" : "Speak using Microphone"}
                className={`p-2 rounded-lg transition-all shrink-0 cursor-pointer ${
                  isListening
                    ? "bg-rose-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-slate-600" />}
              </button>
              <button
                type="submit"
                disabled={isStreaming || !inputText.trim()}
                className="p-2 bg-[#1e1b4b] hover:bg-[#2b2766] disabled:opacity-40 text-white rounded-lg transition-all shadow-2xs shrink-0 cursor-pointer"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
