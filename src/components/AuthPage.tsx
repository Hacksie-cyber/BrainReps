import React, { useState, useRef } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, BookOpen, ArrowRight, Brain, Target, Compass, Code, User, ChevronDown, Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';
import BannedScreen from './BannedScreen';
import { Navigate } from 'react-router-dom';

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
      await signInWithPopup(auth, provider);
    } catch (error: any) {
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
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors uppercase-none">
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
                onClick={scrollToHome}
                className={cn("text-xs font-black uppercase tracking-widest transition-colors", activeSection === 'home' ? "text-indigo-600" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")}
              >
                Home
              </button>
              <button 
                onClick={scrollToAbout}
                className={cn("text-xs font-black uppercase tracking-widest transition-colors", activeSection === 'about' ? "text-indigo-600" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")}
              >
                About Us
              </button>
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
                        onClick={scrollToHome}
                        className={cn(
                          "group flex items-center justify-between p-4 rounded-2xl transition-all",
                          activeSection === 'home' ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
                        )}
                      >
                        <span className="text-xl font-black uppercase tracking-widest">Home</span>
                        <ArrowRight className={cn("w-5 h-5 transition-transform", activeSection === 'home' ? "translate-x-0" : "-translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100")} />
                      </button>
                      <button 
                        onClick={scrollToAbout}
                        className={cn(
                          "group flex items-center justify-between p-4 rounded-2xl transition-all",
                          activeSection === 'about' ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
                        )}
                      >
                        <span className="text-xl font-black uppercase tracking-widest">About Us</span>
                        <ArrowRight className={cn("w-5 h-5 transition-transform", activeSection === 'about' ? "translate-x-0" : "-translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100")} />
                      </button>
                      
                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-8" />
                      
                      <button 
                        onClick={handleGoogleSignIn}
                        className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] text-sm font-black uppercase tracking-widest shadow-2xl shadow-indigo-600/30 active:scale-95 transition-transform flex items-center justify-center gap-3"
                      >
                        <Brain className="w-5 h-5" />
                        Get Started
                      </button>
                      
                      <AnimatePresence>
                        {activeSection === 'about' && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="mt-12 space-y-4"
                          >
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-4">Contact Developer</p>
                            <a 
                              href="mailto:donnicolebamuya@gmail.com"
                              className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                            >
                              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-indigo-600 shadow-sm">
                                <Code className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-xs font-black text-slate-900 dark:text-slate-100">Don Nicole Bamuya</p>
                                <p className="text-[10px] font-bold text-slate-400">donnicolebamuya@gmail.com</p>
                              </div>
                            </a>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </nav>
      )}

      {/* Hero Section */}
      <div ref={homeRef} className="flex min-h-screen flex-col items-center justify-center text-center p-4 pt-24 md:pt-32">
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
             
             <div className="flex justify-center pt-8">
                <div onClick={scrollToAbout} className="animate-bounce cursor-pointer p-2 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-600">
                   <ChevronDown className="w-5 h-5" />
                </div>
             </div>
          </footer>
        </motion.div>
      </div>

      {/* About Section */}
      <section ref={aboutRef} className="w-full max-w-7xl mx-auto py-24 md:py-32 px-6 space-y-24 scroll-mt-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-1000">
            <div className="w-16 h-1.5 bg-indigo-600 rounded-full" />
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-slate-50 tracking-tighter leading-[0.9]">
              The Next <span className="text-indigo-600">Frontier</span> of Academic Training.
            </h2>
            <p className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 font-medium leading-relaxed italic">
              "BrainReps translates athletic methodology into academic mastery. We don't just teach—we train."
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/20 flex items-center justify-center text-white mb-6">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-3">Our Mission</h3>
              <p className="text-base text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                To democratize elite learning strategies by providing educators with high-precision assessment tools and students with a data-driven path to academic dominance.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/20 flex items-center justify-center text-white mb-6">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-3">Our Vision</h3>
              <p className="text-base text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                To become the global standard for institutional analytics, where every student's cognitive growth is as measurable as an athlete's performance.
              </p>
            </div>
          </div>
        </div>

        {/* Developer Section */}
        <AnimatePresence>
          {activeSection === 'about' && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative overflow-hidden bg-slate-900 rounded-[3rem] p-8 md:p-16 lg:p-20 text-white"
            >
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative flex flex-col lg:flex-row gap-16 lg:items-center">
                {/* Visual Column */}
                <div className="flex flex-col items-center lg:items-start shrink-0">
                  <div className="relative mb-10">
                    <div className="w-40 h-40 md:w-56 md:h-56 rounded-[2.5rem] bg-gradient-to-br from-indigo-500 to-violet-600 p-[2px] relative overflow-hidden ring-8 ring-white/5 transition-transform hover:scale-105 duration-500">
                      <div className="w-full h-full rounded-[2.5rem] bg-slate-900 flex items-center justify-center text-5xl md:text-7xl font-black italic">
                        <span className="relative z-10">D</span>
                      </div>
                    </div>
                    <div className="absolute -bottom-3 -right-3 bg-indigo-600 p-3.5 rounded-2xl shadow-2xl z-20 border-4 border-slate-900">
                      <Code className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="text-center lg:text-left space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-400">Lead Architect</span>
                    <h3 className="text-2xl font-black tracking-tight">The Core Dev</h3>
                  </div>
                </div>

                {/* Content Column */}
                <div className="flex-1 space-y-10">
                  <div className="space-y-4 text-center lg:text-left">
                    <h4 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.8]">Don Nicole Bamuya</h4>
                    <p className="text-xl font-bold uppercase tracking-[0.3em] text-indigo-400">Computer Engineer</p>
                  </div>

                  <div className="relative max-w-3xl">
                    <div className="absolute -left-8 -top-6 text-8xl font-serif text-indigo-500/10 select-none">"</div>
                    <p className="text-xl md:text-3xl text-slate-300 font-medium leading-relaxed italic relative z-10 md:pr-12">
                      Precision engineering meets intuitive design. Building high-performance systems that empower the next generation of scholars.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                     <div className="px-6 py-3 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Architecture</span>
                     </div>
                     <div className="px-6 py-3 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full-Stack Engineering</span>
                     </div>
                  </div>

                  <div className="pt-10 border-t border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-8">
                     <div className="flex items-center gap-8">
                        <div>
                           <p className="text-3xl font-black">2026</p>
                           <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Established</p>
                        </div>
                        <div className="w-px h-10 bg-slate-800" />
                        <div>
                           <p className="text-3xl font-black">v2.4</p>
                           <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Engine</p>
                        </div>
                     </div>
                     <a 
                      href="mailto:donnicolebamuya@gmail.com"
                      className="w-full sm:w-auto px-10 py-5 bg-white text-slate-900 rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95 shadow-2xl shadow-indigo-500/10 text-center"
                     >
                       Contact Developer
                     </a>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="h-20" />
    </div>
  );
}
