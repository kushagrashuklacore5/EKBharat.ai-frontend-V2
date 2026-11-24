import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider, useAuth } from "./auth/auth";
import Login from "./Login";
import AgentChat from "./components/AgentChat/AgentChat";

// The same pages and routes the LMS used for the AI Assessment Agent (client/src/App.jsx in the LMS).
const TeacherAssessments = lazy(() => import("./pages/assessment-agent/TeacherAssessments"));
const StudentTests = lazy(() => import("./pages/assessment-agent/StudentTests"));
const StudentPerformanceReport = lazy(() => import("./pages/assessment-agent/StudentPerformanceReport"));
const StudentAttempt = lazy(() => import("./pages/assessment-agent/StudentAttempt"));
const StudentPerformance = lazy(() => import("./pages/assessment-agent/StudentPerformance"));
const TeacherAssignments = lazy(() => import("./pages/assessment-agent/TeacherAssignments"));
const StudentAssignments = lazy(() => import("./pages/assessment-agent/StudentAssignments"));
const StudentAssignment = lazy(() => import("./pages/assessment-agent/StudentAssignment"));

const TEACHER_ROLES = ["mentor", "teacher"];

function Protected({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const ok = role === "mentor" ? TEACHER_ROLES.includes(user.role) : user.role === role;
  if (!ok) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "student" ? "/student/assessment-agent/tests" : "/teacher/assessments"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="p-8 text-gray-500">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/teacher/assessments" element={<Protected role="mentor"><TeacherAssessments /></Protected>} />
            <Route path="/teacher/assessments/assignments" element={<Protected role="mentor"><TeacherAssignments /></Protected>} />
            <Route path="/teacher/assessments/students/:studentId" element={<Protected role="mentor"><StudentPerformance /></Protected>} />
            <Route path="/student/assessment-agent/assignments" element={<Protected role="student"><StudentAssignments /></Protected>} />
            <Route path="/student/assessment-agent/assignments/:id" element={<Protected role="student"><StudentAssignment /></Protected>} />
            <Route path="/student/assessment-agent/tests" element={<Protected role="student"><StudentTests /></Protected>} />
            <Route path="/student/assessment-agent/reports/:reportId" element={<Protected role="student"><StudentPerformanceReport /></Protected>} />
            <Route path="/student/assessment-agent/attempts/:attemptId" element={<Protected role="student"><StudentAttempt /></Protected>} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
        <AgentChat />
      </BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} />
    </AuthProvider>
  );
}
