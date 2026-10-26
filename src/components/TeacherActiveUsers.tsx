import React, { useState, useEffect } from 'react';
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
  Radio, 
  ArrowRight,
  RefreshCw,
  Zap,
  Pause,
  Play,
  UserCheck,
  CheckCircle2,
  Mail,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { UserPresence, UserProfile } from '../types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function TeacherActiveUsers() {
  const { 
    activeUsers, 
    onlineCount, 
    studentCount, 
    teacherCount, 
    quizParticipantCount, 
    loading,
    refresh,
    lastRefreshedAt,
    isAutoRefreshing,
    toggleAutoRefresh
  } = useActiveUsers({ live: true });
  
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher' | 'quiz'>('all');
  const [viewMode, setViewMode] = useState<'live' | 'roster'>('live');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rosterStudents, setRosterStudents] = useState<UserProfile[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);

  // Fetch registered student roster to cross-reference presence and enable roster view
  useEffect(() => {
    if (!profile) return;
    let active = true;

    const fetchRoster = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'student'));
        const snap = await getDocs(q);
        if (!active) return;
        const studentsList = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
        // Sort alphabetically
        studentsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setRosterStudents(studentsList);
      } catch (err) {
        console.warn('Failed to fetch student roster for active monitor:', err);
      } finally {
        if (active) setRosterLoading(false);
      }
    };

    fetchRoster();

    return () => {
      active = false;
    };
  }, [profile]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    
    // Also refresh roster
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const snap = await getDocs(q);
      const studentsList = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      studentsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setRosterStudents(studentsList);
    } catch {}

    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Map active users by uid for fast lookup
  const activeUserMap = new Map<string, UserPresence>();
  activeUsers.forEach(u => activeUserMap.set(u.uid, u));

  // Filtered live active users
  const filteredLiveUsers = activeUsers.filter((u) => {
    const matchesSearch = 
      (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.currentActivity || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const r = (u.role || '').toLowerCase();
    if (roleFilter === 'student') return r === 'student';
    if (roleFilter === 'teacher') return r === 'teacher' || r === 'admin';
    if (roleFilter === 'quiz') return u.currentPath?.startsWith('/student/quiz/');

    return true;
  });

  // Filtered roster students (with live presence merged)
  const filteredRosterStudents = rosterStudents.filter((s) => {
    const presence = activeUserMap.get(s.uid);
    const matchesSearch = 
      (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (presence?.currentActivity && presence.currentActivity.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (roleFilter === 'student') return true;
    if (roleFilter === 'quiz') return presence?.currentPath?.startsWith('/student/quiz/');
    return true;
  });

  const getTimeAgo = (dateStr: string) => {
    try {
      const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (seconds < 5) return 'Just now';
      if (seconds < 60) return `${seconds}s ago`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      return `${hours}h ago`;
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
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight font-display">
                Currently Active Users
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Radar
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <Zap className="w-3 h-3 text-amber-500" />
                Real-Time Synchronized
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
              Live presence monitoring displaying learners and staff actively engaged on BrainReps right now.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-all active:scale-95 uppercase tracking-wider cursor-pointer"
            title="Perform fresh on-demand read from Firestore"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-indigo-500", isRefreshing && "animate-spin")} />
            {isRefreshing ? 'Syncing...' : 'Refresh'}
          </button>

          <button
            onClick={() => toggleAutoRefresh(!isAutoRefreshing)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 uppercase tracking-wider cursor-pointer",
              isAutoRefreshing
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            )}
            title={isAutoRefreshing ? "Auto-refresh active" : "Auto-refresh paused"}
          >
            {isAutoRefreshing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isAutoRefreshing ? 'Live Stream' : 'Stream Paused'}
          </button>

          <Link
            to="/teacher/students"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-all active:scale-95 uppercase tracking-wider"
          >
            <GraduationCap className="w-4 h-4 text-indigo-500" />
            Class Roster
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
            Learners & staff active on site
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
              {rosterStudents.length > 0 ? `${studentCount} / ${rosterStudents.length} enrolled` : 'Online'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
            Enrolled learners currently on platform
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
              Taking Tests
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

      {/* View Mode & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setViewMode('live')}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
              viewMode === 'live'
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            Live Active Users ({onlineCount})
          </button>
          <button
            onClick={() => setViewMode('roster')}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
              viewMode === 'roster'
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
            Enrolled Students Status ({studentCount} Online / {rosterStudents.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or activity..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Filter Pills (for live view) */}
        {viewMode === 'live' && (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <button
              onClick={() => setRoleFilter('all')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
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
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer",
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
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer",
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
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer",
                roleFilter === 'teacher'
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              Staff ({teacherCount})
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area based on View Mode */}
      {viewMode === 'live' ? (
        /* LIVE RADAR GRID */
        loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              Connecting to live active users stream...
            </p>
          </div>
        ) : filteredLiveUsers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {searchTerm ? 'No active users match your search' : 'No active users in this filter right now'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto font-medium">
              {searchTerm 
                ? 'Try adjusting your search query or reset the filter.' 
                : 'As students or teachers navigate the site, their presence appears here instantly in real time.'}
            </p>
            <div className="pt-2 flex justify-center gap-3">
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Clear Search
                </button>
              )}
              <button
                onClick={() => setViewMode('roster')}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <GraduationCap className="w-4 h-4 text-indigo-500" />
                View Enrolled Students ({rosterStudents.length})
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence>
              {filteredLiveUsers.map((userItem) => {
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
                              {userItem.currentActivity || 'Active on Platform'}
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
                        {isIdle ? 'Idle tab' : 'Active now'}
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
        )
      ) : (
        /* ROSTER WITH LIVE STATUS VIEW */
        rosterLoading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              Loading student roster status...
            </p>
          </div>
        ) : filteredRosterStudents.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              No students found
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">
              As learners register and participate in the curriculum, they will appear in this roster.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRosterStudents.map((student) => {
              const livePresence = activeUserMap.get(student.uid);
              const isOnline = Boolean(livePresence);
              const isIdle = livePresence?.status === 'idle';
              const isInQuiz = livePresence?.currentPath?.startsWith('/student/quiz/');

              return (
                <div
                  key={student.uid}
                  className={cn(
                    "bg-white dark:bg-slate-900 rounded-2xl p-6 border transition-all shadow-sm flex flex-col justify-between group",
                    isOnline 
                      ? "border-emerald-200 dark:border-emerald-900/60 shadow-emerald-500/5" 
                      : "border-slate-200/80 dark:border-slate-800 opacity-80 hover:opacity-100"
                  )}
                >
                  <div>
                    {/* Header: Student Info & Beacon */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3.5">
                        <div className="relative shrink-0">
                          {student.photoURL ? (
                            <img
                              src={student.photoURL}
                              alt={student.name}
                              className="w-12 h-12 rounded-2xl object-cover ring-2 ring-slate-100 dark:ring-slate-800 shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                              {(student.name || 'S').charAt(0).toUpperCase()}
                            </div>
                          )}

                          {/* Live Presence Beacon */}
                          <span 
                            className={cn(
                              "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-xs",
                              isOnline ? (isIdle ? "bg-amber-400" : "bg-emerald-500") : "bg-slate-300 dark:bg-slate-700"
                            )}
                            title={isOnline ? (isIdle ? 'Idle tab' : 'Online now') : 'Offline'}
                          >
                            {isOnline && (
                              <span 
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full bg-white",
                                  !isIdle && "animate-ping"
                                )} 
                              />
                            )}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {student.name}
                          </h3>
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate font-mono">
                            {student.email}
                          </p>
                        </div>
                      </div>

                      {/* Status Tag */}
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 border flex items-center gap-1",
                          isOnline
                            ? (isIdle 
                                ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                                : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800")
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                        )}
                      >
                        {isOnline ? (
                          <>
                            <span className={cn("w-1.5 h-1.5 rounded-full", isIdle ? "bg-amber-500" : "bg-emerald-500 animate-pulse")} />
                            {isIdle ? 'Idle' : 'Online'}
                          </>
                        ) : 'Offline'}
                      </span>
                    </div>

                    {/* Activity Box */}
                    <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800/80 space-y-2 mb-4">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-indigo-500" />
                          Activity Status
                        </span>
                        {isOnline && livePresence?.lastSeen && (
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getTimeAgo(livePresence.lastSeen)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isOnline ? (
                          isInQuiz ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                              <BookOpen className="w-3.5 h-3.5" />
                              Taking Assessment
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {livePresence?.currentActivity || 'Active on Platform'}
                            </span>
                          )
                        ) : (
                          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 italic">
                            Last active: {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'Inactive'}
                          </span>
                        )}
                      </div>

                      {isOnline && livePresence?.currentPath && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate">
                          Path: {livePresence.currentPath}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                      {isOnline ? 'Currently connected' : 'Not on website'}
                    </span>
                    <Link
                      to="/teacher/students"
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      View Record
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
