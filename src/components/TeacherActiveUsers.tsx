import React, { useState } from 'react';
import { useActiveUsers } from '../lib/usePresence';
import { useAuth } from '../lib/AuthContext';
import { 
  Users, 
  Search, 
  Clock, 
  Activity, 
  GraduationCap, 
  ShieldCheck, 
  Sparkles, 
  BookOpen, 
  Laptop, 
  CheckCircle2, 
  Radio, 
  ArrowRight,
  Filter,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { UserPresence } from '../types';

export default function TeacherActiveUsers() {
  const { activeUsers, onlineCount, studentCount, teacherCount, quizParticipantCount, loading } = useActiveUsers();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher' | 'quiz'>('all');

  const filteredUsers = activeUsers.filter((u) => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.currentActivity && u.currentActivity.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (roleFilter === 'student') return u.role === 'student';
    if (roleFilter === 'teacher') return u.role === 'teacher' || u.role === 'admin';
    if (roleFilter === 'quiz') return u.currentPath?.startsWith('/student/quiz/');

    return true;
  });

  const getTimeAgo = (dateStr: string) => {
    try {
      const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (seconds < 5) return 'Just now';
      if (seconds < 60) return `${seconds}s ago`;
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m ago`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shadow-sm">
              <Radio className="w-7 h-7 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight font-display">
                Currently Active Users
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Monitoring
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
              Real-time radar displaying learners and educators engaged on BrainReps right now.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/teacher/students"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-all active:scale-95 uppercase tracking-wider"
          >
            <GraduationCap className="w-4 h-4 text-indigo-500" />
            Class Roster
          </Link>
          <Link
            to="/teacher/analytics"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all active:scale-95 uppercase tracking-wider"
          >
            <Activity className="w-4 h-4" />
            Cohort Analytics
          </Link>
        </div>
      </header>

      {/* Real-time Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-800 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Total Active Now
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-slate-900 dark:text-slate-50 font-display">
              {onlineCount}
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Connected
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
            Active within the last 90 seconds
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-800 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Active Students
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-slate-900 dark:text-slate-50 font-display">
              {studentCount}
            </span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {onlineCount > 0 ? `${Math.round((studentCount / onlineCount) * 100)}%` : '0%'} of traffic
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
            Enrolled learners on platform
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-800 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              In Live Assessment
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-slate-900 dark:text-slate-50 font-display">
              {quizParticipantCount}
            </span>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              {quizParticipantCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />}
              Solving Tests
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
            Currently answering questionnaires
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-800 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Educators Online
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-slate-900 dark:text-slate-50 font-display">
              {teacherCount}
            </span>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
              Instruction Staff
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
            Facilitators & Administrators
          </p>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or activity..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setRoleFilter('all')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
              roleFilter === 'all'
                ? "bg-slate-900 dark:bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            All Active ({onlineCount})
          </button>
          <button
            onClick={() => setRoleFilter('student')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
              roleFilter === 'student'
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            Students ({studentCount})
          </button>
          <button
            onClick={() => setRoleFilter('quiz')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
              roleFilter === 'quiz'
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            In Assessment ({quizParticipantCount})
          </button>
          <button
            onClick={() => setRoleFilter('teacher')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
              roleFilter === 'teacher'
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            Staff ({teacherCount})
          </button>
        </div>
      </div>

      {/* Active Users Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            Establishing radar connection to live participants...
          </p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            {searchTerm ? 'No active users match your search' : 'No active users in this filter'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">
            {searchTerm 
              ? 'Try adjusting your search criteria or clearing the filter.' 
              : 'As students or teachers navigate the application, their presence will be tracked here in real time.'}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {filteredUsers.map((userItem) => {
              const isCurrentUser = userItem.uid === profile?.uid;
              const isInQuiz = userItem.currentPath?.startsWith('/student/quiz/');
              const isIdle = userItem.status === 'idle';

              return (
                <motion.div
                  key={userItem.uid}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "bg-white dark:bg-slate-900 rounded-2xl p-6 border transition-all shadow-sm hover:shadow-md relative overflow-hidden flex flex-col justify-between group",
                    isInQuiz 
                      ? "border-amber-200 dark:border-amber-900/60 bg-gradient-to-br from-white via-white to-amber-50/30 dark:from-slate-900 dark:to-amber-950/20"
                      : "border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800"
                  )}
                >
                  <div>
                    {/* Top Row: User Avatar & Role */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3.5">
                        <div className="relative shrink-0">
                          {userItem.photoURL ? (
                            <img
                              src={userItem.photoURL}
                              alt={userItem.name}
                              className="w-12 h-12 rounded-2xl object-cover ring-2 ring-slate-100 dark:ring-slate-800 shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                              {userItem.name.charAt(0).toUpperCase()}
                            </div>
                          )}

                          {/* Real-time Status Beacon */}
                          <span 
                            className={cn(
                              "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-xs",
                              isIdle ? "bg-amber-400" : "bg-emerald-500"
                            )}
                            title={isIdle ? 'Idle (Background Tab)' : 'Online and Active'}
                          >
                            <span 
                              className={cn(
                                "w-1.5 h-1.5 rounded-full bg-white",
                                !isIdle && "animate-ping"
                              )} 
                            />
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {userItem.name}
                            </h3>
                            {isCurrentUser && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate font-mono">
                            {userItem.email}
                          </p>
                        </div>
                      </div>

                      {/* Role Pill */}
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 border",
                          userItem.role === 'teacher' || userItem.role === 'admin'
                            ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                            : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                        )}
                      >
                        {userItem.role}
                      </span>
                    </div>

                    {/* Current Activity Box */}
                    <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800/80 space-y-2 mb-4">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-indigo-500" />
                          Current Action
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {getTimeAgo(userItem.lastSeen)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isInQuiz ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                            <BookOpen className="w-3.5 h-3.5" />
                            Taking Assessment
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {userItem.currentActivity || 'Navigating Platform'}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate">
                        Path: {userItem.currentPath || '/'}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        isIdle ? "bg-amber-400" : "bg-emerald-500"
                      )} />
                      {isIdle ? 'Idle tab' : 'Active interaction'}
                    </div>

                    {userItem.role === 'student' && (
                      <Link
                        to="/teacher/students"
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                      >
                        Student Record
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
