import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Layout from './components/Layout';
import AuthPage from './components/AuthPage';
import TeacherDashboard from './components/TeacherDashboard';
import QuizCreator from './components/QuizCreator';
import StudentDashboard from './components/StudentDashboard';
import StudentQuizzes from './components/StudentQuizzes';
import StudentPerformance from './components/StudentPerformance';
import StudentRoster from './components/StudentRoster';
import QuizSession from './components/QuizSession';
import TeacherQuizResults from './components/TeacherQuizResults';
import TeacherAssessments from './components/TeacherAssessments';
import TeacherStudents from './components/TeacherStudents';
import TeacherAnalytics from './components/TeacherAnalytics';
import { ShieldAlert, LogOut } from 'lucide-react';

function BannedScreen() {
  const { signOut } = useAuth();
  return (
    <div className="flex h-[80vh] items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-100 p-8 text-center space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Access Restricted</h1>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">
            Your account has been restricted by an administrator. You no longer have access to the BrainReps educational modules.
          </p>
        </div>
        <div className="pt-4 border-t border-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Contact your educator for clarification</p>
          <button
            onClick={() => signOut()}
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ children, role }: { children: React.ReactNode, role?: 'teacher' | 'student' }) {
  const { user, profile, loading } = useAuth();

  if (loading) return null;
  if (!user || !profile) return <Navigate to="/" />;
  
  if (profile.isBanned) {
    return <BannedScreen />;
  }

  if (role && profile.role !== role) {
    return <Navigate to={profile.role === 'teacher' ? '/teacher' : '/student'} />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<AuthPage />} />
            
            {/* Teacher Routes */}
            <Route path="/teacher" element={
              <RequireAuth role="teacher"><TeacherDashboard /></RequireAuth>
            } />
            <Route path="/teacher/create" element={
              <RequireAuth role="teacher"><QuizCreator /></RequireAuth>
            } />
            <Route path="/teacher/edit/:id" element={
              <RequireAuth role="teacher"><QuizCreator /></RequireAuth>
            } />
            <Route path="/teacher/assessments" element={
              <RequireAuth role="teacher"><TeacherAssessments /></RequireAuth>
            } />
            <Route path="/teacher/students" element={
              <RequireAuth role="teacher"><TeacherStudents /></RequireAuth>
            } />
            <Route path="/teacher/analytics" element={
              <RequireAuth role="teacher"><TeacherAnalytics /></RequireAuth>
            } />
            <Route path="/teacher/quiz/:id" element={
              <RequireAuth role="teacher"><TeacherQuizResults /></RequireAuth>
            } />

            {/* Student Routes */}
            <Route path="/student" element={
              <RequireAuth role="student"><StudentDashboard /></RequireAuth>
            } />
            <Route path="/student/quizzes" element={
              <RequireAuth role="student"><StudentQuizzes /></RequireAuth>
            } />
            <Route path="/student/performance" element={
              <RequireAuth role="student"><StudentPerformance /></RequireAuth>
            } />
            <Route path="/student/roster" element={
              <RequireAuth role="student"><StudentRoster /></RequireAuth>
            } />
            <Route path="/student/quiz/:id" element={
              <RequireAuth><QuizSession /></RequireAuth>
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}
