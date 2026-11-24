import { useState, useCallback, useRef } from "react";
import { API_BASE } from "../../config/api";
import { useAuth } from "../../auth/auth";

export function useAgentChat() {
  const { token, loginUser } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello. I am your AI Assessment Assistant.\n\nYou can request assessment generation directly in natural language, for example:\n\"8th A ke liye photosynthesis ka 15-minute test banao\"\nor use the microphone to dictate your instructions.",
      optionsPrompt: [
        { label: "Grade 8 - A: 15-minute Photosynthesis Test", value: "8th A ke liye photosynthesis ka 15-minute test banao" },
        { label: "Grade 9: Optics Examination", value: "Grade 9 Physics ke liye optics ka exam prepare karo" },
        { label: "View Class Overview", value: "Show my classes" }
      ]
    }
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentThinking, setCurrentThinking] = useState(null);
  const [activeTools, setActiveTools] = useState([]);
  const abortControllerRef = useRef(null);

  const sendMessage = useCallback(async (text) => {
    if (!text || !text.trim() || isStreaming) return;
    const userMsg = text.trim();

    // Add user message to UI
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsStreaming(true);
    setCurrentThinking(null);
    setActiveTools([]);

    try {
      abortControllerRef.current = new AbortController();
      const res = await fetch(`${API_BASE}/agent/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMsg }),
        signal: abortControllerRef.current.signal
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      let incomingAssistantContent = "";
      let incomingOptions = null;
      let incomingQuestions = null;
      let incomingStudentSession = null;
      let incomingReport = null;
      let incomingStudyPlan = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop(); // Keep remainder

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.replace(/^data: /, "").trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "thinking") {
              setCurrentThinking(event.content);
            } else if (event.type === "tool_start") {
              setActiveTools((prev) => [
                ...prev,
                { tool: event.tool, label: event.label, status: "running", args: event.args }
              ]);
            } else if (event.type === "tool_done") {
              setActiveTools((prev) =>
                prev.map((t) =>
                  t.tool === event.tool ? { ...t, status: "done", summary: event.summary } : t
                )
              );
            } else if (event.type === "message") {
              incomingAssistantContent = event.content;
            } else if (event.type === "options_prompt") {
              incomingOptions = event.options;
            } else if (event.type === "questions_preview") {
              incomingQuestions = event;
            } else if (event.type === "student_session") {
              incomingStudentSession = event;
            } else if (event.type === "report_preview") {
              incomingReport = event;
            } else if (event.type === "study_plan") {
              incomingStudyPlan = event.plan;
            } else if (event.type === "done") {
              // Finalize message block
              if (
                incomingAssistantContent ||
                incomingQuestions ||
                incomingStudentSession ||
                incomingReport ||
                incomingStudyPlan
              ) {
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "assistant",
                    content: incomingAssistantContent,
                    optionsPrompt: incomingOptions,
                    questionsPreview: incomingQuestions,
                    studentSession: incomingStudentSession,
                    reportPreview: incomingReport,
                    studyPlan: incomingStudyPlan
                  }
                ]);
              }
              setCurrentThinking(null);
              setIsStreaming(false);
            }
          } catch (e) {
            console.error("Error parsing SSE event:", e);
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ Error communicating with agent: ${err.message}`
          }
        ]);
      }
    } finally {
      setIsStreaming(false);
      setCurrentThinking(null);
    }
  }, [token, isStreaming]);

  const resetSession = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/agent/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages([
        {
          role: "assistant",
          content: "Session reset. What assessment would you like to prepare?",
          optionsPrompt: [
            { label: "Grade 8 - A: 15-minute Photosynthesis Test", value: "8th A ke liye photosynthesis ka 15-minute test banao" },
            { label: "Grade 9: Optics Examination", value: "Grade 9 Physics ke liye optics ka exam prepare karo" }
          ]
        }
      ]);
      setActiveTools([]);
      setCurrentThinking(null);
    } catch (e) {
      console.error(e);
    }
  }, [token]);

  return {
    messages,
    isStreaming,
    currentThinking,
    activeTools,
    sendMessage,
    resetSession
  };
}
