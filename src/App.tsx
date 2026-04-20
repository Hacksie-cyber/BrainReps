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

function RequireAuth({ children, role }: { children: React.ReactNode, role?: 'teacher' | 'student' }) {
  const { user, profile, loading } = useAuth();

  if (loading) return null;
  if (!user || !profile) return <Navigate to="/" />;
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
