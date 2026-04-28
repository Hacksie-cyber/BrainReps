import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Zap, Shield, Target, Sparkles, Loader2 } from 'lucide-react';

interface IntroScreenProps {
  onComplete: () => void;
  userRole: 'teacher' | 'student' | 'admin';
  userName: string;
}

export default function IntroScreen({ onComplete, userRole, userName }: IntroScreenProps) {
  const [isInitiated, setIsInitiated] = useState(false);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const audioRefs = React.useRef<Record<number, HTMLAudioElement>>({});

  useEffect(() => {
    // Preload sounds
    const sounds = [
      'https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3',
      'https://assets.mixkit.co/sfx/preview/mixkit-modern-technology-select-3124.mp3',
      'https://assets.mixkit.co/sfx/preview/mixkit-modern-technology-select-3124.mp3',
      'https://assets.mixkit.co/sfx/preview/mixkit-interface-hint-notification-911.mp3'
    ];

    sounds.forEach((url, index) => {
      const audio = new Audio(url);
      audio.load();
      audioRefs.current[index] = audio;
    });
  }, []);

  useEffect(() => {
    if (!isInitiated) return;

    // Play sound based on step
    const currentAudio = audioRefs.current[step];
    if (currentAudio) {
      currentAudio.volume = step === 3 ? 0.5 : 0.3;
      currentAudio.currentTime = 0;
      currentAudio.play().catch(e => console.log('Playback blocked or failed:', e));
    }

    const timer = setTimeout(() => {
      if (step < 3) {
        setStep(s => s + 1);
      } else {
        onComplete();
      }
    }, 2000);

    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 1, 100));
    }, 75);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [step, onComplete, isInitiated]);

  const messages = [
    "Initializing Cognitive Environment...",
    `Authenticating ${userRole === 'teacher' ? 'Educator' : 'Student'} Profile...`,
    "Synchronizing Neural Patterns...",
    "System Ready. Welcome back."
  ];

  const icons = [
    <Shield className="w-12 h-12" />,
    <Target className="w-12 h-12" />,
    <Zap className="w-12 h-12" />,
    <Sparkles className="w-12 h-12" />
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-6"
    >
      {/* Background Grid Accent */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{ 
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(99, 102, 241, 0.15) 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }} />
      </div>

      <div className="relative w-full max-w-sm space-y-12">
        {!isInitiated ? (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-8 py-12"
          >
            <div className="w-24 h-24 bg-indigo-600/20 rounded-full flex items-center justify-center border border-indigo-500/30">
              <Shield className="w-10 h-10 text-indigo-400 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-xl font-black text-white tracking-tight uppercase">User Identity Confirmed</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Synchronize neural interface to proceed</p>
            </div>
            <button 
              onClick={() => setIsInitiated(true)}
              className="px-10 py-5 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs border border-indigo-500/50 shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-all hover:scale-105 active:scale-95"
            >
              Initiate Load Sequence
            </button>
          </motion.div>
        ) : (
          <>
            {/* Central Pulsing Icon */}
            <div className="flex justify-center relative">
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Glowing Aura Layers */}
                <motion.div 
                  animate={{ 
                    scale: [1, 1.4, 1],
                    opacity: [0.1, 0.3, 0.1]
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute w-40 h-40 bg-indigo-500 rounded-full blur-3xl"
                />
                <motion.div 
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.2, 0.4, 0.2]
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  className="absolute w-32 h-32 bg-indigo-400 rounded-full blur-2xl"
                />
              </div>
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-32 h-32 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-[0_0_50px_rgba(79,70,229,0.4)] relative z-10"
              >
                <Brain className="w-16 h-16" />
                
                {/* Orbits */}
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-4 border border-indigo-500/30 rounded-full border-dashed"
                />
                <motion.div 
                  animate={{ rotate: -360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-8 border border-slate-700/50 rounded-full"
                />
              </motion.div>
            </div>

            {/* Text Sequence */}
            <div className="text-center space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="space-y-2"
                >
                  <div className="flex justify-center text-indigo-400 mb-4 h-12">
                    {icons[step]}
                  </div>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    {step === 3 ? `Welcome, ${userName}` : messages[step]}
                  </h2>
                  <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em]">
                    {step === 3 ? "Access Granted" : "Neural Link Established"}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Progress System */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Load Sequence
                </span>
                <span className="text-sm font-black text-indigo-400 font-mono">{progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  className="h-full bg-gradient-to-r from-indigo-600 via-indigo-400 to-emerald-400 shadow-[0_0_15px_rgba(79,70,229,0.5)]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>
          </>
        )}

        {/* Footer Technical Detail */}
        <div className="pt-8 flex justify-center gap-12">
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Protocol</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">BR-2024-SYS</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Latency</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">12ms Optimized</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Security</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">L6 Encrypted</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
