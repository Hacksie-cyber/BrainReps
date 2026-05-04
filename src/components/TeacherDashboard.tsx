import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission, UserProfile } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { cn, formatDeadline } from '../lib/utils';
import { Plus, BarChart3, Clock, Users, ArrowRight, BookCheck, BookOpen, Trash2, UserX, ShieldAlert, Edit, Database } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import DeleteModal from './DeleteModal';

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [teacherCount, setTeacherCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [quizToDelete, setQuizToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      try {
        const qQuiz = query(
          collection(db, 'quizzes'),
          where('teacherId', '==', profile.uid)
        );
        let quizSnap;
        try {
          quizSnap = await getDocs(qQuiz);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'quizzes');
          return; // Should not reach here as error is thrown
        }

        const quizList = quizSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Quiz))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setQuizzes(quizList);

        // Fetch all students (the roster)
        const qStudents = query(collection(db, 'users'), where('role', '==', 'student'));
        let studentSnap;
        try {
          studentSnap = await getDocs(qStudents);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'users/students');
          return;
        }
        const studentList = studentSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        setStudents(studentList);

        // Fetch all teachers
        const qTeachers = query(collection(db, 'users'), where('role', '==', 'teacher'));
        let teacherSnap;
        try {
          teacherSnap = await getDocs(qTeachers);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'users/teachers');
          return;
        }
        const teacherList = teacherSnap.docs.map(doc => doc.data() as UserProfile);
        const filteredTeachersCount = teacherList.filter(t => t.email !== 'bamuyahacksie@gmail.com').length;
        setTeacherCount(filteredTeachersCount);

        const subQuery = query(
          collection(db, 'submissions'),
          where('teacherId', '==', profile.uid)
        );
        let subSnap;
        try {
          subSnap = await getDocs(subQuery);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'submissions');
          return;
        }
        const filteredSubs = subSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as QuizSubmission))
          .filter(s => s.studentRole === 'student'); // Exclude educators from statistics
        
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
      console.error("Deletion failed:", error);
      handleFirestoreError(error, OperationType.DELETE, `quizzes/${quizId}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const validQuizIds = new Set(quizzes.map(q => q.id));
  const validSubmissions = submissions.filter(s => validQuizIds.has(s.quizId));

  const activeQuizzes = quizzes.filter(q => {
    const isExpired = q.deadline ? new Date(q.deadline) < new Date() : false;
    return !q.isHidden && !isExpired;
  });
  const activeQuizIds = new Set(activeQuizzes.map(q => q.id));
  const activeSubmissions = validSubmissions.filter(s => activeQuizIds.has(s.quizId));

  // Identify all students who are assigned to AT LEAST ONE active quiz
  const assignedStudentIds = new Set<string>();
  activeQuizzes.forEach(q => {
    if (q.isPublic) {
      students.forEach(s => assignedStudentIds.add(s.uid));
    } else {
      q.allowedStudentIds?.forEach(id => assignedStudentIds.add(id));
    }
  });

  const uniqueStudentsCount = new Set(activeSubmissions.map(s => s.studentId)).size;
  const engagementRate = assignedStudentIds.size > 0 ? Math.round((uniqueStudentsCount / assignedStudentIds.size) * 100) : 0;
  
  const avgGrade = activeSubmissions.length > 0 
    ? Math.round((activeSubmissions.reduce((acc, curr) => acc + curr.score, 0) / Math.max(activeSubmissions.reduce((acc, curr) => acc + curr.totalPoints, 0), 1)) * 100)
    : 0;

  // Simple distribution calculation (0-20, 21-40, 41-60, 61-80, 81-100)
  const distribution = [0, 0, 0, 0, 0];
  activeSubmissions.forEach(s => {
    const percent = (s.score / Math.max(s.totalPoints, 1)) * 100;
    if (percent <= 20) distribution[0]++;
    else if (percent <= 40) distribution[1]++;
    else if (percent <= 60) distribution[2]++;
    else if (percent <= 80) distribution[3]++;
    else distribution[4]++;
  });

  const maxDist = Math.max(...distribution, 1);

  // Identify UNIQUE students from the ROSTER with performance or engagement alerts
  // Only include students who are assigned to at least one active assessment
  const studentMap = new Map<string, { id: string, name: string, earned: number, total: number, recentQuiz: string, submissionCount: number, recentSubmittedAt: string }>();
  
  // Initialize map only with assigned students
  students.filter(s => assignedStudentIds.has(s.uid)).forEach(s => {
    studentMap.set(s.uid, { id: s.uid, name: s.name, earned: 0, total: 0, recentQuiz: 'None', submissionCount: 0, recentSubmittedAt: '' });
  });

  // Batch process active submissions - finding the ABSOLUTE LATEST submission for each student
  activeSubmissions.forEach(s => {
    const current = studentMap.get(s.studentId);
    if (current) {
      if (!current.recentSubmittedAt || new Date(s.submittedAt) > new Date(current.recentSubmittedAt)) {
        current.earned = s.score;
        current.total = s.totalPoints;
        current.recentQuiz = s.quizTitle;
        current.recentSubmittedAt = s.submittedAt;
      }
      current.submissionCount += 1;
    }
  });

  const rosterInsights = Array.from(studentMap.values())
    .map(s => ({
      ...s,
      photoURL: students.find(std => std.uid === s.id)?.photoURL,
      percentage: s.total > 0 ? Math.round((s.earned / s.total) * 100) : null
    }))
    // Prioritize students with 0 submissions (Inactive) then low percentage in LATEST quiz
    .sort((a, b) => {
      if (a.submissionCount === 0 && b.submissionCount !== 0) return -1;
      if (a.submissionCount !== 0 && b.submissionCount === 0) return 1;
      return (a.percentage || 0) - (b.percentage || 0);
    })
    .slice(0, 5) // Show top 5 priority students
    .map(s => ({
      name: s.name,
      score: s.percentage,
      quiz: s.recentQuiz,
      type: s.submissionCount === 0 ? 'inactive' : 'at-risk' as const,
      photoURL: s.photoURL
    }));

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display tracking-tight">Dashboard Overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight italic">Monitor institutional performance and questionnaire management.</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/teacher/handouts"
            className="flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm active:scale-95"
          >
            <Database className="h-4 w-4 text-indigo-500" />
            Study Materials
          </Link>
          <Link
            to="/teacher/create"
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Create Questionnaire
          </Link>
        </div>
      </header>

      {/* Analytics Overview */}
      <section className="grid gap-6 lg:grid-cols-4 xl:grid-cols-6 text-center lg:text-left">
        <div className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 group">
          <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 font-sans">Active Modules</p>
          <h3 className="text-3xl font-bold font-display text-slate-900 dark:text-slate-50 leading-none">{activeQuizzes.length}</h3>
          <p className="text-emerald-600 dark:text-emerald-400 text-[11px] mt-4 flex items-center justify-center lg:justify-start font-bold italic">
            {quizzes.length - activeQuizzes.length} Inactive / Hidden
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 group">
          <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 font-sans">Cohort GPA</p>
          <h3 className="text-3xl font-bold font-display text-slate-900 dark:text-slate-50 leading-none">{avgGrade}%</h3>
          <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-4 font-medium tracking-tight italic">Verified academic metric</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 group">
          <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 font-sans">Total Responses</p>
          <h3 className="text-3xl font-bold font-display text-slate-900 dark:text-slate-50 leading-none">{validSubmissions.length}</h3>
          <p className="text-indigo-600 dark:text-indigo-400 text-[11px] mt-4 font-bold italic">{activeSubmissions.length} Active context</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 group">
          <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 font-sans">Audience reach</p>
          <h3 className="text-3xl font-bold font-display text-slate-900 dark:text-slate-50 leading-none">{engagementRate}%</h3>
          <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-4 font-medium italic">Participation velocity</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 group">
          <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 font-sans">Assigned Roster</p>
          <h3 className="text-3xl font-bold font-display text-slate-900 dark:text-slate-50 leading-none">{assignedStudentIds.size}</h3>
          <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-4 font-medium italic">Baseline participants</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 group">
          <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 font-sans">Faculty Peers</p>
          <h3 className="text-3xl font-bold font-display text-slate-900 dark:text-slate-50 leading-none">{teacherCount}</h3>
          <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-4 font-medium italic">Expert verified collaborators</p>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-8 min-h-0">
        {/* Main Content Split */}
        <div className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col shadow-sm transition-all overflow-hidden lg:h-[700px]">
          <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/10 backdrop-blur-sm">
            <h2 className="font-bold font-display text-slate-900 dark:text-slate-50 flex items-center gap-3">
              <BookCheck className="h-5 w-5 text-indigo-500" />
              Institutional Curricula
            </h2>
            <Link to="/teacher/assessments" className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700 transition-colors">Details Inventory</Link>
          </div>
          <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200">
            {quizzes.length === 0 ? (
               <div className="p-20 text-center text-slate-400 dark:text-slate-600">
                  <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-10" />
                  <p className="text-sm italic font-medium">No instructional modules discovered in current matrix.</p>
               </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-50 dark:border-slate-800">
                    <th className="px-8 py-4 font-black">Assessment Metadata</th>
                    <th className="px-8 py-4 font-black text-center">Responses</th>
                    <th className="px-8 py-4 font-black">Success Ratio</th>
                    <th className="px-8 py-4 font-black text-right pr-12">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {quizzes.map((quiz) => {
                    const qSubsRaw = submissions.filter(s => s.quizId === quiz.id);
                    const studentLatestMap = new Map<string, QuizSubmission>();
                    qSubsRaw.forEach(s => {
                      const isAssigned = quiz.isPublic || quiz.allowedStudentIds?.includes(s.studentId);
                      if (isAssigned) {
                        if (!studentLatestMap.has(s.studentId) || new Date(s.submittedAt) > new Date(studentLatestMap.get(s.studentId)!.submittedAt)) {
                          studentLatestMap.set(s.studentId, s);
                        }
                      }
                    });
                    
                    const qSubs = Array.from(studentLatestMap.values());
                    const targetAudienceCount = quiz.isPublic ? students.length : (quiz.allowedStudentIds?.length || 0);
                    
                    const avg = qSubs.length > 0
                      ? Math.round((qSubs.reduce((acc, curr) => acc + curr.score, 0) / Math.max(qSubs.reduce((acc, curr) => acc + curr.totalPoints, 0), 1)) * 100)
                      : '--';
                    return (
                      <tr key={quiz.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer" onClick={() => navigate(`/teacher/quiz/${quiz.id}`)}>
                        <td className="px-8 py-7">
                          <p className="font-bold text-slate-900 dark:text-slate-50 tracking-tight text-base leading-tight group-hover:text-indigo-600 transition-colors uppercase italic">{quiz.title}</p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5">
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold flex items-center gap-1.5">
                              {new Date(quiz.createdAt).toLocaleDateString()} • {quiz.questions.length} Questions
                              {quiz.isPublic ? (
                                <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] px-1.5 py-0.5 rounded font-black uppercase border border-emerald-100/50">Public</span>
                              ) : (
                                <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[9px] px-1.5 py-0.5 rounded font-black uppercase border border-indigo-100/50">Restricted</span>
                              )}
                            </p>
                              {quiz.deadline && (
                                <div className={cn(
                                  "text-[9px] font-black uppercase tracking-tight flex items-center gap-1.5 px-2 py-0.5 rounded border shadow-sm",
                                  new Date(quiz.deadline) < new Date() 
                                    ? "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 border-red-100/50 dark:border-red-900/30 animate-pulse" 
                                    : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-800"
                                )}>
                                  <Clock className="h-3 w-3" />
                                  {new Date(quiz.deadline) < new Date() ? "Expired" : formatDeadline(quiz.deadline)}
                                </div>
                              )}
                          </div>
                        </td>
                        <td className="px-8 py-7 text-center">
                           <div className="inline-flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100/50 dark:border-slate-700 shadow-sm">
                              <Users className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                                {qSubs.length} <span className="text-slate-400 font-bold ml-1">/ {targetAudienceCount}</span>
                              </span>
                           </div>
                        </td>
                        <td className="px-8 py-7">
                           <div className="flex items-center gap-4">
                             <div className="w-20 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden hidden xl:block border border-slate-200/50 dark:border-slate-700 shadow-inner">
                               <div 
                                 style={{ width: avg !== '--' ? `${avg}%` : '0%' }}
                                 className="bg-indigo-600 h-full transition-all duration-1000 ease-out" 
                               />
                             </div>
                             <span className={cn("font-black font-display text-base tracking-tight", avg !== '--' ? "text-slate-900 dark:text-slate-50" : "text-slate-300 dark:text-slate-700")}>{avg}{avg !== '--' ? '%' : ''}</span>
                           </div>
                        </td>
                        <td className="px-8 py-7 text-right pr-12">
                           <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 navigate(`/student/quiz/${quiz.id}`);
                               }}
                               className="p-2.5 bg-white dark:bg-slate-900 text-slate-400 hover:text-indigo-600 border border-slate-100 dark:border-slate-800 rounded-xl transition-all shadow-sm active:scale-90"
                               title="Review Assessment"
                             >
                                <BookOpen className="h-4 w-4" />
                             </button>
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 navigate(`/teacher/edit/${quiz.id}`);
                               }}
                               className="p-2.5 bg-white dark:bg-slate-900 text-slate-400 hover:text-indigo-600 border border-slate-100 dark:border-slate-800 rounded-xl transition-all shadow-sm active:scale-90"
                               title="Modulate Content"
                             >
                                <Edit className="h-4 w-4" />
                             </button>
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setQuizToDelete(quiz.id);
                               }}
                               disabled={isDeleting === quiz.id}
                               className={cn(
                                 "p-2.5 bg-white dark:bg-slate-900 rounded-xl transition-all shadow-sm active:scale-90 border border-slate-100 dark:border-slate-800",
                                 isDeleting === quiz.id ? "text-slate-200 animate-pulse" : "text-slate-400 hover:text-red-500"
                               )}
                               title="Purge Module"
                             >
                                <Trash2 className="h-4 w-4" />
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
        <div className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col shadow-sm transition-all overflow-hidden lg:h-[700px]">
          <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/10 backdrop-blur-sm">
            <h2 className="font-bold font-display text-slate-900 dark:text-slate-50 flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              Scoring Distribution
            </h2>
          </div>
          <div className="p-8 flex-1 overflow-auto space-y-12 scrollbar-thin scrollbar-thumb-slate-200">
            <div>
              <div className="flex justify-between items-end mb-6">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Institutional Spread</p>
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full border border-indigo-100/50 dark:border-indigo-900/30 uppercase tracking-widest italic">Peak Intensity: {Math.max(...distribution)}</span>
              </div>
              <div className="h-48 flex items-end gap-3 font-sans">
                {distribution.map((val, i) => (
                  <div 
                    key={i} 
                    className="bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-600 transition-all rounded-xl w-full cursor-help group relative shadow-inner overflow-hidden" 
                    style={{ height: `${(val / maxDist) * 100}%` }}
                  >
                     <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                     <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 whitespace-nowrap z-30 shadow-2xl">
                        {val} Active Responses
                     </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-600 font-bold mt-6 tracking-tighter uppercase italic">
                <span>0-20%</span>
                <span>40%</span>
                <span>60%</span>
                <span>80%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="space-y-8 pb-4">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                 <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                 Instructional Interventions
              </p>
              <div className="space-y-4">
                {rosterInsights.length > 0 ? rosterInsights.map((item, i) => (
                  <div key={i} className={cn(
                    "flex items-center gap-4 p-5 rounded-2xl border group transition-all duration-300",
                    item.type === 'inactive' 
                      ? "bg-slate-50/50 dark:bg-slate-800/10 border-slate-100 dark:border-slate-800 shadow-sm" 
                      : "bg-amber-50/40 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 hover:border-amber-200 shadow-sm hover:shadow-md"
                  )}>
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base transition-all group-hover:scale-110 shadow-sm uppercase font-display overflow-hidden",
                      item.type === 'inactive' 
                        ? "bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700" 
                        : "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                    )}>
                      {item.type === 'inactive' ? (
                        <UserX className="w-6 h-6 opacity-60" />
                      ) : (
                        item.photoURL ? (
                          <img src={item.photoURL} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          item.name.charAt(0)
                        )
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className={cn(
                        "text-sm font-bold tracking-tight truncate font-display",
                        item.type === 'inactive' ? "text-slate-800 dark:text-slate-200" : "text-amber-900 dark:text-amber-100"
                      )}>{item.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-500 font-medium tracking-tight mt-1 italic uppercase">
                        {item.type === 'inactive' ? 'Activity Gap Detected' : `Accuracy: ${item.score}% • "${item.quiz}"`}
                      </p>
                    </div>
                    <button onClick={() => navigate(`/teacher/students`)} className="p-2.5 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-all shrink-0 active:scale-90">
                       <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )) : (
                  <div className="p-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/20 dark:bg-slate-800/10">
                    <p className="text-xs text-slate-400 dark:text-slate-600 font-bold italic tracking-tight">No high-priority roster alerts identified.</p>
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
        message="Are you sure you want to permanently delete this assessment and all its submission history? This action is irreversible within the institutional database."
        isDeleting={!!isDeleting}
      />
    </div>
  );
}
