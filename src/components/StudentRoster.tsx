import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { GraduationCap, Mail, Search, User, Award, BookOpen } from 'lucide-react';
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Peer Roster</h1>
        <p className="text-sm text-slate-500 font-medium tracking-tight">Meet your fellow learners and academic peers.</p>
      </header>

      <section className="space-y-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by peer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-600 placeholder:text-slate-300 italic"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-300 italic font-medium">
              <User className="h-12 w-12 mx-auto mb-4 opacity-10" />
              No peer profiles detected in the database.
            </div>
          ) : (
            filteredStudents.map((student, i) => (
              <motion.div
                key={student.uid}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center group hover:border-indigo-200 hover:shadow-xl transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/10 group-hover:bg-indigo-500 transition-colors" />
                
                <div className="mb-4 relative">
                  <div className="w-20 h-20 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:rotate-3 transition-all duration-500 border border-slate-100">
                    <User className="h-10 w-10" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-lg shadow-md flex items-center justify-center border border-slate-100">
                    <GraduationCap className="h-3 w-3 text-indigo-500" />
                  </div>
                </div>

                <h3 className="font-bold text-slate-800 tracking-tight mb-1 group-hover:text-indigo-600 transition-colors">{student.name}</h3>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Learner Profile</p>
                
                <div className="w-full flex items-center justify-center gap-4 pt-4 border-t border-slate-50">
                   <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black uppercase text-slate-300 tracking-tighter mb-0.5">Joined</span>
                      <span className="text-xs font-bold text-slate-500">{new Date(student.createdAt).getFullYear()}</span>
                   </div>
                   <div className="w-px h-6 bg-slate-100" />
                   <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black uppercase text-slate-300 tracking-tighter mb-0.5">Status</span>
                      <span className="text-xs font-bold text-emerald-500">Active</span>
                   </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
