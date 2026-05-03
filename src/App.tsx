import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ThemeProvider } from './lib/ThemeContext';
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
import AdminManagement from './components/AdminManagement';
import BannedScreen from './components/BannedScreen';
import StudentProfile from './components/StudentProfile';
import HandoutManager from './components/HandoutManager';
import NeuralAssistant from './components/NeuralAssistant';

import { BookOpen } from 'lucide-react';
import { doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import { db } from './lib/firebase';

import IntroScreen from './components/IntroScreen';

const SUPER_ADMIN_EMAIL = 'bamuyahacksie@gmail.com';

// CRITICAL CONSTRAINT: Test connection to Firestore
async function testConnection() {
  try {
    // Attempting to fetch a random doc from server to verify connectivity and rules
    await getDocFromServer(doc(db, '_internal', 'connection_test'));
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or network.");
    }
  }
}
testConnection();

function RequireAuth({ children, role }: { children: React.ReactNode, role?: 'teacher' | 'student' | 'admin' }) {
  const { user, profile, loading } = useAuth();
  const [showIntro, setShowIntro] = React.useState(false);
  const [introStepCompleted, setIntroStepCompleted] = React.useState(false);

  React.useEffect(() => {
    if (!loading && user && profile && !introStepCompleted) {
      setShowIntro(true);
    }
  }, [loading, user, profile, introStepCompleted]);

  if (loading) return null;
  if (!user || !profile) return <Navigate to="/" />;

  if (showIntro) {
    const effectiveRole = profile.email === SUPER_ADMIN_EMAIL ? 'admin' : profile.role as 'student' | 'teacher' | 'admin';
    return (
      <IntroScreen 
        userRole={effectiveRole} 
        userName={profile.name} 
        onComplete={() => {
          setShowIntro(false);
          setIntroStepCompleted(true);
        }} 
      />
    );
  }

  if (!introStepCompleted) return null;
  
  if (profile.isBanned) {
    return <BannedScreen />;
  }

  // Super Admin Elevation Logic (Always treat the specified email as an admin)
  const effectiveRole = profile.email === SUPER_ADMIN_EMAIL ? 'admin' : profile.role;

  // Hierarchical Role Authorization
  // 1. If no role is required, anyone authenticated passes.
  // 2. If 'admin' is required, only 'admin' passes.
  // 3. If 'teacher' is required, 'admin' OR 'teacher' passes.
  // 4. If 'student' is required, only 'student' passes.
  const isAuthorized = !role || 
    effectiveRole === role || 
    (role === 'teacher' && effectiveRole === 'admin');

  if (!isAuthorized) {
    if (effectiveRole === 'admin') return <Navigate to="/admin/faculty" />;
    return <Navigate to={effectiveRole === 'teacher' ? '/teacher' : '/student'} />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
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
            <Route path="/teacher/handouts" element={
              <RequireAuth role="teacher"><HandoutManager /></RequireAuth>
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
            <Route path="/student/assistant" element={
              <RequireAuth role="student"><NeuralAssistant /></RequireAuth>
            } />
            <Route path="/student/performance" element={
              <RequireAuth role="student"><StudentPerformance /></RequireAuth>
            } />
            <Route path="/student/roster" element={
              <RequireAuth role="student"><StudentRoster /></RequireAuth>
            } />
            <Route path="/student/profile" element={
              <RequireAuth role="student"><StudentProfile /></RequireAuth>
            } />
            <Route path="/student/quiz/:id" element={
              <RequireAuth><QuizSession /></RequireAuth>
            } />

            {/* Admin Routes */}
            <Route path="/admin/faculty" element={
              <RequireAuth role="admin"><AdminManagement /></RequireAuth>
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
    </ThemeProvider>
  );
}
