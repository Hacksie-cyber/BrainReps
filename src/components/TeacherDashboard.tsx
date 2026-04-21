import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Plus, BarChart3, Clock, Users, ArrowRight, BookCheck, BookOpen, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import DeleteModal from './DeleteModal';

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [teacherCount, setTeacherCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [quizToDelete, setQuizToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      try {
        const quizSnap = await getDocs(query(
          collection(db, 'quizzes'),
          where('teacherId', '==', profile.uid)
        ));
        const quizList = quizSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Quiz))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setQuizzes(quizList);

        // Fetch all students to calculate school/class engagement
        const studentSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
        setStudentCount(studentSnap.size);

        // Fetch all teachers
        const teacherSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'teacher')));
        setTeacherCount(teacherSnap.size);

        const subQuery = query(
          collection(db, 'submissions'),
          where('teacherId', '==', profile.uid)
        );
        const subSnap = await getDocs(subQuery);
        const filteredSubs = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizSubmission));
        
        setSubmissions(filteredSubs);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  const handleDelete = async () => {
    if (!quizToDelete || !profile) return;
    const quizId = quizToDelete;

    try {
      setIsDeleting(quizId);
      
      // 1. Purge all associated submissions and performance history
      const subQuery = query(
        collection(db, 'submissions'), 
        where('quizId', '==', quizId)
      );
      const subSnap = await getDocs(subQuery);
      
      if (!subSnap.empty) {
        const deletePromises = subSnap.docs.map(d => deleteDoc(doc(db, 'submissions', d.id)));
        await Promise.all(deletePromises);
      }

      // 2. Definitive removal of the Knowledge Module
      await deleteDoc(doc(db, 'quizzes', quizId));
      
      setQuizzes(quizzes.filter(q => q.id !== quizId));
      setQuizToDelete(null);
    } catch (error) {
      console.error(error);
      alert('Delete failed.');
    } finally {
      setIsDeleting(null);
    }
  };

  const activeQuizzes = quizzes.filter(q => !q.isHidden);
  const activeQuizIds = new Set(activeQuizzes.map(q => q.id));
  const activeSubmissions = submissions.filter(s => activeQuizIds.has(s.quizId));

  const uniqueStudentsCount = new Set(activeSubmissions.map(s => s.studentId)).size;
  const engagementRate = studentCount > 0 ? Math.round((uniqueStudentsCount / studentCount) * 100) : 0;
  const avgGrade = activeSubmissions.length > 0 
    ? Math.round((activeSubmissions.reduce((acc, curr) => acc + curr.score, 0) / activeSubmissions.reduce((acc, curr) => acc + curr.totalPoints, 0)) * 100)
    : 0;

  // Simple distribution calculation (0-20, 21-40, 41-60, 61-80, 81-100)
  const distribution = [0, 0, 0, 0, 0];
  activeSubmissions.forEach(s => {
    const percent = (s.score / s.totalPoints) * 100;
    if (percent <= 20) distribution[0]++;
    else if (percent <= 40) distribution[1]++;
    else if (percent <= 60) distribution[2]++;
    else if (percent <= 80) distribution[3]++;
    else distribution[4]++;
  });

  const maxDist = Math.max(...distribution, 1);

  // Identify students with low scores in ACTIVE quizzes
  const lowPerforming = activeSubmissions
    .filter(s => (s.score / s.totalPoints) < 0.6)
    .sort((a, b) => (a.score / a.totalPoints) - (b.score / b.totalPoints))
    .slice(0, 3)
    .map(s => ({
      name: s.studentName,
      score: Math.round((s.score / s.totalPoints) * 100),
      quiz: s.quizTitle
    }));

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard Overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Monitor your performance and manage questionnaires.</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/teacher/create"
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Create Questionnaire
          </Link>
        </div>
      </header>

      {/* Analytics Overview */}
      <section className="grid gap-6 lg:grid-cols-4 xl:grid-cols-6">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Active Tests</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{activeQuizzes.length}</h3>
          <p className="text-emerald-600 dark:text-emerald-400 text-[11px] mt-2 flex items-center font-bold italic">{quizzes.length - activeQuizzes.length} Hidden</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Avg. Grade</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{avgGrade}%</h3>
          <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-2 font-medium tracking-tighter italic">Active modules</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Submissions</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{submissions.length}</h3>
          <p className="text-indigo-600 dark:text-indigo-400 text-[11px] mt-2 font-bold italic">{activeSubmissions.length} Active</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Audience Engagement</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{engagementRate}%</h3>
          <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-2 font-medium italic">Active participation</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Student Population</p>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{studentCount}</h3>
          <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-2 font-medium italic">Enrolled participants</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Teacher Faculty</p>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{teacherCount}</h3>
          <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-2 font-medium italic">Faculty members</p>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-6 min-h-0">
        {/* Main Content Split */}
        <div className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col shadow-sm transition-colors">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <BookCheck className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              Recent Assessments
            </h2>
          </div>
          <div className="flex-1 overflow-auto">
            {quizzes.length === 0 ? (
               <div className="p-12 text-center text-slate-400 dark:text-slate-600">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm italic">No assessments discovered yet.</p>
               </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/30">
                    <th className="px-6 py-3 font-bold border-b border-slate-100 dark:border-slate-800">Assessment Title</th>
                    <th className="px-6 py-3 font-bold border-b border-slate-100 dark:border-slate-800 text-center">Responses</th>
                    <th className="px-6 py-3 font-bold border-b border-slate-100 dark:border-slate-800">Avg Result</th>
                    <th className="px-6 py-3 font-bold border-b border-slate-100 dark:border-slate-800 text-right pr-8">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {quizzes.map((quiz) => {
                    const qSubs = submissions.filter(s => s.quizId === quiz.id);
                    const avg = qSubs.length > 0
                      ? Math.round((qSubs.reduce((acc, curr) => acc + curr.score, 0) / qSubs.reduce((acc, curr) => acc + curr.totalPoints, 0)) * 100)
                      : '--';
                    return (
                      <tr key={quiz.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer" onClick={() => navigate(`/teacher/quiz/${quiz.id}`)}>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-700 dark:text-slate-200 tracking-tight">{quiz.title}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{new Date(quiz.createdAt).toLocaleDateString()} • {quiz.questions.length} Items</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-700/50">{qSubs.length}</span>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                             <div className="w-16 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block transition-colors">
                               <div 
                                style={{ width: avg !== '--' ? `${avg}%` : '0%' }}
                                className="bg-indigo-600 h-full transition-all duration-700" 
                               />
                             </div>
                             <span className={cn("font-bold text-sm", avg !== '--' ? "text-slate-800 dark:text-slate-200" : "text-slate-300 dark:text-slate-700")}>{avg}{avg !== '--' ? '%' : ''}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-right pr-8">
                           <div className="flex items-center justify-end gap-2">
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 navigate(`/student/quiz/${quiz.id}`);
                               }}
                               className="p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-100 dark:border-slate-700 rounded-md transition-all opacity-0 group-hover:opacity-100"
                               title="Review Assessment"
                             >
                                <BookOpen className="h-3.5 w-3.5" />
                             </button>
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setQuizToDelete(quiz.id);
                               }}
                               disabled={isDeleting === quiz.id}
                               className={cn(
                                 "p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100",
                                 isDeleting === quiz.id ? "text-slate-200 dark:text-slate-700 animate-pulse" : "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-slate-100 dark:border-slate-700"
                               )}
                               title="Remove Module"
                             >
                                <Trash2 className="h-3.5 w-3.5" />
                             </button>
                           </div>
                        </td>
                      </tr>
                    );
                   })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Performance Trends Sidebar */}
        <div className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col shadow-sm transition-colors overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 transition-colors">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              Scoring Distribution
            </h2>
          </div>
          <div className="p-6 space-y-8">
            <div>
              <div className="flex justify-between items-end mb-4">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Participant reach</p>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Peak: {Math.max(...distribution)}</span>
              </div>
              <div className="h-32 flex items-end gap-1.5">
                {distribution.map((val, i) => (
                  <div 
                    key={i} 
                    className="bg-indigo-100 dark:bg-indigo-900/40 hover:bg-indigo-500 dark:hover:bg-indigo-600 transition-all rounded-t w-full cursor-help group relative" 
                    style={{ height: `${(val / maxDist) * 100}%` }}
                  >
                     <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {val} submission{val !== 1 ? 's' : ''}
                     </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-2">
                <span>0-20%</span>
                <span>40%</span>
                <span>60%</span>
                <span>80%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Actionable Insights</p>
              <div className="space-y-2">
                {lowPerforming.length > 0 ? lowPerforming.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-800/30 group transition-all hover:bg-amber-50 dark:hover:bg-amber-900/20">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-[10px] transition-colors">
                      {item.name.charAt(0)}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[11px] font-bold text-amber-900 dark:text-amber-100 truncate">{item.name}</p>
                      <p className="text-[9px] text-amber-700 dark:text-amber-400 font-medium">Scored {item.score}% in "{item.quiz}"</p>
                    </div>
                    <button onClick={() => navigate(`/teacher/assessments`)} className="text-[10px] font-bold text-amber-800 dark:text-amber-400 underline underline-offset-2">Review</button>
                  </div>
                )) : (
                  <div className="p-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                    <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold">No performance alerts recorded.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DeleteModal
        isOpen={!!quizToDelete}
        onClose={() => setQuizToDelete(null)}
        onConfirm={handleDelete}
        title="Purge Assessment"
        message="Are you sure you want to permanently delete this assessment and all its submission history? This action is irreversible."
        isDeleting={!!isDeleting}
      />
    </div>
  );
}
