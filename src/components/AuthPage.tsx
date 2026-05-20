import React, { useState, useRef, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, BookOpen, ArrowRight, Brain, Target, Compass, Code, User, ChevronDown, Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';
import BannedScreen from './BannedScreen';
import { Navigate } from 'react-router-dom';

import modernClassroom from '../assets/images/modern_classroom_ai_1779239893101.png';
import focusedStudent from '../assets/images/focused_student_tablet_1779239914064.png';
import neuralLearning from '../assets/images/neural_learning_concept_1779239929443.png';

const SLIDE_IMAGES = [
  {
    url: modernClassroom,
    title: 'Modern Learning',
    description: 'AI-integrated classrooms designed for maximum cognitive growth.'
  },
  {
    url: focusedStudent,
    title: 'Personalized Growth',
    description: 'Data-driven analytics to track every step of your academic journey.'
  },
  {
    url: neuralLearning,
    title: 'Neural Precision',
    description: 'Advanced algorithms to sharpen your professional competitive edge.'
  }
];

function PhotoCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDE_IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-900 rounded-3xl">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img
            src={SLIDE_IMAGES[current].url}
            alt={SLIDE_IMAGES[current].title}
            className="h-full w-full object-cover opacity-60 mix-blend-overlay"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-12 left-12 right-12 z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8 }}
          >
            <h3 className="text-3xl font-black text-white tracking-tighter mb-2 italic">
              {SLIDE_IMAGES[current].title}
            </h3>
            <p className="text-slate-300 font-medium text-lg leading-relaxed max-w-md">
              {SLIDE_IMAGES[current].description}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex gap-2">
          {SLIDE_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={cn(
                "h-1.5 transition-all duration-500 rounded-full",
                i === current ? "w-8 bg-indigo-500" : "w-2 bg-slate-700"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  const { signInAs, profile, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'home' | 'about'>('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const aboutRef = useRef<HTMLDivElement>(null);
  const homeRef = useRef<HTMLDivElement>(null);

  const scrollToAbout = () => {
    setActiveSection('about');
    setIsMenuOpen(false);
    aboutRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToHome = () => {
    setActiveSection('home');
    setIsMenuOpen(false);
    homeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (authLoading) return null;

  if (profile) {
    if (profile.isBanned) return <BannedScreen />;
    return <Navigate to={profile.role === 'teacher' ? '/teacher' : '/student'} />;
  }

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        console.log("Sign-in popup closed by user.");
        return;
      }
      console.error("Detailed Sign-in error:", error);
      
      let message = "Failed to sign in with Google";
      if (error.code === 'auth/unauthorized-domain') {
        message = `Unauthorized Domain: ${window.location.hostname}. Please add this domain to your Firebase Console > Authentication > Settings > Authorized domains.`;
      } else if (error.message) {
        message += `: ${error.message}`;
      }
      
      alert(message);
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
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors uppercase-none overflow-x-hidden">
      {/* Navigation Header */}
      {!profile && !auth.currentUser && (
        <nav className="fixed top-0 left-0 right-0 z-[60] bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <button onClick={scrollToHome} className="flex items-center gap-2 group relative z-[70]">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 transform rotate-3 group-hover:rotate-0 transition-transform">
                <Brain className="h-4 w-4" />
              </div>
              <span className="font-black tracking-tighter text-slate-800 dark:text-slate-100">BrainReps</span>
            </button>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <button 
                onClick={handleGoogleSignIn}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all hover:scale-105"
              >
                Get Started
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden relative z-[100] p-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-colors"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Mobile Navigation Overlay */}
            <AnimatePresence>
              {isMenuOpen && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsMenuOpen(false)}
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[80] md:hidden"
                  />
                  <motion.div 
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-white dark:bg-slate-950 z-[90] md:hidden border-l border-slate-100 dark:border-slate-800 p-8 pt-24 shadow-2xl overflow-y-auto"
                  >
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={handleGoogleSignIn}
                        className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] text-sm font-black uppercase tracking-widest shadow-2xl shadow-indigo-600/30 active:scale-95 transition-transform flex items-center justify-center gap-3"
                      >
                        <Brain className="w-5 h-5" />
                        Get Started
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </nav>
      )}

      {/* Main Hero Section */}
      <div ref={homeRef} className="max-w-7xl mx-auto px-6 pt-24 md:pt-32 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[70vh]">
          {/* Left Side: Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center lg:items-start text-center lg:text-left"
          >
            <div className="mb-8 ">
              <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-600/40 transform -rotate-6 transition-transform hover:scale-105 active:scale-95">
                <Brain className="h-10 w-10" />
              </div>
            </div>
            
            <h1 className="mb-4 text-6xl font-black tracking-tighter text-slate-900 dark:text-slate-50 md:text-8xl transition-colors">
              Brain<span className="text-indigo-600 dark:text-indigo-400">Reps</span>
            </h1>
            
            <p className="mb-8 text-xl font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] transition-colors">
              Stronger Mind, Better Grades.
            </p>
            
            <p className="mb-10 text-lg text-slate-400 dark:text-slate-500 max-w-lg font-medium leading-relaxed italic transition-colors">
              The ultimate regimen for academic excellence. Repetition, assessment, 
              and data-driven growth to sharpen your competitive edge.
            </p>
            
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="inline-flex items-center gap-3 rounded-xl bg-indigo-600 px-10 py-5 font-bold text-white shadow-2xl shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0"
            >
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" 
                className="h-6 w-6 brightness-0 invert" 
                alt="Google" 
                referrerPolicy="no-referrer"
              />
              Start Your Neural Regimen
            </button>

            {/* Institutional Trust Links */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Data Privacy</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">Encrypted data and secure silos ensure cognitive progress remains protected.</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Academic Integrity</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">Built for educators who value authentic, legitimate data-driven growth.</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Institutional Tool</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">Dedicated assessment ecosystem serving verified schools and faculties.</p>
              </div>
            </div>
          </motion.div>

          {/* Right Side: Sliding Carousel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="hidden lg:block h-[600px] w-full"
          >
            <PhotoCarousel />
          </motion.div>
        </div>
        
        {/* Mobile View Carousel - Show below hero */}
        <div className="lg:hidden mt-12 h-[400px] w-full">
           <PhotoCarousel />
        </div>

        <footer className="mt-32 pb-8 space-y-6">
           <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-8 gap-y-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <button className="hover:text-indigo-600 transition-colors">Privacy Policy</button>
              <button className="hover:text-indigo-600 transition-colors">Terms of Service</button>
              <button className="hover:text-indigo-600 transition-colors">Support Center</button>
              <a href="mailto:support@brainreps.edu" className="hover:text-indigo-600 transition-colors">Contact Faculty</a>
           </div>
           <div className="flex items-center justify-center lg:justify-start gap-2 text-[9px] text-slate-300 dark:text-slate-700 italic font-medium">
              <span>© {new Date().getFullYear()} BrainReps Institutional Analytics. All rights reserved.</span>
           </div>
        </footer>
      </div>
    </div>
  );
}

