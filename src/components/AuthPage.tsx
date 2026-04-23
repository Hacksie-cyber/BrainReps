import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { UserRole } from '../types';
import { motion } from 'motion/react';
import { GraduationCap, BookOpen, ArrowRight, Brain } from 'lucide-react';
import { cn } from '../lib/utils';
import BannedScreen from './BannedScreen';

import { Navigate } from 'react-router-dom';

export default function AuthPage() {
  const { signInAs, profile, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (authLoading) return null;

  if (profile) {
    if (profile.isBanned) return <BannedScreen />;
    return <Navigate to={profile.role === 'teacher' ? '/teacher' : '/student'} />;
  }

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      // Don't show alert if user just closed the popup
      if (error.code === 'auth/popup-closed-by-user') {
        console.log("Sign-in popup closed by user.");
        return;
      }
      console.error(error);
      alert("Failed to sign in with Google");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role || !name) return;
    try {
      setLoading(true);
      await signInAs(role, name);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to configure profile");
    } finally {
      setLoading(false);
    }
  };

  if (auth.currentUser && !profile) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-xl border border-slate-200 dark:border-slate-800 transition-colors"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Identify your role</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Configure your profile as a student or educator.</p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={cn(
                  "flex flex-col items-center justify-center gap-4 rounded-xl border p-6 transition-all relative group",
                  role === 'teacher' 
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-600/20" 
                    : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                )}
              >
                <BookOpen className="h-8 w-8" />
                <span className="font-bold text-[10px] uppercase tracking-widest">Teacher</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('student')}
                className={cn(
                  "flex flex-col items-center justify-center gap-4 rounded-xl border p-6 transition-all",
                  role === 'student' 
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-600/20" 
                    : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                )}
              >
                <GraduationCap className="h-8 w-8" />
                <span className="font-bold text-[10px] uppercase tracking-widest">Student</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Full Name</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Sarah Jenkins"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-slate-800 dark:text-slate-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
              />
            </div>

            <button
              disabled={loading || !role || !name}
              type="submit"
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-4 font-bold text-white transition-all hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
            >
              Configure Profile
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl"
      >
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-600/40 transform -rotate-6 transition-transform hover:scale-105 active:scale-95">
            <Brain className="h-10 w-10" />
          </div>
        </div>
        <h1 className="mb-4 text-5xl font-black tracking-tighter text-slate-900 dark:text-slate-50 md:text-8xl transition-colors">
          Brain<span className="text-indigo-600 dark:text-indigo-400">Reps</span>
        </h1>
        <p className="mb-10 text-xl font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] transition-colors">
          Stronger Mind, Better Grades.
        </p>
        <p className="mb-12 text-lg text-slate-400 dark:text-slate-500 max-w-lg mx-auto font-medium leading-relaxed italic transition-colors">
          The ultimate regimen for academic excellence. Repetition, assessment, 
          and data-driven growth to sharpen your competitive edge.
        </p>
        
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="inline-flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 px-10 py-5 font-bold text-slate-700 dark:text-slate-300 shadow-xl shadow-slate-200 dark:shadow-black/20 border border-slate-200 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-800 hover:-translate-y-1 active:translate-y-0"
        >
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" 
            className="h-6 w-6" 
            alt="Google" 
            referrerPolicy="no-referrer"
          />
          Sign in to get started
        </button>

        {/* Institutional Trust Section */}
        <div className="mt-20 grid gap-8 md:grid-cols-3 max-w-4xl mx-auto border-t border-slate-100 dark:border-slate-800 pt-16 text-left">
           <div className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                 <div className="w-1.5 h-1.5 rounded-full bg-current" />
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Data Privacy</h4>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">Encrypted student data and secure institutional silos ensure that your cognitive progress remains private and protected at all times.</p>
           </div>
           <div className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                 <div className="w-1.5 h-1.5 rounded-full bg-current" />
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Academic Integrity</h4>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">Built for educators who value authentic learning. Our platform discourages deceptive practices and focuses on legitimate data-driven growth.</p>
           </div>
           <div className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                 <div className="w-1.5 h-1.5 rounded-full bg-current" />
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Institutional Tool</h4>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">BrainReps is a dedicated assessment ecosystem serving verified schools and faculties. We do not host malicious software or deceptive content.</p>
           </div>
        </div>

        {/* Footer with compliance signals */}
        <footer className="mt-24 pb-8 space-y-6">
           <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <button className="hover:text-indigo-600 transition-colors">Privacy Policy</button>
              <button className="hover:text-indigo-600 transition-colors">Terms of Service</button>
              <button className="hover:text-indigo-600 transition-colors">Support Center</button>
              <a href="mailto:support@brainreps.edu" className="hover:text-indigo-600 transition-colors">Contact Faculty</a>
           </div>
           <div className="flex items-center justify-center gap-2 text-[9px] text-slate-300 dark:text-slate-700 italic font-medium">
              <span>© {new Date().getFullYear()} BrainReps Institutional Analytics. All rights reserved.</span>
           </div>
        </footer>
      </motion.div>
    </div>
  );
}
