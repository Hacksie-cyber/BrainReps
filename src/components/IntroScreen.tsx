import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Zap, Shield, Target, Sparkles, Loader2, Fingerprint } from 'lucide-react';
import { cn } from '../lib/utils';

interface IntroScreenProps {
  onComplete: () => void;
  userRole: 'teacher' | 'student' | 'admin';
  userName: string;
}

export default function IntroScreen({ onComplete, userRole, userName }: IntroScreenProps) {
  const [isInitiated, setIsInitiated] = useState(false);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [hasAnnouncedScan, setHasAnnouncedScan] = useState(false);
  const audioRefs = React.useRef<Record<string, HTMLAudioElement>>({});
  const scanLoopRef = React.useRef<HTMLAudioElement | null>(null);
  const holdTimerRef = React.useRef<number | null>(null);

  // Helper for voice narration
  const announce = (text: string, rate = 1.05, pitch = 1.0) => {
    if (!('speechSynthesis' in window)) return;
    
    // Cancel any ongoing speech to prevent overlap
    window.speechSynthesis.cancel();
    
    const announcement = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    const preferredVoice = voices.find(v => v.name.includes('Samantha')) || 
                          voices.find(v => v.name.includes('Google UK English Female')) ||
                          voices.find(v => (v.name.includes('Natural') || v.name.includes('Premium')) && v.lang.startsWith('en')) ||
                          voices.find(v => v.lang.startsWith('en'));

    if (preferredVoice) announcement.voice = preferredVoice;
    announcement.rate = rate;
    announcement.pitch = pitch;
    announcement.volume = 0.8;
    window.speechSynthesis.speak(announcement);
  };

  // Handle biometric hold logic
  useEffect(() => {
    if (isHolding && !isInitiated) {
      if (!hasAnnouncedScan) {
        announce("Biometric scanning initiated. Please maintain contact for interface synchronization.");
        setHasAnnouncedScan(true);
      }

      // Start scanning SFX loop
      if (scanLoopRef.current) {
        scanLoopRef.current.loop = true;
        scanLoopRef.current.volume = 0.2;
        scanLoopRef.current.play().catch(() => {});
      }

      const startTime = Date.now();
      const duration = 3000; // 3 seconds

      const updateHold = () => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min((elapsed / duration) * 100, 100);
        setHoldProgress(newProgress);

        if (newProgress < 100) {
          holdTimerRef.current = requestAnimationFrame(updateHold);
        } else {
          // Success!
          if (scanLoopRef.current) scanLoopRef.current.pause();
          const chime = audioRefs.current['success'];
          if (chime) {
            chime.volume = 0.5;
            chime.play().catch(() => {});
          }
          announce("Authentication successful. Security protocols bypassed. Initializing neural link.");
          setIsInitiated(true);
          setIsHolding(false);
        }
      };

      holdTimerRef.current = requestAnimationFrame(updateHold);
    } else {
      if (holdTimerRef.current) cancelAnimationFrame(holdTimerRef.current);
      if (scanLoopRef.current) {
        scanLoopRef.current.pause();
        scanLoopRef.current.currentTime = 0;
      }
      
      // Fast reset when let go
      const reset = () => {
        setHoldProgress(prev => {
          if (prev <= 0) return 0;
          return prev - 5;
        });
        if (holdProgress > 0) requestAnimationFrame(reset);
      };
      if (!isInitiated) reset();
    }

    return () => {
      if (holdTimerRef.current) cancelAnimationFrame(holdTimerRef.current);
    };
  }, [isHolding, isInitiated, hasAnnouncedScan]);

  useEffect(() => {
    // Preload sounds
    const sfxBase = {
      0: 'https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3',
      1: 'https://assets.mixkit.co/sfx/preview/mixkit-modern-technology-select-3124.mp3',
      2: 'https://assets.mixkit.co/sfx/preview/mixkit-modern-technology-select-3124.mp3',
      3: 'https://assets.mixkit.co/sfx/preview/mixkit-interface-hint-notification-911.mp3',
      success: 'https://assets.mixkit.co/sfx/preview/mixkit-electronic-future-interface-notification-952.mp3',
      scan: 'https://assets.mixkit.co/sfx/preview/mixkit-data-processing-screen-2101.mp3'
    };

    Object.entries(sfxBase).forEach(([key, url]) => {
      const audio = new Audio(url);
      audio.load();
      audioRefs.current[key] = audio;
      if (key === 'scan') scanLoopRef.current = audio;
    });
  }, []);

  useEffect(() => {
    if (!isInitiated) return;

    // Play SFX based on step
    const currentAudio = audioRefs.current[step];
    if (currentAudio) {
      currentAudio.volume = step === 3 ? 0.4 : 0.2;
      currentAudio.currentTime = 0;
      currentAudio.play().catch(e => console.log('Playback blocked or failed:', e));
    }

    const stepAnnouncements = [
      "Initializing core systems and cognitive environment.",
      `Accessing repository. Authenticating secure ${userRole} profile and verifying network credentials.`,
      "Mapping neural pathways and synchronizing interface patterns for optimal performance.",
      `Welcome back to BrainReps Academy, ${userName}. Your personalized sanctuary for cognitive excellence is fully synchronized.`
    ];

    // Delayed start for step narration to give previous announcements time to breathe
    const narrationTimer = setTimeout(() => {
      announce(stepAnnouncements[step], 1.1, 1.0);
    }, 800);

    const durations = [3200, 4800, 4800, 11000];
    const timer = setTimeout(() => {
      if (step < 3) {
        setStep(s => s + 1);
      } else {
        onComplete();
      }
    }, durations[step]);

    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 0.2, 100));
    }, 20);

    return () => {
      clearTimeout(timer);
      clearTimeout(narrationTimer);
      clearInterval(progressInterval);
    };
  }, [step, onComplete, isInitiated, userRole, userName]);

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
            <div className="flex flex-col items-center gap-6">
              <motion.div 
                className="relative w-36 h-36 flex items-center justify-center"
              >
                {/* Circular Progress SVG */}
                <svg className="absolute inset-0 w-full h-full -rotate-90 transform">
                  <circle
                    cx="72"
                    cy="72"
                    r="68"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-indigo-500/10"
                  />
                  <motion.circle
                    cx="72"
                    cy="72"
                    r="68"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={427}
                    animate={{ strokeDashoffset: 427 - (427 * holdProgress) / 100 }}
                    transition={{ duration: 0.1 }}
                    className={cn(
                      "transition-all duration-100",
                      holdProgress > 0 ? "text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]" : "text-transparent"
                    )}
                  />
                </svg>

                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onPointerDown={() => setIsHolding(true)}
                  onPointerUp={() => setIsHolding(false)}
                  onPointerLeave={() => setIsHolding(false)}
                  className="group relative w-28 h-28 flex items-center justify-center rounded-full z-10"
                >
                  {/* Scanner Outer Rings */}
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border border-indigo-500/20 rounded-full border-dashed"
                  />
                  
                  {/* Fingerprint Main Button */}
                  <div className={cn(
                    "absolute inset-2 rounded-full flex items-center justify-center border transition-all duration-300 overflow-hidden",
                    isHolding 
                      ? "bg-indigo-600/30 border-indigo-400 shadow-[0_0_40px_rgba(79,70,229,0.5)]" 
                      : "bg-indigo-950/50 border-indigo-500/30 shadow-[0_0_20px_rgba(79,70,229,0.2)]"
                  )}>
                    <Fingerprint className={cn(
                      "w-12 h-12 transition-all duration-500",
                      isHolding ? "text-white scale-110" : "text-indigo-400"
                    )} />
                    
                    {/* Scanning Laser Line Effect - faster when holding */}
                    <motion.div 
                      animate={{ 
                        top: ["-10%", "110%", "-10%"]
                      }}
                      transition={{ 
                        duration: isHolding ? 1.5 : 3, 
                        repeat: Infinity, 
                        ease: "linear" 
                      }}
                      className={cn(
                        "absolute left-0 right-0 h-1 bg-indigo-400 shadow-[0_0_15px_rgba(129,140,248,1)] opacity-70",
                        !isHolding && "opacity-30"
                      )}
                    />
                  </div>

                  {/* Pulsing Aura when holding */}
                  <AnimatePresence>
                    {isHolding && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1.2 }}
                        exit={{ opacity: 0, scale: 1.5 }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl"
                      />
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.div>
              
              <motion.div 
                animate={{ opacity: isHolding ? 1 : 0.6 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="h-6 flex items-center">
                  <AnimatePresence mode="wait">
                    {isHolding ? (
                      <motion.p 
                        key="scanning"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-[10px] font-black uppercase text-white tracking-[0.2em] font-mono"
                      >
                        Analyzing Biometrics... {Math.round(holdProgress)}%
                      </motion.p>
                    ) : (
                      <motion.p 
                        key="ready"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em] font-mono"
                      >
                        Hold to scan biometric data
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Neural Link Authorization Required</p>
              </motion.div>
            </div>
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
