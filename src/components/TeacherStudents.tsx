import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission } from '../types';
import { motion } from 'motion/react';
import { GraduationCap, Mail, Calendar, Target, Search, User, Download, ShieldAlert, UserMinus, UserCheck, Trash2 } from 'lucide-react';
import { updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import DeleteModal from './DeleteModal';

interface StudentMetric {
  uid: string;
  name: string;
  email: string;
  submissions: QuizSubmission[];
  avgScore: number;
  lastActive: string;
  isBanned?: boolean;
}

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TeacherStudents() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<StudentMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<StudentMetric | null>(null);

  const isSuperAdmin = profile?.email === 'bamuyahacksie@gmail.com';

  useEffect(() => {
    if (!profile) return;

    const fetchStudents = async () => {
      try {
        // 1. Fetch the institutional student roster (all students)
        const rostersSnap = await getDocs(query(
          collection(db, 'users'),
          where('role', '==', 'student')
        ));
        
        const allStudents = rostersSnap.docs.map(d => ({
          uid: d.id,
          name: d.data().name || 'Anonymous Learner',
          email: d.data().email || '',
          isBanned: d.data().isBanned || false,
          submissions: [],
          avgScore: 0,
          lastActive: d.data().createdAt || new Date().toISOString()
        } as StudentMetric));

        // 2. Fetch all assessments to identify active curriculum
        const quizSnap = await getDocs(query(
          collection(db, 'quizzes'),
          where('teacherId', '==', profile.uid)
        ));
        const activeQuizIds = new Set(quizSnap.docs.filter(d => !d.data().isHidden).map(d => d.id));

        // 3. Fetch all submissions for this teacher's modules to calculate performance metrics
        const subSnap = await getDocs(query(
          collection(db, 'submissions'),
          where('teacherId', '==', profile.uid)
        ));
        
        // Filter submissions to only include those from ACTIVE quizzes
        const activeSubs = subSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as QuizSubmission))
          .filter(s => activeQuizIds.has(s.quizId));

        // Group metrics by student, keeping only the LATEST effort for each assessment to avoid skewing
        const studentMap = new Map<string, Map<string, QuizSubmission>>();
        activeSubs.forEach(s => {
          if (!studentMap.has(s.studentId)) studentMap.set(s.studentId, new Map());
          const studentQuizMap = studentMap.get(s.studentId)!;
          
          if (!studentQuizMap.has(s.quizId) || new Date(s.submittedAt) > new Date(studentQuizMap.get(s.quizId)!.submittedAt)) {
            studentQuizMap.set(s.quizId, s);
          }
        });

        const detailedStudents = allStudents.map(student => {
          const studentQuizMap = studentMap.get(student.uid) || new Map<string, QuizSubmission>();
          const studentSubs = Array.from(studentQuizMap.values());
          // Sort to find the ABSOLUTE LATEST submission across all quizzes
          const sortedSubs = [...activeSubs.filter(s => s.studentId === student.uid)].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
          
          const latestSubmission = sortedSubs.length > 0 ? sortedSubs[0] : null;

          return {
            ...student,
            submissions: studentSubs,
            avgScore: latestSubmission
              ? Math.round((latestSubmission.score / Math.max(latestSubmission.totalPoints, 1)) * 100)
              : 0,
            lastActive: sortedSubs.length > 0 ? sortedSubs[0].submittedAt : student.lastActive
          };
        });

        // Sort by name as default
        detailedStudents.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(detailedStudents);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [profile]);

  const totalMatches = students.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).length;
  const filteredStudents = students
    .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, searchTerm ? 50 : 10);

  const exportToCSV = () => {
    if (!students.length) return;

    // Sort alphabetically by full name for the export
    const sortedForExport = [...students].sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    const headers = ['Full Name', 'Latest Score (%)'];
    const rows = sortedForExport.map(s => [
      `"${s.name}"`,
      `"${s.avgScore}%"`
    ]);

    const csvContent = [
      '"Student Roster Summary"',
      '',
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

  const exportToPDF = () => {
    if (!students.length) return;

    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();
    
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229);
    doc.text("Institutional Student Roster", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${timestamp}`, 14, 30);
    doc.text(`Educator: ${profile?.name || 'Authorized Instructor'}`, 14, 35);

    const tableData = students
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s, i) => [
        i + 1,
        s.name,
        s.email,
        `${s.avgScore}%`,
        s.isBanned ? 'Restricted' : 'Active'
      ]);

    autoTable(doc, {
      startY: 45,
      head: [['#', 'Full Name', 'Email Identifier', 'Academic Score', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        4: { fontStyle: 'bold' }
      }
    });

    const fileName = `student_roster_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  const toggleBan = async (student: StudentMetric) => {
    try {
      const newStatus = !student.isBanned;
      await updateDoc(doc(db, 'users', student.uid), {
        isBanned: newStatus
      });
      setStudents(students.map(s => s.uid === student.uid ? { ...s, isBanned: newStatus } : s));
    } catch (error) {
      console.error("Governance action failed:", error);
      alert("Failed to update student access rights.");
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete || !isSuperAdmin) return;
    const student = studentToDelete;

    try {
      setIsDeleting(student.uid);

      // 1. Purge all associated submissions for this student definitively
      // We query without teacherId filter because as SuperAdmin we have blanket read access
      const subSnap = await getDocs(query(
        collection(db, 'submissions'),
        where('studentId', '==', student.uid)
      ));
      
      if (!subSnap.empty) {
        // Use sequential execution to prevent rules engine saturation
        for (const docSnapshot of subSnap.docs) {
          await deleteDoc(doc(db, 'submissions', docSnapshot.id));
        }
      }

      // 2. Definitive removal of the participant profile from the registry
      await deleteDoc(doc(db, 'users', student.uid));
      
      setStudents(students.filter(s => s.uid !== student.uid));
      setStudentToDelete(null);
    } catch (error: any) {
      console.error("Decommissioning failed:", error);
      alert(`Decommissioning failed: ${error.message || 'Access denied by database protocols.'}`);
    } finally {
      setIsDeleting(null);
    }
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Student Roster</h1>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Participant performance monitoring and engagement tracking.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 rounded-lg bg-white border border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 shadow-sm active:scale-95"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button 
            onClick={exportToPDF}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-800 shadow-lg shadow-slate-900/10 active:scale-95"
          >
            <Download className="h-4 w-4 text-indigo-400" />
            Export PDF
          </button>
        </div>
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
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                    student.isBanned ? "bg-red-50 text-red-400" : "bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                  )}>
                    <User className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 tracking-tight">{student.name}</h3>
                      {student.isBanned && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[8px] font-black uppercase tracking-tighter flex items-center gap-0.5">
                          <ShieldAlert className="w-2.5 h-2.5" /> Restricted
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                        <Mail className="h-3 w-3" /> {student.email}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" /> Last Active: {new Date(student.lastActive).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <p className={cn(
                        "text-2xl font-black",
                        student.isBanned ? "text-slate-300" : (student.avgScore >= 70 ? "text-indigo-600" : "text-amber-500")
                      )}>
                        {student.avgScore}%
                      </p>
                      <p className="text-[9px] font-black uppercase text-slate-300 tracking-tighter">Latest achievement</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       {isSuperAdmin && (
                         <button
                           onClick={() => setStudentToDelete(student)}
                           disabled={!!isDeleting}
                           className="p-2 bg-red-50 text-red-400 hover:text-red-600 border border-red-100 rounded-lg transition-all hover:bg-red-100"
                           title="Permanently Decommission Participant"
                         >
                            <Trash2 className="w-3.5 h-3.5" />
                         </button>
                       )}
                       <button
                        onClick={() => toggleBan(student)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-2",
                          student.isBanned 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100" 
                            : "bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
                        )}
                       >
                        {student.isBanned ? (
                          <><UserCheck className="w-3.5 h-3.5" /> Unban</>
                        ) : (
                          <><UserMinus className="w-3.5 h-3.5" /> Ban</>
                        )}
                      </button>
                    </div>
                  </div>
              </motion.div>
            ))
          )}
        </div>

        {totalMatches > filteredStudents.length && (
          <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
            <p className="text-xs font-bold text-slate-400 italic">
              Showing {filteredStudents.length} of {totalMatches} matching participants. 
              {searchTerm ? "Refine your search for more specific results." : "Use the search bar above to locate a specific student."}
            </p>
          </div>
        )}
      </section>

      <DeleteModal
        isOpen={!!studentToDelete}
        onClose={() => setStudentToDelete(null)}
        onConfirm={handleDeleteStudent}
        title="Purge Participant Data"
        message={`This action will permanently delete ${studentToDelete?.name}'s account and ALL their associated academic results from the institution. This operation is irreversible.`}
        isDeleting={!!isDeleting}
      />
    </div>
  );
}
