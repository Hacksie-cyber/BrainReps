import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission, UserProfile } from '../types';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, PieChart, Pie } from 'recharts';
import { TrendingUp, Award, Users, FileText, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

export default function TeacherAnalytics() {
  const { profile } = useAuth();
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      try {
        const quizSnap = await getDocs(query(collection(db, 'quizzes'), where('teacherId', '==', profile.uid)));
        const qList = quizSnap.docs.map(d => ({ id: d.id, ...d.data() } as Quiz));
        setQuizzes(qList);

        const subSnap = await getDocs(query(
          collection(db, 'submissions'),
          where('teacherId', '==', profile.uid)
        ));
        const sList = subSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as QuizSubmission))
          .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
        setSubmissions(sList);

        // Fetch students instructed by this teacher (distinct studentIds from submissions)
        const distinctStudents = new Set(sList.map(s => s.studentId));
        setStudentCount(distinctStudents.size);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;

  const activeQuizzes = quizzes.filter(q => !q.isHidden);
  const activeQuizIds = new Set(activeQuizzes.map(q => q.id));
  const activeSubmissions = submissions.filter(s => activeQuizIds.has(s.quizId));

  // Aggregate data for trends
  const trendData = activeSubmissions.map(s => ({
    date: new Date(s.submittedAt).toLocaleDateString(),
    score: Math.round((s.score / s.totalPoints) * 100)
  }));

  // Real participant growth calculation (last 7 days vs previous 7 days)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const lastWeekSubs = activeSubmissions.filter(s => new Date(s.submittedAt) >= sevenDaysAgo);
  const prevWeekSubs = activeSubmissions.filter(s => {
    const d = new Date(s.submittedAt);
    return d >= fourteenDaysAgo && d < sevenDaysAgo;
  });

  const growth = prevWeekSubs.length === 0 
    ? (lastWeekSubs.length > 0 ? '+100%' : '0%') 
    : `${(((lastWeekSubs.length - prevWeekSubs.length) / prevWeekSubs.length) * 100).toFixed(0)}%`;

  const stats = {
    avg: activeSubmissions.length > 0 ? Math.round((activeSubmissions.reduce((acc, curr) => acc + (curr.score / curr.totalPoints), 0) / activeSubmissions.length) * 100) : 0,
    total: submissions.length,
    activeQuizzes: activeQuizzes.length,
    students: studentCount,
    growth: (growth.startsWith('-') ? '' : '+') + growth
  };

  // Pie chart data: Performance tiers
  const tierData = [
    { name: 'Mastery', value: activeSubmissions.filter(s => (s.score / s.totalPoints) >= 0.9).length, color: '#10b981' },
    { name: 'Proficiency', value: activeSubmissions.filter(s => (s.score / s.totalPoints) >= 0.7 && (s.score / s.totalPoints) < 0.9).length, color: '#6366f1' },
    { name: 'Developing', value: activeSubmissions.filter(s => (s.score / s.totalPoints) >= 0.5 && (s.score / s.totalPoints) < 0.7).length, color: '#f59e0b' },
    { name: 'Critical', value: activeSubmissions.filter(s => (s.score / s.totalPoints) < 0.5).length, color: '#ef4444' },
  ].filter(t => t.value > 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Executive Analytics</h1>
        <p className="text-sm text-slate-500 font-medium tracking-tight">Macro-level insights into curriculum effectiveness and participant achievement.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-4">
        {[
          { label: 'Cumulative Avg', value: `${stats.avg}%`, icon: Award, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Global Submissions', value: stats.total, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Active Modules', value: stats.activeQuizzes, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Participant Growth', value: stats.growth, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-indigo-100">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-4", stat.bg)}>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-800">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            Performance Longitudinal Trend
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-500" />
            Assessment Quality Distribution
          </h3>
          <div className="h-[300px] w-full">
            {tierData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {tierData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-xs gap-2">
                <Activity className="h-10 w-10 opacity-20" />
                <p>Establishing behavioral datasets...</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {tierData.map(t => (
              <div key={t.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const BarChart3 = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
);
