import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { UserRole } from '../types';
import { motion } from 'motion/react';
import { GraduationCap, BookOpen, ArrowRight, Brain } from 'lucide-react';
import { cn } from '../lib/utils';

export default function AuthPage() {
  const { signInAs, profile } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

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
    const isAuthorizedTeacher = auth.currentUser.email === 'bamuyahacksie@gmail.com';

    return (
      <div className="flex min-h-[80vh] items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-slate-200"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">Identify your role</h2>
            <p className="text-sm text-slate-500 font-medium">Configure your profile as a student or educator.</p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                disabled={!isAuthorizedTeacher}
                onClick={() => setRole('teacher')}
                className={cn(
                  "flex flex-col items-center justify-center gap-4 rounded-xl border p-6 transition-all relative group",
                  role === 'teacher' 
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-600/20" 
                    : "border-slate-100 bg-slate-50/50 text-slate-400 hover:border-slate-200 hover:bg-slate-50",
                  !isAuthorizedTeacher && "opacity-50 grayscale cursor-not-allowed border-dashed"
                )}
              >
                <BookOpen className="h-8 w-8" />
                <span className="font-bold text-[10px] uppercase tracking-widest">Teacher</span>
                {!isAuthorizedTeacher && (
                  <span className="absolute -top-2 -right-2 bg-slate-100 text-slate-400 text-[8px] font-black px-1.5 py-0.5 rounded border border-slate-200">RESTRICTED</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setRole('student')}
                className={cn(
                  "flex flex-col items-center justify-center gap-4 rounded-xl border p-6 transition-all",
                  role === 'student' 
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-600/20" 
                    : "border-slate-100 bg-slate-50/50 text-slate-400 hover:border-slate-200 hover:bg-slate-50"
                )}
              >
                <GraduationCap className="h-8 w-8" />
                <span className="font-bold text-[10px] uppercase tracking-widest">Student</span>
              </button>
            </div>

            {!isAuthorizedTeacher && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 leading-relaxed italic text-center">
                  Teacher access is limited to pre-authorized administrative accounts. 
                  Please select 'Student' to proceed.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Full Name</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Sarah Jenkins"
                className="w-full rounded-lg border border-slate-200 px-4 py-3 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all placeholder:text-slate-300"
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
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-600/40 transform -rotate-6">
            <Brain className="h-10 w-10" />
          </div>
        </div>
        <h1 className="mb-4 text-5xl font-black tracking-tighter text-slate-900 md:text-8xl">
          Brain<span className="text-indigo-600">Reps</span>
        </h1>
        <p className="mb-10 text-xl font-bold text-slate-500 uppercase tracking-[0.2em]">
          Stronger Mind, Better Grades.
        </p>
        <p className="mb-12 text-lg text-slate-400 max-w-lg mx-auto font-medium leading-relaxed italic">
          The ultimate regimen for academic excellence. Repetition, assessment, 
          and data-driven growth to sharpen your competitive edge.
        </p>
        
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="inline-flex items-center gap-3 rounded-xl bg-white px-10 py-5 font-bold text-slate-700 shadow-xl shadow-slate-200 border border-slate-200 transition-all hover:bg-slate-50 hover:-translate-y-1 active:translate-y-0"
        >
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" 
            className="h-6 w-6" 
            alt="Google" 
            referrerPolicy="no-referrer"
          />
          Sign in to get started
        </button>

        <div className="mt-16 flex items-center justify-center gap-8 grayscale opacity-50">
          <div className="flex items-center gap-2"><div className="w-6 h-6 bg-slate-300 rounded" /> <span className="text-sm font-bold tracking-tighter">MCQ Ready</span></div>
          <div className="flex items-center gap-2"><div className="w-6 h-6 bg-slate-300 rounded" /> <span className="text-sm font-bold tracking-tighter">Instant Analysis</span></div>
          <div className="flex items-center gap-2"><div className="w-6 h-6 bg-slate-300 rounded" /> <span className="text-sm font-bold tracking-tighter">Safe & Secure</span></div>
        </div>
      </motion.div>
    </div>
  );
}
