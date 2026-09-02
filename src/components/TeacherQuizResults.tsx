import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy, deleteDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission, Question, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Users, Trophy, Target, Calendar, Info, X, Trash2, Medal, Download, FileText, Plus, Minus, Search, Presentation, ShieldAlert, AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import DeleteModal from './DeleteModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TeacherQuizResults() {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<QuizSubmission | null>(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantSearch, setGrantSearch] = useState('');
  const [grantingStudentId, setGrantingStudentId] = useState<string | null>(null);
  const [draftResponses, setDraftResponses] = useState<QuizSubmission['responses']>([]);
  const [isSavingScore, setIsSavingScore] = useState(false);

  useEffect(() => {
    if (selectedSubmission) {
      setDraftResponses(selectedSubmission.responses);
    } else {
      setDraftResponses([]);
    }
  }, [selectedSubmission]);

  const handlePointsChange = (questionId: string, val: number) => {
    setDraftResponses(prev => prev.map(res => {
      if (res.questionId === questionId) {
        const points = Math.min(Math.max(0, val), res.maxPoints);
        return {
          ...res,
          pointsEarned: points,
          isCorrect: points === res.maxPoints
        };
      }
      return res;
    }));
  };

  const handleSaveGrades = async () => {
    if (!selectedSubmission || !draftResponses.length) return;
    try {
      setIsSavingScore(true);
      const newScore = draftResponses.reduce((acc, curr) => acc + curr.pointsEarned, 0);
      
      const subRef = doc(db, 'submissions', selectedSubmission.id);
      await updateDoc(subRef, {
        responses: draftResponses,
        score: newScore,
        graded: true
      });

      // Send a notification to the student automatically
      try {
        const { addLocalNotification } = await import('../lib/localNotifications');
        addLocalNotification(selectedSubmission.studentId, {
          title: '📝 Score Adjusted / Reviewed!',
          message: `Your submission on "${quiz.title}" was manually graded or adjusted by your instructor. Adjusted total: ${newScore}/${selectedSubmission.totalPoints}.`,
          type: 'assignment',
          relatedId: quiz.id
        });
      } catch (errNotif) {
        console.error("Failed to notify student of grade update:", errNotif);
      }

      setSelectedSubmission(null);
    } catch (err) {
      console.error("Failed to save overridden scores:", err);
    } finally {
      setIsSavingScore(false);
    }
  };

  const handleGrantExtraAttempt = async (studentId: string, countChange: number) => {
    if (!quiz || !id) return;
    try {
      setGrantingStudentId(studentId);
      const currentExtra = quiz.extraAttempts?.[studentId] || 0;
      const newExtraCount = Math.max(0, currentExtra + countChange);
      const updatedExtra = {
        ...(quiz.extraAttempts || {}),
        [studentId]: newExtraCount
      };
      
      await updateDoc(doc(db, 'quizzes', id), {
        extraAttempts: updatedExtra
      });

      setQuiz({ ...quiz, extraAttempts: updatedExtra });

      if (countChange > 0) {
        try {
          const { addLocalNotification } = await import('../lib/localNotifications');
          addLocalNotification(studentId, {
            title: '🔄 Extra Attempt Granted!',
            message: `The instructor has granted you an extra attempt on "${quiz.title}". You can take or retake this module now!`,
            type: 'assignment',
            relatedId: quiz.id
          });
        } catch (errNotif) {
          console.error("Failed to notify student of extra attempt:", errNotif);
        }
      }
    } catch (error) {
      console.error("Failed to update extra attempts:", error);
    } finally {
      setGrantingStudentId(null);
    }
  };

  useEffect(() => {
    if (!id || !profile) return;
    
    // 1. Fetch Quiz Metadata & Students
    const fetchData = async () => {
      try {
        const quizSnap = await getDoc(doc(db, 'quizzes', id));
        if (quizSnap.exists()) {
          setQuiz({ id: quizSnap.id, ...quizSnap.data() } as Quiz);
        }

        const studentSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
        setStudents(studentSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      } catch (error) {
        console.error(error);
      }
    };
    fetchData();

    // 2. Establish Real-time Submission Stream
    const q = query(
      collection(db, 'submissions'),
      where('quizId', '==', id),
      where('teacherId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allSubs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as QuizSubmission))
        .filter(sub => (sub as any).studentRole === 'student' || sub.studentId === profile.uid) // Include students or the teacher's own testing submissions
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      
      // De-duplicate: Keep only the latest attempt for each student
      const latestSubsMap = new Map<string, QuizSubmission>();
      allSubs.forEach(sub => {
        if (!latestSubsMap.has(sub.studentId)) {
          latestSubsMap.set(sub.studentId, sub);
        }
      });
      
      // Sort by score (percentage) descending for ranking
      const sortedSubs = Array.from(latestSubsMap.values()).sort((a, b) => {
        const scoreA = a.score / Math.max(a.totalPoints, 1);
        const scoreB = b.score / Math.max(b.totalPoints, 1);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (a.timeTaken || 0) - (b.timeTaken || 0); // Tie-break with efficiency
      });
      
      setSubmissions(sortedSubs);
      setLoading(false);
    }, (error) => {
      console.error("Live sync error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, profile]);

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;
  if (!quiz) return <div className="text-center py-20 text-slate-500 italic">Assessment module not found</div>;

  const stats = {
    avgScore: submissions.length > 0
      ? Math.round((submissions.reduce((acc, curr) => acc + (curr.score / curr.totalPoints), 0) / submissions.length) * 100)
      : 0,
    topScore: submissions.length > 0
      ? Math.max(...submissions.map(s => Math.round((s.score / s.totalPoints) * 100)))
      : 0
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      setIsDeleting(true);
      
      // 1. Delete associated submissions
      const subQuery = query(
        collection(db, 'submissions'), 
        where('quizId', '==', id),
        where('teacherId', '==', profile.uid)
      );
      const subSnap = await getDocs(subQuery);
      const deletePromises = subSnap.docs.map(d => deleteDoc(doc(db, 'submissions', d.id)));
      await Promise.all(deletePromises);

      // 2. Delete the quiz itself
      await deleteDoc(doc(db, 'quizzes', id));
      
      navigate('/teacher/assessments');
    } catch (error) {
      console.error("Deletion failed:", error);
      handleFirestoreError(error, OperationType.DELETE, `quizzes/${id}`);
      setIsDeleting(false);
    }
  };

  const getQuestion = (qId: string): Question | undefined => {
    return quiz?.questions.find(q => q.id === qId);
  };

  const exportToCSV = () => {
    if (!submissions.length || !quiz) return;

    // Sort alphabetically by full name for the export
    const sortedForExport = [...submissions].sort((a, b) => 
      a.studentName.localeCompare(b.studentName)
    );

    const headers = ['Full Name', 'Score', 'Total Score', 'Anti-Cheating Status', 'Breach Incidents'];
    const rows = sortedForExport.map(s => [
      `"${s.studentName}"`,
      s.score,
      s.totalPoints,
      `"${(s.antiCheatTriggered || (s.breachCount && s.breachCount > 0)) ? 'TRIGGERED (Flagged)' : 'CLEAN'}"`,
      s.breachCount || 0
    ]);

    const csvContent = [
      `"Assessment: ${quiz.title}"`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${quiz.title.replace(/\s+/g, '_')}_results.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    if (!submissions.length || !quiz) return;

    const doc = new jsPDF();
    
    // Logo / Brand
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // Indigo
    doc.text("BRAINREPS", 14, 25);
    
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.line(14, 28, 60, 28);
    
    // Right Header - Module Info
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text("PERFORMANCE ANALYTICS REPORT", 196, 18, { align: 'right' });
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text(quiz.title.toUpperCase(), 196, 25, { align: 'right' });

    // Info Section
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.1);
    doc.line(14, 35, 196, 35);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    
    doc.text("Instructor:", 14, 42);
    doc.setTextColor(30, 41, 59);
    doc.text(profile?.name || 'Administrator', 32, 42);

    doc.setTextColor(100, 116, 139);
    doc.text("Date Generated:", 80, 42);
    doc.setTextColor(30, 41, 59);
    doc.text(new Date().toLocaleDateString(), 105, 42);

    doc.setTextColor(100, 116, 139);
    doc.text("Total Participants:", 150, 42);
    doc.setTextColor(30, 41, 59);
    doc.text(submissions.length.toString(), 180, 42);

    doc.line(14, 48, 196, 48);

    // Results Table
    const alphabetSubs = [...submissions].sort((a, b) => a.studentName.localeCompare(b.studentName));

    const tableData = alphabetSubs.map((s, i) => [
      i + 1,
      s.studentId.substring(0, 8).toUpperCase(),
      s.studentName,
      s.score,
      `${Math.round((s.score / s.totalPoints) * 100)}%`,
      (s.antiCheatTriggered || (s.breachCount && s.breachCount > 0)) ? `TRIGGERED (${s.breachCount || 1}x)` : 'CLEAN'
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['#', 'User ID', 'Name', 'Score', 'Percentage', 'Anti-Cheat']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [30, 41, 59], 
        textColor: [255, 255, 255], 
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { 
        fontSize: 9, 
        cellPadding: 3,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
        font: 'helvetica'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 28 },
        2: { halign: 'left' },
        3: { halign: 'center', cellWidth: 22 },
        4: { halign: 'center', cellWidth: 24 },
        5: { halign: 'center', cellWidth: 32 }
      }
    });

    doc.save(`${quiz.title.replace(/\s+/g, '_')}_BrainReps_Report.pdf`);
  };

  const filteredSubmissions = submissions.filter(s => 
    s.studentName.toLowerCase().includes(participantSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/teacher')} className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 dark:text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{quiz.title}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium italic">Analytics Report • Generated {new Date().toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/teacher/present/${quiz.id}`)}
            className="p-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 text-xs font-bold active:scale-95"
            title="Launch Classroom Projector Presentation"
          >
            <Presentation className="w-4 h-4" />
            <span>Classroom Projector</span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={isDeleting}
            className="p-2.5 bg-white dark:bg-slate-900 text-red-500 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-900 transition-all shadow-sm flex items-center gap-2 text-xs font-bold disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? 'Deleting...' : 'Remove Module'}
          </button>
        </div>
      </header>

      <section className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-50 dark:border-slate-800 pb-2 mb-2">
            <Users className="h-3 w-3" /> Sample size
          </div>
          <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{submissions.length} <span className="text-sm font-medium text-slate-400 dark:text-slate-500">Students</span></h3>
        </div>
        <div className="rounded-xl bg-indigo-600 p-6 text-white shadow-xl shadow-indigo-600/20 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60 border-b border-white/10 pb-2 mb-2">
            <Target className="h-3 w-3" /> Success Metrics
          </div>
          <h3 className="text-3xl font-bold">{stats.avgScore}% <span className="text-sm font-medium opacity-60">Average</span></h3>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-500 dark:text-emerald-400 border-b border-slate-50 dark:border-slate-800 pb-2 mb-2">
            <Trophy className="h-3 w-3" /> Peak Result
          </div>
          <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.topScore}% <span className="text-sm font-medium text-slate-400 dark:text-slate-500">Score</span></h3>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div>
             <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Individual Participant Data</h2>
             <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Detailed tracking of student attempts and achievement levels.</p>
           </div>
           <div className="flex items-center gap-3">
             <div className="relative group">
               <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors" />
               <input 
                 type="text"
                 placeholder="Search student..."
                 value={participantSearch}
                 onChange={(e) => setParticipantSearch(e.target.value)}
                 className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-64"
               />
             </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowGrantModal(true)}
                className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all flex items-center gap-2 shadow-sm active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                Extra Attempts
              </button>
              <button 
                onClick={exportToCSV}
                className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button 
                onClick={exportToPDF}
                className="px-4 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-slate-900/10 active:scale-95"
              >
                <FileText className="w-3.5 h-3.5" />
                PDF Export
              </button>
            </div>
           </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Rank</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Participant</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">Date</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Result</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Percentile</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {filteredSubmissions.map((sub, i) => {
                  const rank = submissions.findIndex(s => s.id === sub.id) + 1;
                  return (
                    <motion.tr 
                      key={sub.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group cursor-pointer"
                      onClick={() => setSelectedSubmission(sub)}
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-center">
                          {rank === 1 ? (
                            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm border border-amber-200 dark:border-amber-800/50">
                              <Trophy className="h-4 w-4" />
                            </div>
                          ) : rank === 2 ? (
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700">
                              <Medal className="h-4 w-4" />
                            </div>
                          ) : rank === 3 ? (
                            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 shadow-sm border border-orange-100 dark:border-orange-800/50">
                              <Medal className="h-4 w-4" />
                            </div>
                          ) : (
                            <span className="text-xs font-black text-slate-300 dark:text-slate-700">#{rank}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 dark:text-slate-600 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors overflow-hidden">
                            {students.find(s => s.uid === sub.studentId)?.photoURL ? (
                              <img 
                                src={students.find(s => s.uid === sub.studentId)?.photoURL} 
                                alt={sub.studentName} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              sub.studentName.charAt(0)
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-slate-700 dark:text-slate-200 tracking-tight">{sub.studentName}</p>
                              
                              {/* Anti-Cheating Protocol Status Indicator (Marked in Red if triggered) */}
                              {(sub.antiCheatTriggered || (sub.breachCount && sub.breachCount > 0)) && (
                                <span 
                                  id={`anti-cheat-badge-${sub.id}`}
                                  className="inline-flex items-center gap-1 text-[8px] font-black uppercase text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/60 shadow-sm"
                                  title={sub.breachReason || `Anti-cheating violation detected${sub.breachCount ? ` (${sub.breachCount} breach event${sub.breachCount > 1 ? 's' : ''})` : ''}`}
                                >
                                  <AlertTriangle className="h-2.5 w-2.5 text-red-600 dark:text-red-400 shrink-0" />
                                  <span>Anti-Cheat Triggered{sub.breachCount && sub.breachCount > 1 ? ` (${sub.breachCount}x)` : ''}</span>
                                </span>
                              )}

                              {sub.status === 'in-progress' && (
                                <span className="text-[8px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-900 animate-pulse">In Progress</span>
                              )}
                              {sub.status !== 'in-progress' && (sub.graded ? (
                                <span className="text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-950/40">Graded</span>
                              ) : (
                                <span className="text-[8px] font-black uppercase text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40">Autograded</span>
                              ))}
                            </div>
                            <p className="text-[9px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-tighter">View Attempt Breakdown</p>
                          </div>
                          <Info className="h-3 w-3 text-slate-300 dark:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                          {new Date(sub.submittedAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{sub.score} <span className="text-slate-300 dark:text-slate-700">/ {sub.totalPoints}</span></p>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                           <div className="w-24 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                             <div 
                              className={cn("h-full transition-all duration-1000", (sub.score/sub.totalPoints) >= 0.7 ? "bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]" : "bg-slate-300 dark:bg-slate-700")} 
                              style={{ width: `${(sub.score/sub.totalPoints) * 100}%` }}
                             />
                           </div>
                           <span className="text-[10px] font-black text-slate-400 dark:text-slate-500">{Math.round((sub.score/sub.totalPoints) * 100)}%</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right font-medium" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleGrantExtraAttempt(sub.studentId, 1)}
                            disabled={grantingStudentId === sub.studentId}
                            title="Grant +1 Attempt"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold uppercase text-[10px] tracking-wider transition-all disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+1 Attempt</span>
                            {quiz.extraAttempts?.[sub.studentId] ? (
                              <span className="ml-1 bg-indigo-600 text-white font-black px-1.5 py-0.5 rounded-full text-[9px]">
                                +{quiz.extraAttempts[sub.studentId]}
                              </span>
                            ) : null}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
                {filteredSubmissions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-16 text-center text-slate-300 dark:text-slate-700 italic font-medium tracking-tight">
                      {participantSearch ? "No students matching your search criteria." : "No submission records detected in the database."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Breakdown Modal */}
      <AnimatePresence>
        {selectedSubmission && (() => {
          const draftScore = draftResponses.reduce((acc, curr) => acc + curr.pointsEarned, 0);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedSubmission(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100 dark:border-slate-800"
              >
                <header className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{selectedSubmission.studentName}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Performance Breakdown & Manual Grading • <span className="font-bold text-indigo-600 dark:text-indigo-400">{draftScore} / {selectedSubmission.totalPoints}</span> ({Math.round((draftScore / selectedSubmission.totalPoints) * 100)}%)
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedSubmission(null)}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 dark:text-slate-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>

                <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar flex-1">
                  {/* Anti-Cheating Protocol Status Alert Banner */}
                  {(selectedSubmission.antiCheatTriggered || (selectedSubmission.breachCount && selectedSubmission.breachCount > 0)) && (
                    <div 
                      id={`anti-cheat-alert-${selectedSubmission.id}`}
                      className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-3.5 text-red-700 dark:text-red-300 shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0 text-red-600 dark:text-red-400">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className="text-xs font-black uppercase tracking-wider text-red-700 dark:text-red-300">
                            Anti-Cheating Protocol Status: Triggered
                          </h4>
                          {selectedSubmission.breachCount ? (
                            <span className="text-[10px] font-black uppercase bg-red-100 dark:bg-red-900/70 text-red-800 dark:text-red-200 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                              {selectedSubmission.breachCount} Incident{selectedSubmission.breachCount > 1 ? 's' : ''} Logged
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-red-600 dark:text-red-300 font-medium leading-relaxed">
                          {selectedSubmission.breachReason || "Integrity breach logged: Student shifted window focus, attempted screen capture, or exited fullscreen during assessment."}
                        </p>
                      </div>
                    </div>
                  )}

                  {draftResponses.map((res, idx) => {
                    const q = getQuestion(res.questionId);
                    if (!q) return null;
                    
                    return (
                      <div key={idx} className="space-y-4 pb-6 border-b border-slate-100 dark:border-slate-800 last:border-b-0 last:pb-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Question {idx + 1} • {q.type.replace('-', ' ')}</span>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 leading-snug">{q.question}</h4>
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              "text-lg font-black",
                              res.pointsEarned === res.maxPoints ? "text-emerald-500 dark:text-emerald-400" : res.pointsEarned > 0 ? "text-amber-500 dark:text-amber-400" : "text-rose-500"
                            )}>
                              {res.pointsEarned} <span className="text-[10px] text-slate-350 dark:text-slate-650">/ {res.maxPoints}</span>
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-850/40 rounded-xl p-5 border border-slate-100 dark:border-slate-800 space-y-3">
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500">Student Response</p>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 italic">
                              {q.type === 'multiple-choice' && q.options && !isNaN(parseInt(res.answer))
                                ? `"${q.options[parseInt(res.answer)] || res.answer}"`
                                : `"${res.answer || "No response provided"}"`}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500">Correct Answer / Reference</p>
                            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                              {q.type === 'multiple-choice' && q.options && !isNaN(parseInt(q.correctAnswer))
                                ? q.options[parseInt(q.correctAnswer)]
                                : q.correctAnswer}
                            </p>
                          </div>
                        </div>

                        {/* Point Adjustment Intervention Controller */}
                        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/80">
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Manual Score Adjust</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Fine-tune or use fast grading pre-sets.</p>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Preset Buttons */}
                            <div className="flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-800 pr-3 mr-0.5">
                              <button
                                type="button"
                                onClick={() => handlePointsChange(res.questionId, res.maxPoints)}
                                className={cn(
                                  "px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all",
                                  res.pointsEarned === res.maxPoints 
                                    ? "bg-emerald-600 text-white shadow-sm" 
                                    : "bg-white hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/20 border border-slate-200 dark:border-slate-705 text-slate-600 dark:text-slate-350 hover:text-emerald-600"
                                )}
                              >
                                Full Credit
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePointsChange(res.questionId, 0)}
                                className={cn(
                                  "px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all",
                                  res.pointsEarned === 0 
                                    ? "bg-rose-600 text-white shadow-sm" 
                                    : "bg-white hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/20 border border-slate-200 dark:border-slate-705 text-slate-600 dark:text-slate-350 hover:text-rose-600"
                                )}
                              >
                                Zero Credit
                              </button>
                            </div>

                            {/* Fine-tune Incremental Selector */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handlePointsChange(res.questionId, res.pointsEarned - 1)}
                                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 hover:text-rose-500 dark:hover:bg-slate-700/60 transition-all flex items-center justify-center font-bold text-xs shadow-sm active:scale-95"
                                title="Decrease score by 1"
                              >
                                -1
                              </button>
                              <input
                                type="number"
                                min={0}
                                max={res.maxPoints}
                                step="any"
                                value={res.pointsEarned}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val)) {
                                    handlePointsChange(res.questionId, val);
                                  } else {
                                    handlePointsChange(res.questionId, 0);
                                  }
                                }}
                                className="w-16 py-1.5 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-slate-750 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                title="Enter score manually"
                              />
                              <button
                                type="button"
                                onClick={() => handlePointsChange(res.questionId, res.pointsEarned + 1)}
                                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 hover:text-emerald-500 dark:hover:bg-slate-700/60 transition-all flex items-center justify-center font-bold text-xs shadow-sm active:scale-95"
                                title="Increase score by 1"
                              >
                                +1
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <footer className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/35 flex items-center justify-between">
                  <div className="text-left">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Adjustment Total</span>
                    <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                      {draftScore} <span className="text-xs text-slate-400">/ {selectedSubmission.totalPoints} points</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedSubmission(null)}
                      className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveGrades}
                      disabled={isSavingScore}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
                    >
                      {isSavingScore ? (
                        <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                      ) : null}
                      Save Changes
                    </button>
                  </div>
                </footer>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Manage Extra Attempts Modal */}
      <AnimatePresence>
        {showGrantModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowGrantModal(false);
                setGrantSearch('');
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-slate-100 dark:border-slate-800"
            >
              <header className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">Extra Retake Attempts</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Grant or revoke extra retake counts for any student.</p>
                </div>
                <button 
                  onClick={() => {
                    setShowGrantModal(false);
                    setGrantSearch('');
                  }}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 dark:text-slate-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search student by name or email..."
                    value={grantSearch}
                    onChange={(e) => setGrantSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1 min-h-[300px]">
                {students
                  .filter(s => 
                    s.name?.toLowerCase().includes(grantSearch.toLowerCase()) || 
                    s.email?.toLowerCase().includes(grantSearch.toLowerCase())
                  )
                  .map((student) => {
                    const extra = quiz?.extraAttempts?.[student.uid] || 0;
                    const hasSubmissions = submissions.some(sub => sub.studentId === student.uid);

                    return (
                      <div key={student.uid} className="flex items-center justify-between p-3.5 bg-slate-50/55 dark:bg-slate-850/20 rounded-xl border border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-400 dark:text-slate-500 overflow-hidden">
                            {student.photoURL ? (
                              <img src={student.photoURL} alt={student.name} className="w-full h-full object-cover" />
                            ) : (
                              student.name?.charAt(0) || 'S'
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-700 dark:text-slate-200 leading-none mb-1">{student.name}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate max-w-[180px]">{student.email}</p>
                            {!hasSubmissions && (
                              <span className="text-[8px] font-bold text-slate-400 dark:text-slate-600 tracking-wide uppercase bg-slate-100 dark:bg-slate-800/50 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">No submission yet</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleGrantExtraAttempt(student.uid, -1)}
                            disabled={extra === 0 || grantingStudentId === student.uid}
                            className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-red-500 disabled:opacity-40 transition-all flex items-center justify-center h-7 w-7"
                            title="Decrease extra attempt"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          
                          <div className="w-8 text-center">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                              {extra}
                            </span>
                          </div>

                          <button
                            onClick={() => handleGrantExtraAttempt(student.uid, 1)}
                            disabled={grantingStudentId === student.uid}
                            className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 disabled:opacity-40 transition-all flex items-center justify-center h-7 w-7"
                            title="Increase extra attempt"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {students.filter(s => 
                  s.name?.toLowerCase().includes(grantSearch.toLowerCase()) || 
                  s.email?.toLowerCase().includes(grantSearch.toLowerCase())
                ).length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-xs text-slate-400 italic">No matching students found in current cohort.</p>
                  </div>
                )}
              </div>
              <footer className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end">
                <button
                  onClick={() => {
                    setShowGrantModal(false);
                    setGrantSearch('');
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  Done
                </button>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Purge Module"
        message="Are you sure you want to permanently delete this assessment and all student achievement data? This action will result in a total data purge."
        isDeleting={isDeleting}
      />
    </div>
  );
}
