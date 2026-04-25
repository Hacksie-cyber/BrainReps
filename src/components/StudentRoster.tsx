import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { GraduationCap, Mail, Search, User, Award, BookOpen, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

export default function StudentRoster() {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const studentQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          orderBy('name', 'asc')
        );
        const snapshot = await getDocs(studentQuery);
        setStudents(snapshot.docs.map(doc => doc.data() as UserProfile));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header>
        <h1 className="text-3xl font-bold font-display text-slate-800 dark:text-slate-100 tracking-tight">Peer Roster</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Meet your fellow learners and academic peers within the institutional framework.</p>
      </header>

      <section className="space-y-8">
        <div className="relative group">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-300 dark:text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search by peer name or academic identifier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 py-5 pl-14 pr-6 text-sm font-medium text-slate-800 dark:text-slate-100 shadow-sm focus:border-indigo-100 dark:focus:border-indigo-900 focus:ring-4 focus:ring-indigo-600/5 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700 placeholder:italic"
          />
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.length === 0 ? (
            <div className="col-span-full py-24 text-center">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800 opacity-20">
                <User className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-400 dark:text-slate-600 italic font-medium tracking-tight">No peer profiles detected within the current institutional scope.</p>
            </div>
          ) : (
            filteredStudents.slice(0, 30).map((student, i) => (
              <motion.div
                key={student.uid}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group relative flex flex-col items-center bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:-translate-y-2 hover:border-indigo-100 dark:hover:border-indigo-900 transition-all duration-300 overflow-hidden cursor-pointer"
              >
                {/* Visual Identity Decor */}
                <div className="absolute top-0 right-0 p-3 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
                   <GraduationCap className="w-16 h-16 text-indigo-600 rotate-12" />
                </div>
                
                <div className="mb-6 relative">
                  <div className="w-24 h-24 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 border border-slate-100 dark:border-slate-700 shadow-sm group-hover:shadow-[0_10px_20px_rgba(79,70,229,0.2)]">
                    <User className="h-10 w-10" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white dark:bg-slate-900 rounded-xl shadow-lg flex items-center justify-center border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  </div>
                </div>

                <h3 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight leading-tight mb-1">{student.name}</h3>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-600 tracking-[0.2em] mb-6">Verified Learner</p>
                
                <div className="w-full grid grid-cols-2 gap-4 pt-6 mt-auto border-t border-slate-50 dark:border-slate-800">
                   <div className="flex flex-col items-center border-r border-slate-100 dark:border-slate-800">
                      <span className="text-[9px] font-black uppercase text-slate-300 dark:text-slate-700 tracking-widest mb-1 leading-none">Matriculation</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-display">{new Date(student.createdAt).getFullYear()}</span>
                   </div>
                   <div className="flex flex-col items-center">
                      <span className="text-[9px] font-black uppercase text-slate-300 dark:text-slate-700 tracking-widest mb-1 leading-none">Activity</span>
                      <span className="text-sm font-black text-emerald-500 dark:text-emerald-500 uppercase italic text-[11px]">Sync Live</span>
                   </div>
                </div>
              </motion.div>
            ))
          )}
          {filteredStudents.length > 30 && (
             <div className="col-span-full py-10 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-600 font-medium italic tracking-tight">Displaying primary 30 results. Refine your search for specific peer identification.</p>
             </div>
          )}
        </div>
      </section>
    </div>
  );
}
