import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission } from '../types';
import { motion } from 'motion/react';
import { GraduationCap, Mail, Calendar, Target, Search, User, Download } from 'lucide-react';
import { cn } from '../lib/utils';

interface StudentMetric {
  uid: string;
  name: string;
  email: string;
  submissions: QuizSubmission[];
  avgScore: number;
  lastActive: string;
}

export default function TeacherStudents() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<StudentMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!profile) return;

    const fetchStudents = async () => {
      try {
        // Query submissions for this teacher's quizzes
        const subSnap = await getDocs(query(
          collection(db, 'submissions'),
          where('teacherId', '==', profile.uid)
        ));
        const subs = subSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as QuizSubmission))
          .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

        // Group by student
        const studentMap = new Map<string, StudentMetric>();

        subs.forEach(s => {
          if (!studentMap.has(s.studentId)) {
            studentMap.set(s.studentId, {
              uid: s.studentId,
              name: s.studentName,
              email: '', // We don't have email in submission usually, but we could fetch it if needed
              submissions: [],
              avgScore: 0,
              lastActive: s.submittedAt
            });
          }
          const metric = studentMap.get(s.studentId)!;
          metric.submissions.push(s);
          if (new Date(s.submittedAt) > new Date(metric.lastActive)) {
            metric.lastActive = s.submittedAt;
          }
        });

        // Calculate averages
        const studentList = Array.from(studentMap.values()).map(s => ({
          ...s,
          avgScore: Math.round((s.submissions.reduce((acc, curr) => acc + (curr.score / curr.totalPoints), 0) / s.submissions.length) * 100)
        }));

        setStudents(studentList);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [profile]);

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToCSV = () => {
    if (!students.length) return;

    // Sort alphabetically by full name for the export
    const sortedForExport = [...students].sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    const headers = ['Student Name', 'Total Submissions', 'Average Score (%)', 'Last Active'];
    const rows = sortedForExport.map(s => [
      `"${s.name}"`,
      s.submissions.length,
      s.avgScore,
      new Date(s.lastActive).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `student_roster_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Student Roster</h1>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Participant performance monitoring and engagement tracking.</p>
        </div>
        <button 
          onClick={exportToCSV}
          className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-800 shadow-lg shadow-slate-900/10 active:scale-95"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </header>

      <section className="space-y-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search roster by participant name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-600 placeholder:text-slate-300 italic"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {filteredStudents.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-300 italic font-medium">
              <User className="h-12 w-12 mx-auto mb-4 opacity-10" />
              No active participants detected in the assessment logs.
            </div>
          ) : (
            filteredStudents.map((student, i) => (
              <motion.div
                key={student.uid}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between group hover:border-indigo-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    <User className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-800 tracking-tight">{student.name}</h3>
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" /> Last Active: {new Date(student.lastActive).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                        <Target className="h-3 w-3" /> Modules Engagement: {student.submissions.length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className={cn(
                    "text-2xl font-black",
                    student.avgScore >= 70 ? "text-indigo-600" : "text-amber-500"
                  )}>
                    {student.avgScore}%
                  </p>
                  <p className="text-[9px] font-black uppercase text-slate-300 tracking-tighter">Avg achievement</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
