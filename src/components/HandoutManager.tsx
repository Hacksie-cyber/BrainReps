import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { motion } from 'motion/react';
import { BookOpen, Plus, Trash2, Search, FileText, Send, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface Handout {
  id: string;
  title: string;
  content: string;
  teacherId: string;
  teacherName: string;
  createdAt: string;
}

export default function HandoutManager() {
  const { profile } = useAuth();
  const [handouts, setHandouts] = useState<Handout[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!profile) return;
    fetchHandouts();
  }, [profile]);

  const fetchHandouts = async () => {
    try {
      const q = query(
        collection(db, 'handouts'),
        where('teacherId', '==', profile?.uid)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Handout));
      // Sort manually to avoid composite index requirement
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHandouts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !title || !content) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'handouts'), {
        title,
        content,
        teacherId: profile.uid,
        teacherName: profile.name,
        createdAt: new Date().toISOString()
      });
      setTitle('');
      setContent('');
      fetchHandouts();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'handouts');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteHandout = async (id: string) => {
    if (!window.confirm('Delete this material?')) return;
    try {
      await deleteDoc(doc(db, 'handouts', id));
      setHandouts(h => h.filter(x => x.id !== id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'handouts');
    }
  };

  const filteredHandouts = handouts.filter(h => 
    h.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display tracking-tight">Handouts & Materials</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight italic">
          Upload subject matter for the BrainReps Neural Assistant to synthesize.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-8">
        {/* Upload Form */}
        <div className="col-span-12 lg:col-span-5">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-500" />
              Ingest New Material
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Title / Subject</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Quantum Mechanics Overview"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Content (Text/Markdown)</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste handout content here..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium h-64 resize-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-indigo-600/20"
              >
                {isSubmitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Synchronize Material
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* List of Handouts */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-2 border border-slate-100/50 dark:border-slate-700 shadow-inner">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search repository..."
                className="bg-transparent border-none focus:ring-0 text-sm w-full py-2 font-medium"
              />
            </div>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
            {loading ? (
              <div className="p-12 text-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto" /></div>
            ) : filteredHandouts.length === 0 ? (
              <div className="text-center p-12 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-slate-200" />
                <p className="text-sm font-bold text-slate-400 italic">No materials discovered in repository.</p>
              </div>
            ) : filteredHandouts.map((h) => (
              <motion.div
                layout
                key={h.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 flex items-start justify-between group shadow-sm hover:shadow-md transition-all hover:border-indigo-100 dark:hover:border-indigo-900/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                      <Sparkles className="h-4 w-4 text-indigo-500" />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-50 group-hover:text-indigo-600 transition-colors uppercase italic">{h.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">{h.content}</p>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>{new Date(h.createdAt).toLocaleDateString()}</span>
                    <span>{h.content.length} Characters</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteHandout(h.id)}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors active:scale-90"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
