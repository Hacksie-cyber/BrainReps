import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission, Question } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Users, Trophy, Target, Calendar, Info, X, Trash2, Medal, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import DeleteModal from './DeleteModal';

export default function TeacherQuizResults() {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<QuizSubmission | null>(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!id || !profile) return;
    
    // 1. Fetch Quiz Metadata (Static)
    const fetchQuiz = async () => {
      try {
        const quizSnap = await getDoc(doc(db, 'quizzes', id));
        if (quizSnap.exists()) {
          setQuiz({ id: quizSnap.id, ...quizSnap.data() } as Quiz);
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchQuiz();

    // 2. Establish Real-time Submission Stream
    const q = query(
      collection(db, 'submissions'),
      where('quizId', '==', id),
      where('teacherId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allSubs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as QuizSubmission))
        .filter(sub => (sub as any).studentRole === 'student') // Exclude educators from results
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
      console.error(error);
      alert('Deletion failed: Database link interrupted.');
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

    const headers = ['Full Name', 'Score', 'Total Score'];
    const rows = sortedForExport.map(s => [
      `"${s.studentName}"`,
      s.score,
      s.totalPoints
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

  const filteredSubmissions = submissions.filter(s => 
    s.studentName.toLowerCase().includes(participantSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/teacher')} className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors text-slate-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{quiz.title}</h1>
            <p className="text-sm text-slate-500 font-medium italic">Analytics Report • Generated {new Date().toLocaleDateString()}</p>
          </div>
        </div>
        <button
          onClick={() => setShowDeleteModal(true)}
          disabled={isDeleting}
          className="p-2.5 bg-white text-red-500 border border-slate-200 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all shadow-sm flex items-center gap-2 text-xs font-bold disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          {isDeleting ? 'Deleting...' : 'Remove Module'}
        </button>
      </header>

      <section className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-50 pb-2 mb-2">
            <Users className="h-3 w-3" /> Sample size
          </div>
          <h3 className="text-3xl font-bold text-slate-900">{submissions.length} <span className="text-sm font-medium text-slate-400">Students</span></h3>
        </div>
        <div className="rounded-xl bg-indigo-600 p-6 text-white shadow-xl shadow-indigo-600/20 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60 border-b border-white/10 pb-2 mb-2">
            <Target className="h-3 w-3" /> Success Metrics
          </div>
          <h3 className="text-3xl font-bold">{stats.avgScore}% <span className="text-sm font-medium opacity-60">Average</span></h3>
        </div>
        <div className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-500 border-b border-slate-50 pb-2 mb-2">
            <Trophy className="h-3 w-3" /> Peak Result
          </div>
          <h3 className="text-3xl font-bold text-slate-900">{stats.topScore}% <span className="text-sm font-medium text-slate-400">Score</span></h3>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div>
             <h2 className="text-lg font-bold text-slate-800">Individual Participant Data</h2>
             <p className="text-xs text-slate-400 font-medium">Detailed tracking of student attempts and achievement levels.</p>
           </div>
           <div className="flex items-center gap-3">
             <div className="relative group">
               <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
               <input 
                 type="text"
                 placeholder="Search student..."
                 value={participantSearch}
                 onChange={(e) => setParticipantSearch(e.target.value)}
                 className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-64"
               />
             </div>
             <button 
               onClick={exportToCSV}
               className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-900/10 active:scale-95"
             >
               <Download className="w-3.5 h-3.5" />
               Export CSV
             </button>
           </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Rank</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Participant</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Date</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Result</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Percentile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSubmissions.map((sub, i) => {
                  const rank = submissions.findIndex(s => s.id === sub.id) + 1;
                  return (
                    <motion.tr 
                      key={sub.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedSubmission(sub)}
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-center">
                          {rank === 1 ? (
                            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm border border-amber-200">
                              <Trophy className="h-4 w-4" />
                            </div>
                          ) : rank === 2 ? (
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shadow-sm border border-slate-200">
                              <Medal className="h-4 w-4" />
                            </div>
                          ) : rank === 3 ? (
                            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 shadow-sm border border-orange-100">
                              <Medal className="h-4 w-4" />
                            </div>
                          ) : (
                            <span className="text-xs font-black text-slate-300">#{rank}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            {sub.studentName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-700 tracking-tight">{sub.studentName}</p>
                              {sub.status === 'in-progress' && (
                                <span className="text-[8px] font-black uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 animate-pulse">In Progress</span>
                              )}
                            </div>
                            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">View Attempt Breakdown</p>
                          </div>
                          <Info className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className="text-[10px] font-bold text-slate-400">
                          {new Date(sub.submittedAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm font-bold text-slate-800">{sub.score} <span className="text-slate-300">/ {sub.totalPoints}</span></p>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                           <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                             <div 
                              className={cn("h-full transition-all duration-1000", (sub.score/sub.totalPoints) >= 0.7 ? "bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]" : "bg-slate-300")} 
                              style={{ width: `${(sub.score/sub.totalPoints) * 100}%` }}
                             />
                           </div>
                           <span className="text-[10px] font-black text-slate-400">{Math.round((sub.score/sub.totalPoints) * 100)}%</span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
                {filteredSubmissions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-16 text-center text-slate-300 italic font-medium tracking-tight">
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
        {selectedSubmission && (
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
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <header className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight">{selectedSubmission.studentName}</h3>
                  <p className="text-xs text-slate-500 font-medium">Performance Breakdown • {selectedSubmission.score} / {selectedSubmission.totalPoints}</p>
                </div>
                <button 
                  onClick={() => setSelectedSubmission(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="p-8 overflow-y-auto space-y-8">
                {selectedSubmission.responses.map((res, idx) => {
                  const q = getQuestion(res.questionId);
                  if (!q) return null;
                  
                  return (
                    <div key={idx} className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Question {idx + 1}</span>
                          <h4 className="font-bold text-slate-800 leading-snug">{q.question}</h4>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "text-lg font-black",
                            res.pointsEarned === res.maxPoints ? "text-emerald-500" : res.pointsEarned > 0 ? "text-amber-500" : "text-slate-300"
                          )}>
                            {res.pointsEarned} <span className="text-[10px] text-slate-300">/ {res.maxPoints}</span>
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-3">
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase text-slate-400">Student Response</p>
                          <p className="text-sm font-medium text-slate-700 italic">
                            {q.type === 'multiple-choice' && q.options && !isNaN(parseInt(res.answer))
                              ? `"${q.options[parseInt(res.answer)] || res.answer}"`
                              : `"${res.answer || "No response provided"}"`}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase text-slate-400">Correct Answer / Reference</p>
                          <p className="text-sm font-bold text-indigo-600">
                            {q.type === 'multiple-choice' && q.options && !isNaN(parseInt(q.correctAnswer))
                              ? q.options[parseInt(q.correctAnswer)]
                              : q.correctAnswer}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
