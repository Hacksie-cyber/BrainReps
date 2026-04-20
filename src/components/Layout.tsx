import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { LogOut, BookOpen, User as UserIcon, LayoutDashboard, Database, GraduationCap, BarChart3, Settings, Brain } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const menuItems = profile?.role === 'teacher' ? [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/teacher' },
    { label: 'Assessments', icon: BookOpen, path: '/teacher/assessments' },
    { label: 'Students', icon: GraduationCap, path: '/teacher/students' },
    { label: 'Analytics', icon: BarChart3, path: '/teacher/analytics' },
  ] : [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/student' },
    { label: 'My Quizzes', icon: BookOpen, path: '/student/quizzes' },
    { label: 'Performance', icon: BarChart3, path: '/student/performance' },
    { label: 'Student List', icon: GraduationCap, path: '/student/roster' },
  ];

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-600 selection:text-white">
        <main className="flex-1">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-600 selection:text-white overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
            <Brain className="h-5 w-5" />
          </div>
          <span className="text-white font-black text-xl tracking-tighter">Brain<span className="text-indigo-400">Reps</span></span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = item.path === '/student' || item.path === '/teacher' 
              ? location.pathname === item.path 
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm font-medium",
                  isActive 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                    : "hover:bg-slate-800 text-slate-400 hover:text-white"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "opacity-100" : "opacity-60")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 p-2 bg-slate-800 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-indigo-500/20">
              {profile.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{profile.name}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{profile.role}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between flex-shrink-0">
          <h1 className="text-xl font-bold text-slate-800">
            {location.pathname.includes('teacher') ? 'Teacher Console' : 'Learning Hub'}
          </h1>
          <div className="flex items-center gap-3">
             <div className="flex gap-1">
                <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 font-bold uppercase tracking-tighter">MCQ</span>
                <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100 font-bold uppercase tracking-tighter">T/F</span>
                <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 font-bold uppercase tracking-tighter">Short</span>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
