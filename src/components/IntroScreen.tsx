import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Zap, Shield, Target, Sparkles, Loader2 } from 'lucide-react';

interface IntroScreenProps {
  onComplete: () => void;
  userRole: 'teacher' | 'student' | 'admin';
  userName: string;
}

export default function IntroScreen({ onComplete, userRole, userName }: IntroScreenProps) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  // Audio utility
  const playSound = (url: string, volume = 0.4) => {
    try {
      const audio = new Audio(url);
      audio.volume = volume;
      audio.play().catch(() => {
        // Silently fail if autoplay policy blocks audio
        console.log('Audio playback blocked by browser policy');
      });
    } catch (e) {
      console.error('Audio error:', e);
    }
  };

  useEffect(() => {
    // Play sound based on step
    const sounds = [
      'https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3', // Start
      'https://assets.mixkit.co/sfx/preview/mixkit-modern-technology-select-3124.mp3', // Step 1
      'https://assets.mixkit.co/sfx/preview/mixkit-modern-technology-select-3124.mp3', // Step 2
      'https://assets.mixkit.co/sfx/preview/mixkit-interface-hint-notification-911.mp3' // Success
    ];
    
    playSound(sounds[step], step === 3 ? 0.5 : 0.3);

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
  }, [step, onComplete]);

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
        {/* Central Pulsing Icon */}
        <div className="flex justify-center relative">
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
