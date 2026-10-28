import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission, UserProfile } from '../types';
import { useActiveUsers } from '../lib/usePresence';
import { 
  Fish, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Search, 
  Trophy, 
  Award, 
  ArrowLeft, 
  Clock, 
  X, 
  ChevronDown, 
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Gauge,
  Zap,
  Scale,
  Hand,
  Sun,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Utensils,
  Eraser,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  CheckSquare,
  Layers,
  FileQuestion,
  BookOpen,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Web Audio synthesizer for gentle underwater bubble sounds
function playBubbleSound(frequencyOffset = 0) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const startFreq = 400 + Math.random() * 250 + frequencyOffset;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(startFreq + 350, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  } catch {
    // Ignore audio errors
  }
}

// Web Audio glass tap sound
function playTapGlassSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Ignore audio errors
  }
}

// Web Audio Teacher Shark Chomp sound
function playChompSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // Low aggressive jaw snap
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // Ignore audio errors
  }
}

export type AquaticSpecies = 
  | 'turtle' 
  | 'bluetang' 
  | 'yellowtang' 
  | 'clownfish' 
  | 'moorishidol' 
  | 'anthias' 
  | 'goldfish' 
  | 'angelfish' 
  | 'mantaray' 
  | 'pufferfish';

export const SPECIES_METADATA: Record<AquaticSpecies, { name: string; emoji: string; description: string }> = {
  turtle: { name: 'Sea Turtle', emoji: '🐢', description: 'Graceful green sea turtle paddling across the coral reef' },
  bluetang: { name: 'Blue Tang', emoji: '🐡', description: 'Vibrant royal blue tropical fish with lemon-yellow tail' },
  yellowtang: { name: 'Yellow Tang', emoji: '💛', description: 'Bright glowing lemon yellow tang with high dorsal fin' },
  clownfish: { name: 'Clownfish', emoji: '🧡', description: 'Lively coral reef fish with iconic white vertical bands' },
  moorishidol: { name: 'Moorish Idol', emoji: '🤍', description: 'Exotic black, white, and yellow banded reef beauty with trailing crest' },
  anthias: { name: 'Magenta Anthias', emoji: '💖', description: 'Radiant magenta-violet reef swimmer with sunset hues' },
  goldfish: { name: 'Fancy Goldfish', emoji: '🐠', description: 'Graceful Oranda with billowing double fan tail' },
  angelfish: { name: 'Golden Angelfish', emoji: '🐟', description: 'Majestic diamond disc with long trailing fin filaments' },
  mantaray: { name: 'Manta Ray', emoji: '🌊', description: 'Kite-winged ocean glider with undulating wings' },
  pufferfish: { name: 'Pufferfish', emoji: '🐡', description: 'Round bubbly friend with rapid fluttering fins' }
};

const SHARK_ACADEMIC_QUOTES = [
  "Pop quiz time! 🦈",
  "Did you study for this assessment?! 📚",
  "Homework is overdue! CHOMP!",
  "Show your work on the quiz! ✏️",
  "Office hours are open! 🦈",
  "No copying in my tank! 🚫",
  "Burp! Keep studying hard! 💨",
  "Good effort... but review Chapter 3! 🦈",
  "Back to the textbooks with you! 📖",
  "Class average must go up! CHOMP!"
];

// USER'S EXPLICIT 4-TIER FISH SIZE SCALING:
// - 90% to 100%: Much bigger looking (Giant Apex Swimmer: 2.20x)
// - 70% to 89%: Medium-large fish (1.45x)
// - 50% to 69%: Small fish (1.00x)
// - Below 50%: Little fish (0.65x)
export function calculateScoreScale(percentage: number): number {
  if (percentage >= 90) return 2.20; // Much bigger looking
  if (percentage >= 70) return 1.45; // 70-80 that much (solid medium-large)
  if (percentage >= 50) return 1.00; // 70 below get small fish
  return 0.65;                       // 50 percent below little fish
}

export function getFishTierInfo(percentage: number): {
  tier: 'giant' | 'medium' | 'small' | 'little';
  label: string;
  shortLabel: string;
  scaleDescription: string;
  badgeBg: string;
  textColor: string;
} {
  if (percentage >= 90) {
    return {
      tier: 'giant',
      label: 'Much Bigger (90-100%)',
      shortLabel: 'Giant Fish (90-100%)',
      scaleDescription: '2.20x (Giant)',
      badgeBg: 'bg-amber-500 text-black',
      textColor: 'text-amber-400'
    };
  }
  if (percentage >= 70) {
    return {
      tier: 'medium',
      label: 'Medium Fish (70-89%)',
      shortLabel: 'Medium Fish (70-89%)',
      scaleDescription: '1.45x (Medium)',
      badgeBg: 'bg-emerald-500 text-black',
      textColor: 'text-emerald-400'
    };
  }
  if (percentage >= 50) {
    return {
      tier: 'small',
      label: 'Small Fish (50-69%)',
      shortLabel: 'Small Fish (50-69%)',
      scaleDescription: '1.00x (Small)',
      badgeBg: 'bg-sky-500 text-white',
      textColor: 'text-sky-400'
    };
  }
  return {
    tier: 'little',
    label: 'Little Fish (<50%)',
    shortLabel: 'Little Fish (<50%)',
    scaleDescription: '0.65x (Little)',
    badgeBg: 'bg-rose-500 text-white',
    textColor: 'text-rose-400'
  };
}

interface FishEntity {
  id: string; // studentId
  submissionId: string;
  name: string;
  email: string;
  photoURL?: string;
  score: number;
  totalPoints: number;
  percentage: number;
  submittedAt: string;
  timeTaken?: number;
  antiCheatTriggered?: boolean;
  breachCount?: number;
  
  species: AquaticSpecies;
  scale: number;
  
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetVx: number;
  targetVy: number;
  direction: 1 | -1;
  baseSpeed: number;
  wigglePhase: number;
  wiggleSpeed: number;
  eatingEffectTimer: number;

  // Shark interaction & respawn (playful chomp tag)
  isTerrified: boolean;
  isEaten: boolean;
  respawnTimer: number;
  shieldTimer: number; // brief glowing bubble shield after respawn
}

export interface QuestionFishEntity {
  id: string; // question id
  index: number; // 1-based question number (1, 2, 3...)
  questionText: string;
  titleSnippet: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  points: number;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  imageUrl?: string;

  // Real-time analytics from student submissions
  totalAnswered: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  choiceDistribution: Record<string, number>;

  // Species, scaling, and movement physics
  species: AquaticSpecies;
  scale: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetVx: number;
  targetVy: number;
  direction: 1 | -1;
  baseSpeed: number;
  wigglePhase: number;
  wiggleSpeed: number;
  eatingEffectTimer: number;
  isTerrified: boolean;
  isEaten: boolean;
  respawnTimer: number;
  shieldTimer: number;
}

const DEFAULT_SAMPLE_QUESTIONS = [
  {
    id: 'q-sample-1',
    type: 'multiple-choice' as const,
    question: 'Which organelle is considered the powerhouse of the cell responsible for generating cellular ATP?',
    options: ['Nucleus', 'Mitochondria', 'Endoplasmic Reticulum', 'Golgi Apparatus'],
    correctAnswer: 'Mitochondria',
    points: 10,
    explanation: 'Mitochondria generate the chemical energy (ATP) needed for biochemical reactions within eukaryotic cells.'
  },
  {
    id: 'q-sample-2',
    type: 'true-false' as const,
    question: 'True or False: Sound waves travel significantly faster through water than through atmospheric air.',
    options: ['True', 'False'],
    correctAnswer: 'True',
    points: 5,
    explanation: 'Water is much denser than air, allowing mechanical sound vibrations to propagate roughly 4.3 times faster.'
  },
  {
    id: 'q-sample-3',
    type: 'multiple-choice' as const,
    question: 'What primary atmospheric gas is absorbed by autotrophic marine plants and phytoplankton during photosynthesis?',
    options: ['Nitrogen Gas (N2)', 'Carbon Dioxide (CO2)', 'Ozone (O3)', 'Argon (Ar)'],
    correctAnswer: 'Carbon Dioxide (CO2)',
    points: 10,
    explanation: 'Phytoplankton and aquatic vegetation fix dissolved CO2 into organic carbon compounds while liberating oxygen.'
  },
  {
    id: 'q-sample-4',
    type: 'short-answer' as const,
    question: 'Define biodiversity and identify one primary environmental stressor threatening coral reef ecosystems.',
    options: [],
    correctAnswer: 'Variety of living organisms in an ecosystem; ocean warming/acidification.',
    points: 15,
    explanation: 'Coral bleaching triggered by elevated sea temperatures and ocean acidification threatens marine biodiversity.'
  },
  {
    id: 'q-sample-5',
    type: 'multiple-choice' as const,
    question: 'Which law of physics states that when one body exerts a force on a second body, the second body exerts an equal and opposite force?',
    options: ["Newton's First Law", "Newton's Second Law", "Newton's Third Law", "Law of Universal Gravitation"],
    correctAnswer: "Newton's Third Law",
    points: 10,
    explanation: "Newton's third law represents the law of action and reaction, governing propulsion in fluids and marine dynamics."
  }
];

/**
 * Extracts purely the letter (e.g. 'A', 'B', 'C', 'D') of the correct answer
 */
function getQuestionAnswerLetter(qFish: QuestionFishEntity | null): string {
  if (!qFish) return '';
  const raw = String(qFish.correctAnswer ?? '').trim();
  if (!raw) return '';

  if (qFish.options && qFish.options.length > 0) {
    // If raw is already a single letter (e.g. 'A', 'B')
    if (/^[A-Z]$/i.test(raw)) {
      const idx = raw.toUpperCase().charCodeAt(0) - 65;
      if (idx >= 0 && idx < qFish.options.length) {
        return raw.toUpperCase();
      }
    }
    // If raw is 0-based numeric index (e.g. '0', '1')
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed < qFish.options.length) {
      return String.fromCharCode(65 + parsed);
    }
    // Match against option string content
    const rawLower = raw.toLowerCase();
    const matchIdx = qFish.options.findIndex(opt => opt.trim().toLowerCase() === rawLower);
    if (matchIdx !== -1) {
      return String.fromCharCode(65 + matchIdx);
    }
    // Partial or fuzzy match against option string
    const subIdx = qFish.options.findIndex(opt => {
      const o = opt.trim().toLowerCase();
      return o.includes(rawLower) || rawLower.includes(o);
    });
    if (subIdx !== -1) {
      return String.fromCharCode(65 + subIdx);
    }
  }

  // True / False standard mapping
  if (qFish.type === 'true-false') {
    if (/^true$/i.test(raw) || raw === 'T') return 'A';
    if (/^false$/i.test(raw) || raw === 'F') return 'B';
  }

  if (raw.length === 1 && /^[a-z]$/i.test(raw)) {
    return raw.toUpperCase();
  }

  return raw;
}

interface TeacherSharkEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetVx: number;
  targetVy: number;
  direction: 1 | -1;
  state: 'patrolling' | 'hunting' | 'chomping';
  targetFishId: string | null;
  targetFishName: string | null;
  chompTimer: number;
  quote: string;
  quoteTimer: number;
  eatenCount: number;
  enabled: boolean;
  wigglePhase: number;
  huntCooldown: number;
  huntDuration?: number; // tracks chase duration to guarantee chomp
}

interface SplashBubble {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

interface FoodFlake {
  id: string;
  x: number;
  y: number;
  vy: number;
  color: string;
}

interface GlassRipple {
  id: string;
  x: number;
  y: number;
}

function determineSpecies(percentage: number, studentId: string): AquaticSpecies {
  const hash = studentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  if (percentage >= 90) {
    const pool: AquaticSpecies[] = ['turtle', 'moorishidol', 'yellowtang', 'angelfish'];
    return pool[hash % pool.length];
  } else if (percentage >= 70) {
    const pool: AquaticSpecies[] = ['bluetang', 'yellowtang', 'anthias', 'goldfish', 'mantaray'];
    return pool[hash % pool.length];
  } else if (percentage >= 50) {
    const pool: AquaticSpecies[] = ['clownfish', 'bluetang', 'anthias', 'pufferfish'];
    return pool[hash % pool.length];
  } else {
    // Little fish (<50%)
    const pool: AquaticSpecies[] = ['clownfish', 'pufferfish', 'anthias', 'goldfish'];
    return pool[hash % pool.length];
  }
}

export default function TeacherAquarium() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { activeUsers } = useActiveUsers();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [studentsProfileMap, setStudentsProfileMap] = useState<Record<string, UserProfile>>({});
  
  // Interactive Tank Features
  const [showSunbeams, setShowSunbeams] = useState(true);
  const [isSqueegeeActive, setIsSqueegeeActive] = useState(false);
  const [glassRipples, setGlassRipples] = useState<GlassRipple[]>([]);
  const [showNameTags, setShowNameTags] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedFish, setSelectedFish] = useState<FishEntity | null>(null);

  // Question Aquarium Mode: 'questions' (Each fish represents 1 assessment question) or 'students'
  const [tankMode, setTankMode] = useState<'questions' | 'students'>('questions');
  const [questionFishList, setQuestionFishList] = useState<QuestionFishEntity[]>([]);
  const [selectedQuestionFish, setSelectedQuestionFish] = useState<QuestionFishEntity | null>(null);
  const [filterQuestionType, setFilterQuestionType] = useState<'all' | 'multiple-choice' | 'true-false' | 'short-answer'>('all');
  const [showAnswerLetter, setShowAnswerLetter] = useState(false);

  // Speed & Settings
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [isAccelerationBurst, setIsAccelerationBurst] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [filterTier, setFilterTier] = useState<'all' | 'giant' | 'medium' | 'small' | 'little' | 'online'>('all');
  const [filterSpecies, setFilterSpecies] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Animated Entities
  const [fishList, setFishList] = useState<FishEntity[]>([]);
  const [foodFlakes, setFoodFlakes] = useState<FoodFlake[]>([]);
  const [splashBubbles, setSplashBubbles] = useState<SplashBubble[]>([]);
  const [minuteFeastCountdown, setMinuteFeastCountdown] = useState<number>(60);
  const [minuteFeastBanner, setMinuteFeastBanner] = useState<string | null>(null);
  const tankContainerRef = useRef<HTMLDivElement>(null);

  // TEACHER SHARK ENTITY (Big and Slow with Guaranteed Chomp)
  const [shark, setShark] = useState<TeacherSharkEntity>({
    x: 25,
    y: 35,
    vx: 0.12,
    vy: 0.02,
    targetVx: 0.12,
    targetVy: 0.02,
    direction: 1,
    state: 'patrolling',
    targetFishId: null,
    targetFishName: null,
    chompTimer: 0,
    quote: "I'm grading on a curve! 🦈",
    quoteTimer: 180,
    eatenCount: 0,
    enabled: true,
    wigglePhase: 0,
    huntCooldown: 120,
    huntDuration: 0
  });

  const speedRef = useRef({ multiplier: 1.0, burst: false });
  useEffect(() => {
    speedRef.current = { multiplier: speedMultiplier, burst: isAccelerationBurst };
  }, [speedMultiplier, isAccelerationBurst]);

  // 1. Parse quizId and mode from query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qId = params.get('quizId');
    if (qId) {
      setSelectedQuizId(qId);
    }
    const modeParam = params.get('mode');
    if (modeParam === 'students' || modeParam === 'questions') {
      setTankMode(modeParam);
    }
  }, [location.search]);

  // 2. Fetch all quizzes created by faculty
  useEffect(() => {
    if (!profile) return;
    const fetchQuizzes = async () => {
      try {
        setLoadingQuizzes(true);
        const q = query(
          collection(db, 'quizzes'),
          where('teacherId', '==', profile.uid)
        );
        const snap = await getDocs(q);
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Quiz))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setQuizzes(list);

        if (!selectedQuizId && list.length > 0) {
          setSelectedQuizId(list[0].id);
        }
      } catch (err) {
        console.error("Failed to load assessments for aquarium:", err);
      } finally {
        setLoadingQuizzes(false);
      }
    };
    fetchQuizzes();
  }, [profile]);

  // 3. Fetch submissions for ONLY the selected assessment
  const fetchSubmissionsForQuiz = useCallback(async (quizId: string) => {
    if (!quizId) {
      setSubmissions([]);
      setFishList([]);
      return;
    }
    try {
      setLoadingSubmissions(true);
      const q = query(
        collection(db, 'submissions'),
        where('quizId', '==', quizId)
      );
      const snap = await getDocs(q);
      const allSubs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as QuizSubmission))
        .filter(sub => {
          const role = (sub.studentRole || 'student').toLowerCase();
          return role === 'student' || sub.studentId === profile?.uid;
        });

      const subMap = new Map<string, QuizSubmission>();
      allSubs.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      allSubs.forEach(sub => {
        if (!subMap.has(sub.studentId)) {
          subMap.set(sub.studentId, sub);
        }
      });
      const uniqueSubs = Array.from(subMap.values());
      setSubmissions(uniqueSubs);

      const studentIds = uniqueSubs.map(s => s.studentId);
      if (studentIds.length > 0) {
        const profileMap: Record<string, UserProfile> = {};
        for (let i = 0; i < studentIds.length; i += 10) {
          const chunk = studentIds.slice(i, i + 10);
          try {
            const userQ = query(collection(db, 'users'), where('uid', 'in', chunk));
            const userSnap = await getDocs(userQ);
            userSnap.docs.forEach(doc => {
              const u = doc.data() as UserProfile;
              profileMap[u.uid] = u;
            });
          } catch {
            // Ignore
          }
        }
        setStudentsProfileMap(profileMap);
      }
    } catch (err) {
      console.error("Failed to fetch assessment submissions:", err);
    } finally {
      setLoadingSubmissions(false);
    }
  }, [profile?.uid]);

  useEffect(() => {
    if (selectedQuizId) {
      fetchSubmissionsForQuiz(selectedQuizId);
    }
  }, [selectedQuizId, fetchSubmissionsForQuiz]);

  const currentQuiz = quizzes.find(q => q.id === selectedQuizId);

  // 4. Initialize Fish Entities: All living, swimming fish with explicit 4-tier scaling!
  useEffect(() => {
    let effectiveSubs = [...submissions];

    // If no submissions exist, provide sample students across all 4 size tiers
    if (effectiveSubs.length === 0) {
      effectiveSubs = [
        {
          id: 'sample-maya-chen',
          quizId: selectedQuizId || 'sample-quiz',
          quizTitle: currentQuiz?.title || 'Assessment',
          teacherId: profile?.uid || 'teacher-id',
          studentId: 'sample-maya-chen',
          studentName: 'Maya Chen',
          score: 95,
          totalPoints: 100,
          submittedAt: new Date(Date.now() - 1800000).toISOString(),
          graded: true,
          studentRole: 'student',
          responses: [],
          timeTaken: 380
        },
        {
          id: 'sample-liam-davis',
          quizId: selectedQuizId || 'sample-quiz',
          quizTitle: currentQuiz?.title || 'Assessment',
          teacherId: profile?.uid || 'teacher-id',
          studentId: 'sample-liam-davis',
          studentName: 'Liam Davis',
          score: 82,
          totalPoints: 100,
          submittedAt: new Date(Date.now() - 2400000).toISOString(),
          graded: true,
          studentRole: 'student',
          responses: [],
          timeTaken: 450
        },
        {
          id: 'sample-noah-patel',
          quizId: selectedQuizId || 'sample-quiz',
          quizTitle: currentQuiz?.title || 'Assessment',
          teacherId: profile?.uid || 'teacher-id',
          studentId: 'sample-noah-patel',
          studentName: 'Noah Patel',
          score: 64,
          totalPoints: 100,
          submittedAt: new Date(Date.now() - 3200000).toISOString(),
          graded: true,
          studentRole: 'student',
          responses: [],
          timeTaken: 510
        },
        {
          id: 'sample-alex-rivera',
          quizId: selectedQuizId || 'sample-quiz',
          quizTitle: currentQuiz?.title || 'Assessment',
          teacherId: profile?.uid || 'teacher-id',
          studentId: 'sample-alex-rivera',
          studentName: 'Alex Rivera',
          score: 38,
          totalPoints: 100,
          submittedAt: new Date(Date.now() - 4000000).toISOString(),
          graded: true,
          studentRole: 'student',
          responses: [],
          timeTaken: 540
        },
        {
          id: 'sample-sam-taylor',
          quizId: selectedQuizId || 'sample-quiz',
          quizTitle: currentQuiz?.title || 'Assessment',
          teacherId: profile?.uid || 'teacher-id',
          studentId: 'sample-sam-taylor',
          studentName: 'Sam Taylor',
          score: 22,
          totalPoints: 100,
          submittedAt: new Date(Date.now() - 5000000).toISOString(),
          graded: true,
          studentRole: 'student',
          responses: [],
          timeTaken: 620
        }
      ];
    }

    const newFish: FishEntity[] = effectiveSubs.map((sub, index) => {
      const total = Number(sub.totalPoints) || (currentQuiz?.questions?.reduce((acc, q) => acc + (q.points || 1), 0)) || 100;
      const score = Number(sub.score) || 0;
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
      const species = determineSpecies(percentage, sub.studentId);
      const scale = calculateScoreScale(percentage);

      // Swimming depth and position based on tier and natural variety
      const x = 10 + (index * 18) % 78 + Math.random() * 4;
      const y = 18 + (index * 19) % 56 + Math.random() * 4;
      const initialDir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;

      // Base swim speed: little fish are nimble flutterers, giant fish are grand & majestic
      let baseSpeed = 0.25;
      if (percentage >= 90) baseSpeed = 0.20; // majestic apex glide
      else if (percentage >= 70) baseSpeed = 0.24;
      else if (percentage >= 50) baseSpeed = 0.28;
      else baseSpeed = 0.32; // cute quick little fish

      const vx = initialDir * baseSpeed;
      const vy = (Math.random() * 0.1 - 0.05);

      const userProfile = studentsProfileMap[sub.studentId];
      const photoURL = userProfile?.photoURL;

      return {
        id: sub.studentId,
        submissionId: sub.id,
        name: sub.studentName || 'Student',
        email: userProfile?.email || 'Student Account',
        photoURL,
        score: sub.score,
        totalPoints: sub.totalPoints,
        percentage,
        submittedAt: sub.submittedAt,
        timeTaken: sub.timeTaken,
        antiCheatTriggered: sub.antiCheatTriggered,
        breachCount: sub.breachCount,
        species,
        scale,
        x,
        y,
        vx,
        vy,
        targetVx: vx,
        targetVy: vy,
        direction: initialDir,
        baseSpeed,
        wigglePhase: Math.random() * Math.PI * 2,
        wiggleSpeed: percentage < 50 ? 0.24 : species === 'turtle' ? 0.09 : 0.16,
        eatingEffectTimer: 0,
        isTerrified: false,
        isEaten: false,
        respawnTimer: 0,
        shieldTimer: 0
      };
    });

    setFishList(newFish);
  }, [submissions, studentsProfileMap, selectedQuizId]);

  // 4b. Initialize Question Fish Entities (Each fish represents 1 question from selected assessment)
  useEffect(() => {
    const rawQuestions: any[] = (currentQuiz?.questions && currentQuiz.questions.length > 0)
      ? currentQuiz.questions
      : DEFAULT_SAMPLE_QUESTIONS;

    const speciesOrder: AquaticSpecies[] = [
      'angelfish',
      'clownfish',
      'bluetang',
      'yellowtang',
      'turtle',
      'mantaray',
      'moorishidol',
      'anthias',
      'goldfish',
      'pufferfish'
    ];

    const newQuestionFish: QuestionFishEntity[] = rawQuestions.map((q, idx) => {
      const qId = q.id || `q-${idx + 1}`;
      const qText = q.question || q.text || q.prompt || `Question ${idx + 1}`;
      const qType = (q.type as 'multiple-choice' | 'true-false' | 'short-answer') || 'multiple-choice';
      const points = Number(q.points) || 10;
      const options: string[] = Array.isArray(q.options) && q.options.length > 0
        ? q.options
        : qType === 'true-false'
        ? ['True', 'False']
        : [];
      const correctAnswer = String(q.correctAnswer ?? (options[0] || ''));
      const explanation = q.explanation || undefined;
      const imageUrl = q.imageUrl || undefined;

      // Real analytics from student submissions
      let totalAnswered = 0;
      let correctCount = 0;
      const choiceDistribution: Record<string, number> = {};

      submissions.forEach(sub => {
        if (!sub.responses || !Array.isArray(sub.responses)) return;
        const resp = sub.responses.find(r => r.questionId === qId || r.questionId === q.id);
        if (resp && resp.answer !== undefined && resp.answer !== '') {
          totalAnswered++;
          if (resp.isCorrect || resp.pointsEarned > 0) {
            correctCount++;
          }
          choiceDistribution[resp.answer] = (choiceDistribution[resp.answer] || 0) + 1;
        }
      });

      const incorrectCount = Math.max(0, totalAnswered - correctCount);
      const accuracy = totalAnswered > 0
        ? Math.round((correctCount / totalAnswered) * 100)
        : Math.min(100, Math.max(50, 96 - (idx * 9)));

      const species = speciesOrder[idx % speciesOrder.length];

      // Question fish size scaling:
      // High accuracy (>=85%): 1.6x (Apex mastered question)
      // Good accuracy (70-84%): 1.4x (Solid performance)
      // Challenging (<70%): 1.15x (Tricky question)
      let scale = 1.35;
      if (accuracy >= 85) scale = 1.60;
      else if (accuracy >= 70) scale = 1.40;
      else scale = 1.15;

      const x = 12 + (idx * 19) % 76 + Math.random() * 4;
      const y = 20 + (idx * 15) % 52 + Math.random() * 4;
      const initialDir: 1 | -1 = (idx % 2 === 0) ? 1 : -1;
      const baseSpeed = 0.22 + (idx % 3) * 0.03;
      const vx = initialDir * baseSpeed;
      const vy = (Math.random() * 0.1 - 0.05);

      const titleSnippet = qText.length > 36 ? qText.slice(0, 34) + '...' : qText;

      return {
        id: qId,
        index: idx + 1,
        questionText: qText,
        titleSnippet,
        type: qType,
        points,
        options,
        correctAnswer,
        explanation,
        imageUrl,
        totalAnswered,
        correctCount,
        incorrectCount,
        accuracy,
        choiceDistribution,
        species,
        scale,
        x,
        y,
        vx,
        vy,
        targetVx: vx,
        targetVy: vy,
        direction: initialDir,
        baseSpeed,
        wigglePhase: Math.random() * Math.PI * 2,
        wiggleSpeed: species === 'turtle' ? 0.09 : 0.16,
        eatingEffectTimer: 0,
        isTerrified: false,
        isEaten: false,
        respawnTimer: 0,
        shieldTimer: 0
      };
    });

    setQuestionFishList(newQuestionFish);
  }, [currentQuiz, submissions]);

  // 5. Physics Animation Loop with BIG & SLOW TEACHER SHARK & GUARANTEED CHOMP
  useEffect(() => {
    let animId: number;

    const updatePhysics = () => {
      const { multiplier, burst } = speedRef.current;
      const effectiveSpeedMultiplier = multiplier * (burst ? 2.2 : 1.0);
      const accelFactor = 0.06 * effectiveSpeedMultiplier;

      // UPDATE TEACHER SHARK (BIG AND SLOW WITH GUARANTEED CHOMP)
      setShark(prevShark => {
        if (!prevShark.enabled) return prevShark;

        let { 
          x, y, vx, vy, targetVx, targetVy, direction, 
          state, targetFishId, targetFishName, chompTimer, 
          quote, quoteTimer, eatenCount, wigglePhase, huntCooldown,
          huntDuration = 0
        } = prevShark;

        // Big heavy tail motion
        wigglePhase += 0.07 * effectiveSpeedMultiplier;

        if (quoteTimer > 0) {
          quoteTimer -= 1;
        }

        if (chompTimer > 0) {
          chompTimer -= 1;
          if (chompTimer === 0) {
            state = 'patrolling';
            huntCooldown = 140; // cool down before next target
            huntDuration = 0;
          }
        }

        // FIND ACTIVE TARGET FISH (if hunting)
        let targetFish: { id: string; name: string; x: number; y: number } | undefined;
        if (state === 'hunting' && targetFishId) {
          if (tankMode === 'questions') {
            const qTarget = questionFishList.find(q => q.id === targetFishId && !q.isEaten);
            if (qTarget) {
              targetFish = { id: qTarget.id, name: `Question ${qTarget.index}`, x: qTarget.x, y: qTarget.y };
            }
          } else {
            const fTarget = fishList.find(f => f.id === targetFishId && !f.isEaten);
            if (fTarget) {
              targetFish = { id: fTarget.id, name: fTarget.name, x: fTarget.x, y: fTarget.y };
            }
          }

          if (!targetFish) {
            state = 'patrolling';
            targetFishId = null;
            huntDuration = 0;
          }
        }

        // INITIATE RANDOM PATROL HUNT
        if (state === 'patrolling') {
          huntDuration = 0;
          if (huntCooldown > 0) {
            huntCooldown -= 1;
          } else if (Math.random() < 0.02) {
            if (tankMode === 'questions' && questionFishList.length > 0) {
              const available = questionFishList.filter(q => !q.isEaten);
              if (available.length > 0) {
                const chosen = available[Math.floor(Math.random() * available.length)];
                state = 'hunting';
                targetFishId = chosen.id;
                targetFishName = `Question ${chosen.index}`;
                quote = `Reviewing Question ${chosen.index}! Slow & steady chomp! 🦈📚`;
                quoteTimer = 180;
                targetFish = { id: chosen.id, name: `Question ${chosen.index}`, x: chosen.x, y: chosen.y };
                huntDuration = 0;
              }
            } else if (fishList.length > 0) {
              const availableFish = fishList.filter(f => !f.isEaten);
              if (availableFish.length > 0) {
                const chosen = availableFish[Math.floor(Math.random() * availableFish.length)];
                state = 'hunting';
                targetFishId = chosen.id;
                targetFishName = chosen.name;
                quote = SHARK_ACADEMIC_QUOTES[Math.floor(Math.random() * SHARK_ACADEMIC_QUOTES.length)];
                quoteTimer = 180;
                targetFish = { id: chosen.id, name: chosen.name, x: chosen.x, y: chosen.y };
                huntDuration = 0;
              }
            }
          }
        }

        // BIG & SLOW SHARK HUNT BEHAVIOR WITH GUARANTEED CHOMP
        if (state === 'hunting' && targetFish) {
          huntDuration += 1;
          const dx = targetFish.x - x;
          const dy = targetFish.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // SLOW, STEADY CHASE (Big and Slow)
          const chaseSpeed = 0.18 * effectiveSpeedMultiplier;
          if (dist > 0.5) {
            targetVx = (dx / dist) * chaseSpeed;
            targetVy = (dy / dist) * chaseSpeed;
            direction = dx > 0 ? 1 : -1;
          }

          // GUARANTEED CHOMP:
          // Generous chomp reach (12.5%) or auto-trigger after 170 ticks so it is 100% guaranteed!
          const isWithinChompReach = dist < 12.5 || huntDuration > 170;

          if (isWithinChompReach) {
            state = 'chomping';
            chompTimer = 65;
            eatenCount += 1;
            huntDuration = 0;

            const chompQuotes = tankMode === 'questions' ? [
              `CHOMP! Question concept reviewed! 🦈📚`,
              `CHOMP! ${targetFish.name} inspected! Class accuracy rising! ✨`,
              `BURP! That was a nutritious question! 🌊`,
              `CHOMP! Keep testing your curriculum questions! ✏️`
            ] : [
              `CHOMP! Pop quiz passed, ${targetFish.name}! 🦈`,
              `CHOMP! Extra credit review for ${targetFish.name}! 📚`,
              `BURP! Class average on the rise! 🦈✨`,
              `CHOMP! Excellent effort, ${targetFish.name}! ✏️`,
              `CHOMP! Keep swimming and studying hard, ${targetFish.name}! 🌊`
            ];
            quote = chompQuotes[Math.floor(Math.random() * chompQuotes.length)];
            quoteTimer = 190;

            if (soundEnabled) {
              playChompSound();
              setTimeout(() => playBubbleSound(280), 100);
            }

            // Spawn bubbling celebratory splash around the chomp location
            const chompX = targetFish.x;
            const chompY = targetFish.y;
            const newBubbles: SplashBubble[] = Array.from({ length: 8 }).map((_, i) => ({
              id: `b-${Date.now()}-${i}`,
              x: chompX + (Math.random() * 6 - 3),
              y: chompY + (Math.random() * 6 - 3),
              vx: (Math.random() - 0.5) * 0.35,
              vy: -0.2 - Math.random() * 0.25,
              size: 8 + Math.random() * 10,
              opacity: 1
            }));
            setSplashBubbles(prev => [...prev.slice(-24), ...newBubbles]);

            // Temporarily chomp the fish, then respawn healthy and vibrant!
            if (tankMode === 'questions') {
              setQuestionFishList(prevQ => prevQ.map(q => {
                if (q.id === targetFish!.id) {
                  return {
                    ...q,
                    isEaten: true,
                    respawnTimer: 90,
                    isTerrified: false
                  };
                }
                return q;
              }));
            } else {
              setFishList(prevFishes => prevFishes.map(f => {
                if (f.id === targetFish!.id) {
                  return {
                    ...f,
                    isEaten: true,
                    respawnTimer: 90,
                    isTerrified: false
                  };
                }
                return f;
              }));
            }
          }
        } else {
          // Patrol smoothly and slowly across the coral reef
          if (Math.random() < 0.012) {
            targetVy = (Math.random() - 0.5) * 0.12;
          }

          // Slow cruising speed for massive shark
          const patrolSpeed = 0.12 * effectiveSpeedMultiplier;
          if (x <= 12) {
            targetVx = patrolSpeed;
            direction = 1;
          } else if (x >= 86) {
            targetVx = -patrolSpeed;
            direction = -1;
          }

          if (y <= 16) targetVy = 0.09;
          if (y >= 74) targetVy = -0.09;
        }

        // Heavy mass smooth acceleration
        const sharkAccel = 0.035 * effectiveSpeedMultiplier;
        vx += (targetVx - vx) * sharkAccel;
        vy += (targetVy - vy) * sharkAccel;

        x += vx;
        y += vy;

        return {
          ...prevShark,
          x,
          y,
          vx,
          vy,
          targetVx,
          targetVy,
          direction,
          state,
          targetFishId,
          targetFishName,
          chompTimer,
          quote,
          quoteTimer,
          eatenCount,
          wigglePhase,
          huntCooldown,
          huntDuration
        };
      });

      // UPDATE ALL STUDENT LIVING FISH
      setFishList(prevFish => {
        if (prevFish.length === 0) return prevFish;

        return prevFish.map(fish => {
          let { 
            x, y, vx, vy, targetVx, targetVy, direction, 
            wigglePhase, eatingEffectTimer, baseSpeed, isEaten, 
            respawnTimer, isTerrified, shieldTimer 
          } = fish;

          // HANDLE RESPAWNING AFTER SHARK CHOMP
          if (isEaten) {
            if (respawnTimer > 0) {
              respawnTimer -= 1;
              if (respawnTimer === 0) {
                // Respawn from coral reef with protective bubble shield and cheerful bubble pop!
                isEaten = false;
                shieldTimer = 110; // glowing aura shield
                x = 15 + Math.random() * 70;
                y = 30 + Math.random() * 35;
                eatingEffectTimer = 55;
                if (soundEnabled) {
                  playBubbleSound(260);
                }
              }
            }
            return { ...fish, respawnTimer, isEaten, shieldTimer };
          }

          if (shieldTimer > 0) {
            shieldTimer -= 1;
          }

          // PROXIMITY TO TEACHER SHARK
          const sX = shark.x;
          const sY = shark.y;
          const distToShark = Math.sqrt((sX - x) * (sX - x) + (sY - y) * (sY - y));

          const isTargeted = shark.state === 'hunting' && shark.targetFishId === fish.id;
          if (isTargeted) {
            isTerrified = true;
            // Freezes in academic awe
            targetVx = 0;
            targetVy = 0;
            vx *= 0.6;
            vy *= 0.6;
            wigglePhase += 0.45 * effectiveSpeedMultiplier;
            // Gentle pull towards predator
            if (distToShark < 25) {
              const suctionFactor = 0.035 * effectiveSpeedMultiplier;
              x += (sX - x) * suctionFactor;
              y += (sY - y) * suctionFactor;
            }
          } else if (distToShark < 18) {
            // Bystanders scatter
            isTerrified = true;
            const fleeDx = x - sX;
            const fleeDy = y - sY;
            const fleeDist = Math.max(0.1, Math.sqrt(fleeDx * fleeDx + fleeDy * fleeDy));
            const fleeSpeed = baseSpeed * 2.0;
            targetVx = (fleeDx / fleeDist) * fleeSpeed;
            targetVy = (fleeDy / fleeDist) * fleeSpeed;
            direction = fleeDx > 0 ? 1 : -1;
            wigglePhase += 0.32 * effectiveSpeedMultiplier;
          } else {
            isTerrified = false;

            // Check if there are food flakes to eat
            let targetFood: FoodFlake | null = null;
            if (foodFlakes.length > 0) {
              let minDistance = 999;
              for (const flake of foodFlakes) {
                const dx = flake.x - x;
                const dy = flake.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDistance && dist < 42) {
                  minDistance = dist;
                  targetFood = flake;
                }
              }
            }

            if (targetFood) {
              const dx = targetFood.x - x;
              const dy = targetFood.y - y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              if (dist > 0.5) {
                targetVx = (dx / dist) * baseSpeed * 1.8;
                targetVy = (dy / dist) * baseSpeed * 1.5;
                direction = dx > 0 ? 1 : -1;
              }

              if (dist < 3.5) {
                setFoodFlakes(prev => prev.filter(f => f.id !== targetFood!.id));
                eatingEffectTimer = 45;
                if (soundEnabled) {
                  playBubbleSound(110);
                }
              }
            } else {
              // Natural wander
              if (Math.random() < 0.015) {
                targetVy = (Math.random() - 0.5) * 0.22;
              }

              const minX = 6;
              const maxX = 92;
              const minY = 12;
              const maxY = 76;

              if (x <= minX) {
                targetVx = Math.abs(baseSpeed);
                direction = 1;
              } else if (x >= maxX) {
                targetVx = -Math.abs(baseSpeed);
                direction = -1;
              }

              if (y <= minY) {
                targetVy = Math.abs(targetVy) + 0.05;
              } else if (y >= maxY) {
                targetVy = -Math.abs(targetVy) - 0.05;
              }
            }
          }

          vx += (targetVx - vx) * accelFactor;
          vy += (targetVy - vy) * accelFactor;

          x += vx * effectiveSpeedMultiplier;
          y += vy * effectiveSpeedMultiplier;

          wigglePhase += fish.wiggleSpeed * effectiveSpeedMultiplier;

          if (eatingEffectTimer > 0) {
            eatingEffectTimer -= 1;
          }

          return {
            ...fish,
            x,
            y,
            vx,
            vy,
            targetVx,
            targetVy,
            direction,
            wigglePhase,
            eatingEffectTimer,
            isTerrified,
            isEaten,
            respawnTimer,
            shieldTimer
          };
        });
      });

      // UPDATE ALL QUESTION FISH (1 FISH = 1 QUESTION FROM ASSESSMENT)
      setQuestionFishList(prevQFish => {
        if (prevQFish.length === 0) return prevQFish;

        return prevQFish.map(qFish => {
          let { 
            x, y, vx, vy, targetVx, targetVy, direction, 
            wigglePhase, eatingEffectTimer, baseSpeed, isEaten, 
            respawnTimer, isTerrified, shieldTimer 
          } = qFish;

          // HANDLE RESPAWNING AFTER CHOMP REVIEW
          if (isEaten) {
            if (respawnTimer > 0) {
              respawnTimer -= 1;
              if (respawnTimer === 0) {
                isEaten = false;
                shieldTimer = 110;
                x = 15 + Math.random() * 70;
                y = 25 + Math.random() * 35;
                eatingEffectTimer = 55;
                if (soundEnabled) {
                  playBubbleSound(260);
                }
              }
            }
            return { ...qFish, respawnTimer, isEaten, shieldTimer };
          }

          if (shieldTimer > 0) {
            shieldTimer -= 1;
          }

          // PROXIMITY TO TEACHER SHARK
          const sX = shark.x;
          const sY = shark.y;
          const distToShark = Math.sqrt((sX - x) * (sX - x) + (sY - y) * (sY - y));

          const isTargeted = shark.state === 'hunting' && shark.targetFishId === qFish.id;
          if (isTargeted) {
            isTerrified = true;
            targetVx = 0;
            targetVy = 0;
            vx *= 0.6;
            vy *= 0.6;
            wigglePhase += 0.45 * effectiveSpeedMultiplier;
            if (distToShark < 25) {
              const suctionFactor = 0.035 * effectiveSpeedMultiplier;
              x += (sX - x) * suctionFactor;
              y += (sY - y) * suctionFactor;
            }
          } else if (distToShark < 18) {
            isTerrified = true;
            const fleeDx = x - sX;
            const fleeDy = y - sY;
            const fleeDist = Math.max(0.1, Math.sqrt(fleeDx * fleeDx + fleeDy * fleeDy));
            const fleeSpeed = baseSpeed * 2.0;
            targetVx = (fleeDx / fleeDist) * fleeSpeed;
            targetVy = (fleeDy / fleeDist) * fleeSpeed;
            direction = fleeDx > 0 ? 1 : -1;
            wigglePhase += 0.32 * effectiveSpeedMultiplier;
          } else {
            isTerrified = false;

            // Food flakes interaction
            let targetFood: FoodFlake | null = null;
            if (foodFlakes.length > 0) {
              let minDistance = 999;
              for (const flake of foodFlakes) {
                const dx = flake.x - x;
                const dy = flake.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDistance && dist < 42) {
                  minDistance = dist;
                  targetFood = flake;
                }
              }
            }

            if (targetFood) {
              const dx = targetFood.x - x;
              const dy = targetFood.y - y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 0.5) {
                targetVx = (dx / dist) * baseSpeed * 1.8;
                targetVy = (dy / dist) * baseSpeed * 1.5;
                direction = dx > 0 ? 1 : -1;
              }
              if (dist < 3.5) {
                setFoodFlakes(prev => prev.filter(f => f.id !== targetFood!.id));
                eatingEffectTimer = 45;
                if (soundEnabled) {
                  playBubbleSound(110);
                }
              }
            } else {
              // Natural wander
              if (Math.random() < 0.015) {
                targetVy = (Math.random() - 0.5) * 0.22;
              }

              const minX = 6;
              const maxX = 92;
              const minY = 14;
              const maxY = 74;

              if (x <= minX) {
                targetVx = Math.abs(baseSpeed);
                direction = 1;
              } else if (x >= maxX) {
                targetVx = -Math.abs(baseSpeed);
                direction = -1;
              }

              if (y <= minY) {
                targetVy = Math.abs(targetVy) + 0.05;
              } else if (y >= maxY) {
                targetVy = -Math.abs(targetVy) - 0.05;
              }
            }
          }

          vx += (targetVx - vx) * accelFactor;
          vy += (targetVy - vy) * accelFactor;

          x += vx * effectiveSpeedMultiplier;
          y += vy * effectiveSpeedMultiplier;

          wigglePhase += qFish.wiggleSpeed * effectiveSpeedMultiplier;

          if (eatingEffectTimer > 0) {
            eatingEffectTimer -= 1;
          }

          return {
            ...qFish,
            x,
            y,
            vx,
            vy,
            targetVx,
            targetVy,
            direction,
            wigglePhase,
            eatingEffectTimer,
            isTerrified,
            isEaten,
            respawnTimer,
            shieldTimer
          };
        });
      });

      // Update splash bubbles
      setSplashBubbles(prev => {
        if (prev.length === 0) return prev;
        return prev
          .map(b => ({
            ...b,
            x: b.x + b.vx * effectiveSpeedMultiplier,
            y: b.y + b.vy * effectiveSpeedMultiplier,
            opacity: b.opacity - 0.02
          }))
          .filter(b => b.opacity > 0);
      });

      // Update food flakes sinking
      setFoodFlakes(prev => {
        if (prev.length === 0) return prev;
        return prev
          .map(f => ({ ...f, y: f.y + f.vy * effectiveSpeedMultiplier }))
          .filter(f => f.y < 82);
      });

      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animId);
  }, [foodFlakes, soundEnabled, shark.enabled, shark.state, shark.targetFishId, shark.x, shark.y, fishList, questionFishList, tankMode]);

  // Click on tank to drop food flakes
  const handleTankClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tankContainerRef.current) return;
    const rect = tankContainerRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const newFlakes: FoodFlake[] = Array.from({ length: 4 }).map((_, i) => ({
      id: `${Date.now()}-${Math.random()}-${i}`,
      x: Math.max(8, Math.min(92, clickX + (Math.random() * 8 - 4))),
      y: Math.max(5, Math.min(38, clickY + (Math.random() * 4 - 2))),
      vy: 0.12 + Math.random() * 0.08,
      color: ['#f59e0b', '#ec4899', '#10b981', '#38bdf8', '#fbbf24'][Math.floor(Math.random() * 5)]
    }));

    setFoodFlakes(prev => [...prev.slice(-25), ...newFlakes]);
    if (soundEnabled) {
      playBubbleSound();
    }
  };

  // Feed & Grow button handler
  const handleFeedAndGrow = () => {
    const flakes: FoodFlake[] = Array.from({ length: 14 }).map((_, i) => ({
      id: `${Date.now()}-${i}`,
      x: 10 + i * 6 + (Math.random() * 4 - 2),
      y: 8 + Math.random() * 8,
      vy: 0.1 + Math.random() * 0.08,
      color: ['#fbbf24', '#f97316', '#34d399', '#f43f5e', '#38bdf8'][i % 5]
    }));
    setFoodFlakes(prev => [...prev.slice(-20), ...flakes]);
    if (soundEnabled) {
      playBubbleSound();
    }
  };

  // Tap Glass Action
  const handleTapGlass = (e?: React.MouseEvent) => {
    if (soundEnabled) {
      playTapGlassSound();
    }

    const newRipple: GlassRipple = {
      id: `${Date.now()}`,
      x: e && tankContainerRef.current ? ((e.clientX - tankContainerRef.current.getBoundingClientRect().left) / tankContainerRef.current.getBoundingClientRect().width) * 100 : 50,
      y: e && tankContainerRef.current ? ((e.clientY - tankContainerRef.current.getBoundingClientRect().top) / tankContainerRef.current.getBoundingClientRect().height) * 100 : 50
    };
    setGlassRipples(prev => [...prev, newRipple]);
    setTimeout(() => {
      setGlassRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 900);

    setFishList(prev => prev.map(f => {
      const angle = Math.random() * Math.PI * 2;
      const speed = f.baseSpeed * 2.8;
      return {
        ...f,
        targetVx: Math.cos(angle) * speed,
        targetVy: Math.sin(angle) * speed,
        direction: Math.cos(angle) > 0 ? 1 : -1
      };
    }));

    setQuestionFishList(prev => prev.map(f => {
      const angle = Math.random() * Math.PI * 2;
      const speed = f.baseSpeed * 2.8;
      return {
        ...f,
        targetVx: Math.cos(angle) * speed,
        targetVy: Math.sin(angle) * speed,
        direction: Math.cos(angle) > 0 ? 1 : -1
      };
    }));
  };

  // Unleash / Direct Teacher Shark Hunt
  const triggerSharkHunt = useCallback(() => {
    if (tankMode === 'questions') {
      const availableQ = questionFishList.filter(q => !q.isEaten);
      if (availableQ.length === 0) return;
      const target = availableQ[Math.floor(Math.random() * availableQ.length)];
      setShark(prev => ({
        ...prev,
        enabled: true,
        state: 'hunting',
        targetFishId: target.id,
        targetFishName: `Question ${target.index}`,
        huntDuration: 0,
        quote: `POP QUIZ ON QUESTION ${target.index}! SLOW & STEADY CHOMP! 🦈📚`,
        quoteTimer: 210,
        huntCooldown: 120
      }));
    } else {
      const availableFish = fishList.filter(f => !f.isEaten);
      if (availableFish.length === 0) return;
      const target = availableFish[Math.floor(Math.random() * availableFish.length)];
      setShark(prev => ({
        ...prev,
        enabled: true,
        state: 'hunting',
        targetFishId: target.id,
        targetFishName: target.name,
        huntDuration: 0,
        quote: `POP QUIZ, ${target.name.toUpperCase()}! SLOW & STEADY CHOMP! 🦈📚`,
        quoteTimer: 210,
        huntCooldown: 120
      }));
    }
    if (soundEnabled) {
      playChompSound();
    }
  }, [tankMode, questionFishList, fishList, soundEnabled]);

  // Automatic 1-Minute Pop Quiz Shark Feast (Every 60s)
  const triggerMinuteSharkFeast = useCallback(() => {
    if (tankMode === 'questions') {
      const availableQ = questionFishList.filter(q => !q.isEaten);
      if (availableQ.length === 0) return;
      const sorted = [...availableQ].sort((a, b) => a.accuracy - b.accuracy);
      const target = sorted[0];

      setMinuteFeastBanner(`⏰ 1-MINUTE POP QUIZ! Big Teacher Shark inspecting Question ${target.index}! 🦈📚`);
      setTimeout(() => setMinuteFeastBanner(null), 5500);

      setShark(prev => ({
        ...prev,
        enabled: true,
        state: 'hunting',
        targetFishId: target.id,
        targetFishName: `Question ${target.index}`,
        huntDuration: 0,
        quote: `1-MINUTE POP QUIZ ON QUESTION ${target.index}! GUARANTEED CHOMP! 🦈`,
        quoteTimer: 230,
        huntCooldown: 150
      }));
    } else {
      const availableFish = fishList.filter(f => !f.isEaten);
      if (availableFish.length === 0) return;

      const sorted = [...availableFish].sort((a, b) => a.percentage - b.percentage);
      const target = sorted[0];

      setMinuteFeastBanner(`⏰ 1-MINUTE POP QUIZ! Big Teacher Shark is stalking ${target.name}! 🦈📚`);
      setTimeout(() => setMinuteFeastBanner(null), 5500);

      setShark(prev => ({
        ...prev,
        enabled: true,
        state: 'hunting',
        targetFishId: target.id,
        targetFishName: target.name,
        huntDuration: 0,
        quote: `1-MINUTE POP QUIZ, ${target.name.toUpperCase()}! GUARANTEED CHOMP! 🦈`,
        quoteTimer: 230,
        huntCooldown: 150
      }));
    }

    if (soundEnabled) {
      playChompSound();
    }
  }, [tankMode, questionFishList, fishList, soundEnabled]);

  // Recurring 1-minute interval for Teacher Shark Feast
  useEffect(() => {
    const timer = setInterval(() => {
      setMinuteFeastCountdown(prev => {
        if (prev <= 1) {
          triggerMinuteSharkFeast();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [triggerMinuteSharkFeast]);

  // Squeegee Clean Glass Action
  const handleSqueegee = () => {
    if (isSqueegeeActive) return;
    setIsSqueegeeActive(true);
    if (soundEnabled) {
      playBubbleSound(300);
      setTimeout(() => playBubbleSound(450), 400);
      setTimeout(() => playBubbleSound(600), 800);
    }
    setTimeout(() => {
      setIsSqueegeeActive(false);
    }, 2400);
  };

  const toggleTankFullscreen = () => {
    if (!tankContainerRef.current) return;
    if (!document.fullscreenElement) {
      tankContainerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const filteredFish = useMemo(() => {
    return fishList.filter(fish => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matches = fish.name.toLowerCase().includes(query) || fish.email.toLowerCase().includes(query);
        if (!matches) return false;
      }
      if (filterSpecies !== 'all' && fish.species !== filterSpecies) {
        return false;
      }
      if (filterTier === 'all') return true;
      if (filterTier === 'giant') return fish.percentage >= 90;
      if (filterTier === 'medium') return fish.percentage >= 70 && fish.percentage < 90;
      if (filterTier === 'small') return fish.percentage >= 50 && fish.percentage < 70;
      if (filterTier === 'little') return fish.percentage < 50;
      if (filterTier === 'online') {
        return activeUsers.some(u => u.uid === fish.id && u.status !== 'offline');
      }
      return true;
    });
  }, [fishList, searchTerm, filterTier, filterSpecies, activeUsers]);

  const filteredQuestionFish = useMemo(() => {
    return questionFishList.filter(qFish => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matches = 
          qFish.questionText.toLowerCase().includes(query) ||
          `q${qFish.index}`.toLowerCase().includes(query) ||
          qFish.options.some(opt => opt.toLowerCase().includes(query));
        if (!matches) return false;
      }
      if (filterSpecies !== 'all' && qFish.species !== filterSpecies) {
        return false;
      }
      if (filterQuestionType !== 'all' && qFish.type !== filterQuestionType) {
        return false;
      }
      return true;
    });
  }, [questionFishList, searchTerm, filterSpecies, filterQuestionType]);

  const stats = useMemo(() => {
    if (fishList.length === 0) {
      return { count: 0, avg: 0, high: 0, low: 0, giantCount: 0, mediumCount: 0, smallCount: 0, littleCount: 0 };
    }
    const scores = fishList.map(f => f.percentage);
    const count = scores.length;
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / count);
    const high = Math.max(...scores);
    const low = Math.min(...scores);
    const giantCount = fishList.filter(f => f.percentage >= 90).length;
    const mediumCount = fishList.filter(f => f.percentage >= 70 && f.percentage < 90).length;
    const smallCount = fishList.filter(f => f.percentage >= 50 && f.percentage < 70).length;
    const littleCount = fishList.filter(f => f.percentage < 50).length;

    return { count, avg, high, low, giantCount, mediumCount, smallCount, littleCount };
  }, [fishList]);

  const questionStats = useMemo(() => {
    if (questionFishList.length === 0) {
      return { totalQuestions: 0, totalPoints: 0, avgAccuracy: 0, masteredCount: 0, reviewCount: 0 };
    }
    const totalQuestions = questionFishList.length;
    const totalPoints = questionFishList.reduce((acc, q) => acc + q.points, 0);
    const avgAccuracy = Math.round(questionFishList.reduce((acc, q) => acc + q.accuracy, 0) / totalQuestions);
    const masteredCount = questionFishList.filter(q => q.accuracy >= 80).length;
    const reviewCount = questionFishList.filter(q => q.accuracy < 70).length;

    return { totalQuestions, totalPoints, avgAccuracy, masteredCount, reviewCount };
  }, [questionFishList]);

  // Render Species-Specific SVG Creature (works for both Student Fish and Question Fish)
  const renderCreatureSVG = (fish: { species: AquaticSpecies; wigglePhase: number }) => {
    const tailAngle = Math.sin(fish.wigglePhase) * 16;
    const flipperAngle = Math.sin(fish.wigglePhase) * 22;

    switch (fish.species) {
      case 'turtle':
        return (
          <svg viewBox="0 0 110 75" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="turtleShellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4d7c0f" />
                <stop offset="50%" stopColor="#15803d" />
                <stop offset="100%" stopColor="#14532d" />
              </linearGradient>
              <linearGradient id="turtleSkinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#86efac" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
            <g style={{ transformOrigin: '25px 46px', transform: `rotate(${-flipperAngle * 0.5}deg)` }}>
              <ellipse cx="22" cy="46" rx="9" ry="4" fill="url(#turtleSkinGrad)" opacity="0.9" />
            </g>
            <g style={{ transformOrigin: '25px 22px', transform: `rotate(${flipperAngle * 0.5}deg)` }}>
              <ellipse cx="22" cy="22" rx="9" ry="4" fill="url(#turtleSkinGrad)" opacity="0.9" />
            </g>
            <g style={{ transformOrigin: '65px 16px', transform: `rotate(${flipperAngle}deg)` }}>
              <path d="M 65 18 C 75 4, 92 -4, 94 8 C 88 20, 72 26, 65 18 Z" fill="url(#turtleSkinGrad)" stroke="#15803d" strokeWidth="1" />
            </g>
            <g style={{ transformOrigin: '65px 54px', transform: `rotate(${-flipperAngle}deg)` }}>
              <path d="M 65 54 C 72 46, 88 52, 94 64 C 92 76, 75 68, 65 54 Z" fill="url(#turtleSkinGrad)" stroke="#15803d" strokeWidth="1" />
            </g>
            <path d="M 16 35 L 4 37.5 L 16 40 Z" fill="url(#turtleSkinGrad)" />
            <ellipse cx="50" cy="37.5" rx="34" ry="24" fill="url(#turtleShellGrad)" stroke="#facc15" strokeWidth="1.5" />
            <polygon points="50,22 62,30 62,44 50,52 38,44 38,30" fill="#166534" opacity="0.7" stroke="#ca8a04" strokeWidth="1" />
            <ellipse cx="88" cy="37.5" rx="14" ry="10" fill="url(#turtleSkinGrad)" stroke="#15803d" strokeWidth="1" />
            <circle cx="94" cy="33.5" r="3" fill="#0f172a" />
            <circle cx="95" cy="32.5" r="1" fill="#ffffff" />
          </svg>
        );

      case 'yellowtang':
        return (
          <svg viewBox="0 0 100 65" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="yellowTangGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#eab308" />
              </linearGradient>
            </defs>
            <g style={{ transformOrigin: '24px 32px', transform: `rotate(${tailAngle}deg)` }}>
              <polygon points="24,32 6,20 10,32 6,44" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
            </g>
            <ellipse cx="56" cy="32" rx="32" ry="22" fill="url(#yellowTangGrad)" />
            <circle cx="28" cy="32" r="2.5" fill="#ffffff" stroke="#a16207" strokeWidth="0.8" />
            <circle cx="78" cy="27" r="4.5" fill="#ffffff" />
            <circle cx="79.5" cy="26.5" r="2.2" fill="#0f172a" />
          </svg>
        );

      case 'moorishidol':
        return (
          <svg viewBox="0 0 110 85" className="w-full h-full overflow-visible">
            <path d="M 50 30 Q 30 -5, 10 -20" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <g style={{ transformOrigin: '28px 45px', transform: `rotate(${tailAngle}deg)` }}>
              <polygon points="28,45 8,32 12,45 8,58" fill="#0f172a" />
            </g>
            <ellipse cx="60" cy="45" rx="30" ry="24" fill="#f8fafc" />
            <path d="M 44 24 Q 46 45, 44 66 L 36 62 L 36 28 Z" fill="#0f172a" />
            <path d="M 68 22 Q 70 45, 68 68 L 58 66 L 58 24 Z" fill="#0f172a" />
            <polygon points="85,42 96,45 85,48" fill="#facc15" />
            <circle cx="76" cy="40" r="3.5" fill="#ffffff" />
            <circle cx="77" cy="40" r="1.8" fill="#0f172a" />
          </svg>
        );

      case 'anthias':
        return (
          <svg viewBox="0 0 100 65" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="anthiasGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="50%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
            <g style={{ transformOrigin: '24px 32px', transform: `rotate(${tailAngle}deg)` }}>
              <path d="M 24 32 C 10 16, 0 14, 2 32 C 0 50, 10 48, 24 32 Z" fill="#f43f5e" opacity="0.95" />
            </g>
            <ellipse cx="56" cy="32" rx="33" ry="17" fill="url(#anthiasGrad)" />
            <path d="M 40 18 Q 54 8, 66 18 Z" fill="#fb7185" />
            <circle cx="78" cy="28" r="4.5" fill="#ffffff" />
            <circle cx="79.5" cy="27.5" r="2.2" fill="#0f172a" />
          </svg>
        );

      case 'angelfish':
        return (
          <svg viewBox="0 0 100 80" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="angelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#ca8a04" />
              </linearGradient>
            </defs>
            {/* Long trailing dorsal and pelvic filaments */}
            <path d="M 46 22 L 32 -10" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 46 54 L 30 88" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" />
            <g style={{ transformOrigin: '22px 38px', transform: `rotate(${tailAngle}deg)` }}>
              <polygon points="22,38 2,24 6,38 2,52" fill="#fef08a" opacity="0.9" />
            </g>
            <ellipse cx="52" cy="38" rx="30" ry="22" fill="url(#angelGrad)" />
            {/* Elegant vertical black stripes */}
            <path d="M 42 20 Q 44 38, 42 56" stroke="#0f172a" strokeWidth="2.5" fill="none" />
            <path d="M 58 18 Q 60 38, 58 58" stroke="#0f172a" strokeWidth="2.5" fill="none" />
            <circle cx="72" cy="34" r="4" fill="#ffffff" />
            <circle cx="73.5" cy="33.5" r="2" fill="#0f172a" />
          </svg>
        );

      case 'mantaray':
        return (
          <svg viewBox="0 0 110 75" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="mantaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="50%" stopColor="#334155" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
            </defs>
            <path d="M 25 37 Q 8 37, 2 37" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
            {/* Undulating diamond wings */}
            <path 
              d={`M 25 37 Q 52 ${10 - flipperAngle * 0.3}, 78 37 Q 52 ${64 + flipperAngle * 0.3}, 25 37 Z`} 
              fill="url(#mantaGrad)" 
              stroke="#64748b" 
              strokeWidth="1.2" 
            />
            {/* Cephalic fins near mouth */}
            <path d="M 78 33 Q 86 31, 84 37 Q 86 43, 78 41 Z" fill="#475569" />
            <circle cx="74" cy="32" r="2.5" fill="#f8fafc" />
            <circle cx="74" cy="42" r="2.5" fill="#f8fafc" />
          </svg>
        );

      case 'pufferfish':
        return (
          <svg viewBox="0 0 95 65" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="pufferGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fed7aa" />
                <stop offset="50%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
            </defs>
            <g style={{ transformOrigin: '20px 32px', transform: `rotate(${tailAngle * 1.3}deg)` }}>
              <polygon points="20,32 6,24 8,32 6,40" fill="#f97316" />
            </g>
            {/* Round bubbly puffer body */}
            <circle cx="52" cy="32" r="26" fill="url(#pufferGrad)" />
            {/* Tiny cute prickles */}
            {[34, 46, 58, 68].map(xP => (
              <circle key={xP} cx={xP} cy={16} r="1.5" fill="#c2410c" />
            ))}
            {[34, 46, 58, 68].map(xP => (
              <circle key={`bot-${xP}`} cx={xP} cy={48} r="1.5" fill="#c2410c" />
            ))}
            <circle cx="68" cy="28" r="4.5" fill="#ffffff" />
            <circle cx="69.5" cy="27.5" r="2.4" fill="#0f172a" />
            <ellipse cx="76" cy="35" rx="3" ry="2" fill="#ef4444" />
          </svg>
        );

      case 'bluetang':
        return (
          <svg viewBox="0 0 100 65" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="blueTangGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </linearGradient>
            </defs>
            <g style={{ transformOrigin: '24px 32px', transform: `rotate(${tailAngle}deg)` }}>
              <polygon points="24,32 4,18 8,32 4,46" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
            </g>
            <ellipse cx="56" cy="32" rx="34" ry="19" fill="url(#blueTangGrad)" />
            <path d="M 38 24 Q 62 16, 72 26 Q 56 38, 38 24 Z" fill="#0f172a" opacity="0.85" />
            <ellipse cx="50" cy="32" rx="10" ry="4" fill="#facc15" opacity="0.85" />
            <circle cx="78" cy="28" r="4.5" fill="#ffffff" />
            <circle cx="79.5" cy="27.5" r="2.2" fill="#0f172a" />
          </svg>
        );

      case 'clownfish':
      case 'goldfish':
      default:
        return (
          <svg viewBox="0 0 100 65" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="clownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="50%" stopColor="#ea580c" />
                <stop offset="100%" stopColor="#c2410c" />
              </linearGradient>
            </defs>
            <g style={{ transformOrigin: '22px 32px', transform: `rotate(${tailAngle}deg)` }}>
              <path d="M 22 32 C 12 20, 2 22, 4 32 C 2 42, 12 44, 22 32 Z" fill="url(#clownGrad)" />
            </g>
            <ellipse cx="56" cy="32" rx="34" ry="18" fill="url(#clownGrad)" />
            <path d="M 50 16 Q 52 32, 50 48 Q 46 32, 46 16 Z" fill="white" stroke="#0f172a" strokeWidth="0.8" />
            <path d="M 68 18 Q 70 32, 68 46 Q 64 32, 64 18 Z" fill="white" stroke="#0f172a" strokeWidth="0.8" />
            <circle cx="78" cy="28" r="4.5" fill="white" />
            <circle cx="79.5" cy="27.5" r="2.2" fill="#0f172a" />
          </svg>
        );
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link 
              to="/teacher" 
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Teacher Console
            </Link>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1">
              <Fish className="w-3.5 h-3.5" /> Coral Reef Aquarium
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black font-display text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <span>Classroom Coral Reef</span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
              <Sparkles className="w-3.5 h-3.5 text-cyan-500 animate-spin" />
              Live Visualizer
            </span>
            {shark.enabled && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-500 text-white shadow-sm animate-pulse">
                🦈 Teacher Shark Active
              </span>
            )}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            {tankMode === 'questions' ? (
              <span>
                <strong className="text-cyan-600 dark:text-cyan-400 font-black">Question Aquarium:</strong> Each swimming fish contains one assessment question. Click any fish to inspect its question, options, answer key & accuracy!
              </span>
            ) : (
              <span>
                <strong className="text-indigo-600 dark:text-indigo-400 font-black">Student Tank:</strong> <span className="font-bold text-amber-500">90-100% are much bigger</span>, <span className="font-bold text-emerald-500">70-89% medium</span>, <span className="font-bold text-sky-500">50-69% small</span>, and <span className="font-bold text-rose-500">&lt;50% little fish</span>.
              </span>
            )}
          </p>
        </div>

        {/* Header Controls: Mode Switcher & Assessment Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Switcher: Question Reef vs Student Swimmers */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
            <button
              onClick={() => setTankMode('questions')}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                tankMode === 'questions'
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 font-black"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
              title="Each fish represents 1 question from this assessment"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Questions Reef</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded text-[10px] font-mono font-bold",
                tankMode === 'questions' ? "bg-slate-950/20 text-slate-950" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              )}>
                {questionFishList.length}
              </span>
            </button>

            <button
              onClick={() => setTankMode('students')}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                tankMode === 'students'
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-black"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
              title="Fish represent student submissions sized by score"
            >
              <Fish className="w-4 h-4" />
              <span>Student Swimmers</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded text-[10px] font-mono font-bold",
                tankMode === 'students' ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              )}>
                {fishList.length}
              </span>
            </button>
          </div>

          {/* Assessment Selector Dropdown */}
          <div className="relative min-w-[240px] sm:min-w-[280px]">
            <div className="relative">
              <select
                value={selectedQuizId}
                onChange={(e) => setSelectedQuizId(e.target.value)}
                disabled={loadingQuizzes || quizzes.length === 0}
                className="w-full appearance-none bg-white dark:bg-slate-900 border-2 border-cyan-500/30 hover:border-cyan-500 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 rounded-xl px-4 py-2.5 pr-10 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-sm transition-all cursor-pointer"
              >
                {quizzes.length === 0 ? (
                  <option value="">No Assessments Found</option>
                ) : (
                  quizzes.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.title} {q.isHidden ? ' (Hidden)' : ''}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-600 dark:text-cyan-400 pointer-events-none" />
            </div>
          </div>

          <button
            onClick={() => fetchSubmissionsForQuiz(selectedQuizId)}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all shadow-sm active:scale-95"
            title="Refresh Tank Data"
          >
            <RefreshCw className={cn("w-4 h-4", (loadingSubmissions || loadingQuizzes) && "animate-spin text-cyan-500")} />
          </button>
        </div>
      </div>

      {/* Contextual Metrics: Question Reef vs Student Swimmers */}
      {currentQuiz && tankMode === 'questions' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Total Questions in Assessment */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-100 dark:border-cyan-900 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
              <FileQuestion className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Questions</p>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">
                {questionStats.totalQuestions}
              </p>
            </div>
          </div>

          {/* Total Points */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Points</p>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">
                {questionStats.totalPoints} <span className="text-xs text-slate-400">pts</span>
              </p>
            </div>
          </div>

          {/* Average Accuracy */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Class Accuracy</p>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">
                {questionStats.avgAccuracy}%
              </p>
            </div>
          </div>

          {/* Mastered Questions (>=80%) */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">≥80% Mastered</p>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">
                {questionStats.masteredCount} <span className="text-xs text-slate-400">fish</span>
              </p>
            </div>
          </div>

          {/* Needs Review (<70%) */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <AlertCircle className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">&lt;70% Challenging</p>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">
                {questionStats.reviewCount} <span className="text-xs text-slate-400">fish</span>
              </p>
            </div>
          </div>

          {/* Question Type Filter Dropdown */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-center">
            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Filter By Type
            </label>
            <select
              value={filterQuestionType}
              onChange={(e) => setFilterQuestionType(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none"
            >
              <option value="all">All Question Types</option>
              <option value="multiple-choice">Multiple Choice</option>
              <option value="true-false">True / False</option>
              <option value="short-answer">Short Answer</option>
            </select>
          </div>

          {/* Big Teacher Shark Question Inspector */}
          <div 
            onClick={triggerMinuteSharkFeast}
            className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border-2 border-red-200 dark:border-red-900/60 shadow-xs flex items-center justify-between cursor-pointer hover:border-red-400 hover:scale-[1.02] active:scale-95 transition-all group"
            title="Click to trigger Big Teacher Shark guaranteed question inspection!"
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-800 flex items-center justify-center text-lg shrink-0 group-hover:rotate-12 transition-transform">
                🦈
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-red-500 dark:text-red-400 flex items-center gap-1">
                  <span>Big Shark</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                </p>
                <p className="text-lg font-black text-slate-900 dark:text-white leading-none mt-0.5">
                  {minuteFeastCountdown}s
                </p>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase tracking-tight bg-red-600 text-white px-2 py-1 rounded-md shadow-xs group-hover:bg-red-500">
              Inspect
            </span>
          </div>
        </div>
      )}

      {/* Assessment Summary Badges & 4-Tier Fish Size Counts (STUDENTS MODE) */}
      {currentQuiz && tankMode === 'students' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-100 dark:border-cyan-900 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
              <Fish className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Fish</p>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">{stats.count}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Class Average</p>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">{stats.avg}%</p>
            </div>
          </div>

          {/* 90-100% Much Bigger Fish */}
          <div 
            onClick={() => setFilterTier(prev => prev === 'giant' ? 'all' : 'giant')}
            className={cn(
              "bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-xs flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02]",
              filterTier === 'giant' ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200 dark:border-slate-800"
            )}
            title="Click to filter 90-100% Much Bigger Fish"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 font-black text-xs">
              2.2x
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <span>90-100% Giant</span>
                <Sparkles className="w-3 h-3 text-amber-400" />
              </p>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">{stats.giantCount}</p>
            </div>
          </div>

          {/* 70-89% Medium Fish */}
          <div 
            onClick={() => setFilterTier(prev => prev === 'medium' ? 'all' : 'medium')}
            className={cn(
              "bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-xs flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02]",
              filterTier === 'medium' ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200 dark:border-slate-800"
            )}
            title="Click to filter 70-89% Medium Fish"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 font-black text-xs">
              1.45x
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">70-89% Medium</p>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">{stats.mediumCount}</p>
            </div>
          </div>

          {/* 50-69% Small Fish */}
          <div 
            onClick={() => setFilterTier(prev => prev === 'small' ? 'all' : 'small')}
            className={cn(
              "bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-xs flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02]",
              filterTier === 'small' ? "border-sky-500 ring-2 ring-sky-500/20" : "border-slate-200 dark:border-slate-800"
            )}
            title="Click to filter 50-69% Small Fish"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0 font-black text-xs">
              1.0x
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">50-69% Small</p>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">{stats.smallCount}</p>
            </div>
          </div>

          {/* <50% Little Fish */}
          <div 
            onClick={() => setFilterTier(prev => prev === 'little' ? 'all' : 'little')}
            className={cn(
              "bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-xs flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02]",
              filterTier === 'little' ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200 dark:border-slate-800"
            )}
            title="Click to filter <50% Little Fish"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 font-black text-xs">
              0.65x
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">&lt;50% Little</p>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">{stats.littleCount}</p>
            </div>
          </div>

          {/* Big Teacher Shark Patrol */}
          <div 
            onClick={triggerMinuteSharkFeast}
            className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border-2 border-red-200 dark:border-red-900/60 shadow-xs flex items-center justify-between cursor-pointer hover:border-red-400 hover:scale-[1.02] active:scale-95 transition-all group"
            title="Click to trigger Big Teacher Shark guaranteed chomp!"
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-800 flex items-center justify-center text-lg shrink-0 group-hover:rotate-12 transition-transform">
                🦈
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-red-500 dark:text-red-400 flex items-center gap-1">
                  <span>Big Shark</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                </p>
                <p className="text-lg font-black text-slate-900 dark:text-white leading-none mt-0.5">
                  {minuteFeastCountdown}s
                </p>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase tracking-tight bg-red-600 text-white px-2 py-1 rounded-md shadow-xs group-hover:bg-red-500">
              Chomp
            </span>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MAIN AQUARIUM TANK CONTAINER */}
      {/* ============================================================== */}
      <div 
        ref={tankContainerRef}
        className={cn(
          "relative w-full rounded-3xl overflow-hidden border-4 border-slate-800/80 shadow-2xl transition-all duration-300 select-none",
          isFullscreen ? "fixed inset-0 z-50 rounded-none border-none h-screen w-screen" : "h-[640px] md:h-[720px]"
        )}
        style={{
          backgroundImage: 'url(/assets/aistudio/image_reef_clean.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center center'
        }}
        onClick={handleTankClick}
        onDoubleClick={handleTapGlass}
      >
        {/* 1-Minute Pop Quiz Announcement Banner */}
        {minuteFeastBanner && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 px-5 py-2 rounded-full text-xs font-black bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shadow-2xl border-2 border-white/80 animate-bounce flex items-center gap-2 pointer-events-none">
            <span className="text-sm">🦈</span>
            <span className="tracking-wide drop-shadow-sm">{minuteFeastBanner}</span>
          </div>
        )}

        {/* Soft Volumetric Radiant Sunbeams */}
        {showSunbeams && (
          <div 
            className="absolute inset-0 pointer-events-none mix-blend-screen transition-opacity duration-700"
            style={{
              background: 'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.45) 0%, rgba(56, 189, 248, 0.25) 45%, transparent 75%)'
            }}
          />
        )}

        {/* Vertical Bubble Aeration Columns */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Left Bubble Column */}
          {Array.from({ length: 26 }).map((_, i) => (
            <div
              key={`left-col-${i}`}
              className="absolute rounded-full border border-white/70 shadow-xs"
              style={{
                left: `${8 + (Math.sin(i * 1.3) * 3)}%`,
                bottom: '-20px',
                width: `${5 + (i % 6) * 3.5}px`,
                height: `${5 + (i % 6) * 3.5}px`,
                backgroundColor: 'rgba(255, 255, 255, 0.35)',
                boxShadow: '0 0 6px rgba(255, 255, 255, 0.6), inset 0 0 3px #ffffff',
                animation: `bubbleFloat ${3.8 + (i % 4) * 0.9}s infinite linear`,
                animationDelay: `${(i * 0.22)}s`
              }}
            />
          ))}

          {/* Right Bubble Column */}
          {Array.from({ length: 26 }).map((_, i) => (
            <div
              key={`right-col-${i}`}
              className="absolute rounded-full border border-white/70 shadow-xs"
              style={{
                left: `${88 + (Math.cos(i * 1.3) * 3)}%`,
                bottom: '-20px',
                width: `${5 + (i % 6) * 3.5}px`,
                height: `${5 + (i % 6) * 3.5}px`,
                backgroundColor: 'rgba(255, 255, 255, 0.35)',
                boxShadow: '0 0 6px rgba(255, 255, 255, 0.6), inset 0 0 3px #ffffff',
                animation: `bubbleFloat ${3.6 + (i % 4) * 0.85}s infinite linear`,
                animationDelay: `${(i * 0.25)}s`
              }}
            />
          ))}

          {/* Ambient center bubbles */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={`center-ambient-${i}`}
              className="absolute rounded-full border border-white/40"
              style={{
                left: `${25 + i * 4.5}%`,
                bottom: '-20px',
                width: `${4 + (i % 4) * 2}px`,
                height: `${4 + (i % 4) * 2}px`,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                animation: `bubbleFloat ${6 + (i % 3) * 1.5}s infinite linear`,
                animationDelay: `${(i * 0.6)}s`
              }}
            />
          ))}
        </div>

        {/* Floating Food Flakes */}
        {foodFlakes.map(flake => (
          <div
            key={flake.id}
            className="absolute rounded-full pointer-events-none shadow-xs"
            style={{
              left: `${flake.x}%`,
              top: `${flake.y}%`,
              width: '8px',
              height: '8px',
              backgroundColor: flake.color,
              boxShadow: `0 0 8px ${flake.color}`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        ))}

        {/* Splash Bubbles (Chomp effect) */}
        {splashBubbles.map(b => (
          <div
            key={b.id}
            className="absolute rounded-full border border-white/80 pointer-events-none"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.size}px`,
              height: `${b.size}px`,
              backgroundColor: 'rgba(255,255,255,0.4)',
              opacity: b.opacity,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 8px rgba(255,255,255,0.7)'
            }}
          />
        ))}

        {/* Glass Tap Shockwave Ripples */}
        {glassRipples.map(ripple => (
          <div
            key={ripple.id}
            className="absolute rounded-full border-2 border-white/70 pointer-events-none animate-glass-ripple"
            style={{
              left: `${ripple.x}%`,
              top: `${ripple.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        ))}

        {/* Squeegee Cleaning Blade Animation */}
        {isSqueegeeActive && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
            <div className="absolute top-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-cyan-200/40 to-white/70 border-r-4 border-white shadow-2xl animate-squeegee-wipe flex flex-col justify-center items-end pr-2">
              <span className="text-xs font-black text-cyan-900 bg-white/90 px-2 py-0.5 rounded-full shadow-md">
                ✨ Crystal Clean
              </span>
            </div>
            <div className="absolute inset-0 flex items-center justify-around opacity-90 animate-pulse">
              <Sparkles className="w-8 h-8 text-yellow-300" />
              <Sparkles className="w-6 h-6 text-white" />
              <Sparkles className="w-10 h-10 text-cyan-200" />
            </div>
          </div>
        )}

        {/* Empty State / Loading State Inside Tank */}
        {loadingSubmissions ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-cyan-100 z-10 backdrop-blur-xs">
            <div className="w-12 h-12 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin mb-4" />
            <p className="text-sm font-bold tracking-wider uppercase">Loading Coral Reef Swimmers...</p>
          </div>
        ) : fishList.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-white max-w-md mx-auto pointer-events-none z-10">
            <div className="w-16 h-16 rounded-3xl bg-slate-900/80 border border-white/20 flex items-center justify-center text-cyan-300 mb-4 shadow-xl text-3xl backdrop-blur-md">
              🐠
            </div>
            <h3 className="text-xl font-black font-display text-white drop-shadow-md">No Student Fish in This Tank Yet</h3>
            <p className="text-xs text-cyan-100/90 mt-2 leading-relaxed drop-shadow">
              Only students who completed and submitted <span className="text-white font-bold">"{currentQuiz?.title || 'this assessment'}"</span> swim in this coral reef.
            </p>
          </div>
        ) : null}

        {/* ============================================================== */}
        {/* TEACHER SHARK (BIG AND SLOW WITH GUARANTEED CHOMP) */}
        {/* ============================================================== */}
        {shark.enabled && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              triggerSharkHunt();
            }}
            className="absolute pointer-events-auto cursor-pointer group transition-transform duration-75 z-25"
            style={{
              left: `${shark.x}%`,
              top: `${shark.y}%`,
              transform: `translate(-50%, -50%) scaleX(${shark.direction}) scale(2.35)`,
            }}
            title="Click to unleash Big Teacher Shark guaranteed chomp!"
          >
            {/* Humorous Teacher Comic Dialogue Bubble */}
            {shark.quoteTimer > 0 && (
              <div 
                className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap px-3.5 py-1 rounded-full text-[11px] font-black tracking-wide shadow-2xl backdrop-blur-md border-2 border-red-500 bg-red-950/95 text-amber-200 animate-bounce pointer-events-none flex items-center gap-1.5 z-30"
                style={{ transform: `scaleX(${shark.direction}) translate(-50%, 0)` }}
              >
                <span>📢</span>
                <span>{shark.quote}</span>
              </div>
            )}

            {/* Teacher Shark Nametag */}
            <div
              className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-tight shadow-xl backdrop-blur-md border border-slate-700 bg-slate-900/90 text-white pointer-events-none flex items-center gap-1.5"
              style={{ transform: `scaleX(${shark.direction}) translate(-50%, 0)` }}
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>Prof. {profile?.name || 'Educator'} 🦈</span>
              <span className="px-1.5 py-0.2 rounded bg-red-600 text-[8px] text-white">
                {shark.state === 'hunting' ? 'STALKING! (SLOW & STEADY)' : shark.state === 'chomping' ? 'GUARANTEED CHOMP! 🦈' : 'BIG & SLOW PATROL'}
              </span>
            </div>

            {/* GREAT WHITE TEACHER SHARK SVG (BIG & IMPOSING) */}
            <div className="relative w-56 h-32 flex items-center justify-center filter drop-shadow-2xl">
              <svg viewBox="0 0 160 90" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="sharkDorsalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="50%" stopColor="#334155" />
                    <stop offset="100%" stopColor="#475569" />
                  </linearGradient>
                  <linearGradient id="sharkBellyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f8fafc" />
                    <stop offset="100%" stopColor="#cbd5e1" />
                  </linearGradient>
                </defs>

                {/* Powerful Crescent Caudal Shark Tail Fin */}
                <g style={{ transformOrigin: '24px 45px', transform: `rotate(${Math.sin(shark.wigglePhase) * 20}deg)` }}>
                  <path
                    d="M 24 45 C 10 15, -12 2, -4 45 C -12 88, 10 75, 24 45 Z"
                    fill="url(#sharkDorsalGrad)"
                    stroke="#0f172a"
                    strokeWidth="1.2"
                  />
                  <polygon points="-4,45 8,40 8,50" fill="#1e293b" />
                </g>

                {/* Sharp Iconic Dorsal Fin */}
                <path
                  d="M 64 30 Q 76 -4, 96 28 Z"
                  fill="url(#sharkDorsalGrad)"
                  stroke="#0f172a"
                  strokeWidth="1.2"
                />

                {/* Pelvic Fin */}
                <path d="M 50 58 Q 42 74, 58 60 Z" fill="#334155" />

                {/* Main Torpedo Predator Body */}
                <path
                  d="M 22 45 C 35 26, 75 22, 132 38 C 146 42, 156 46, 152 52 C 144 64, 80 72, 22 45 Z"
                  fill="url(#sharkDorsalGrad)"
                  stroke="#0f172a"
                  strokeWidth="1.2"
                />

                {/* Crisp White Shark Belly */}
                <path
                  d="M 28 46 C 45 42, 85 45, 128 47 C 138 52, 142 56, 126 62 C 80 72, 45 60, 28 46 Z"
                  fill="url(#sharkBellyGrad)"
                />

                {/* Razor Sharp Chomping Jaws with White Teeth */}
                <g style={{
                  transformOrigin: '124px 50px',
                  transform: shark.state === 'chomping' ? 'rotate(18deg)' : 'rotate(0deg)',
                  transition: 'transform 0.1s ease'
                }}>
                  <path d="M 124 50 Q 142 48, 148 54 Q 136 60, 124 50 Z" fill="#881337" />
                  <polygon points="126,50 129,53 132,50 135,53 138,50 141,53 144,50" fill="#ffffff" />
                  <polygon points="126,52 129,49 132,52 135,49 138,52 141,49 144,52" fill="#ffffff" />
                </g>

                {/* Gill Slits */}
                <line x1="90" y1="38" x2="88" y2="48" stroke="#0f172a" strokeWidth="1.5" />
                <line x1="94" y1="38" x2="92" y2="48" stroke="#0f172a" strokeWidth="1.5" />
                <line x1="98" y1="38" x2="96" y2="48" stroke="#0f172a" strokeWidth="1.5" />

                {/* Menacing Eye with Eyebrow */}
                <circle cx="132" cy="38" r="4" fill="#0f172a" />
                <circle cx="133.5" cy="37" r="1.5" fill="#facc15" />
                <path d="M 127 34 Q 134 32, 137 36" stroke="#0f172a" strokeWidth="2" fill="none" />

                {/* Pectoral Side Fin with Sweep */}
                <path
                  d="M 96 52 C 92 68, 72 84, 82 86 C 96 82, 114 62, 112 50 Z"
                  fill="#334155"
                  stroke="#0f172a"
                  strokeWidth="1"
                />

                {/* Professor Spectacles perched on snout */}
                <circle cx="134" cy="38" r="5" stroke="#ca8a04" strokeWidth="1.5" fill="none" />
                <line x1="139" y1="38" x2="144" y2="39" stroke="#ca8a04" strokeWidth="1.5" />

                {/* Black Graduation Mortarboard Cap */}
                <g transform="translate(100, 10)">
                  <rect x="14" y="10" width="16" height="8" rx="2" fill="#0f172a" stroke="#ca8a04" strokeWidth="1" />
                  <polygon points="22,0 42,7 22,14 2,7" fill="#090d16" stroke="#ca8a04" strokeWidth="1.2" />
                  <circle cx="22" cy="7" r="2" fill="#facc15" />
                  <path d="M 22 7 Q 34 10, 36 22" stroke="#facc15" strokeWidth="1.5" fill="none" />
                  <circle cx="36" cy="22" r="2" fill="#eab308" />
                </g>
              </svg>

              {/* Embedded Faculty Avatar Badge on Big Shark */}
              <div 
                className="absolute left-[100px] top-[40px] w-9 h-9 rounded-full overflow-hidden border-2 border-yellow-400 shadow-xl bg-slate-900 flex items-center justify-center shrink-0 z-10"
                style={{ transform: `scaleX(${shark.direction})` }}
              >
                {profile?.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={profile?.name || 'Teacher'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-xs font-black text-yellow-300">
                    {(profile?.name || 'T').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SWIMMING LIVING FISH LAYER: QUESTION REEF OR STUDENT SWIMMERS */}
        {/* ============================================================== */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {tankMode === 'questions' ? (
            /* QUESTION FISH MODE: 1 Fish = 1 Question from Selected Assessment */
            filteredQuestionFish.map(qFish => {
              const speciesMeta = SPECIES_METADATA[qFish.species];
              const bobY = Math.cos(qFish.wigglePhase * 0.7) * 3;

              if (qFish.isEaten) {
                return null;
              }

              return (
                <div
                  key={qFish.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedQuestionFish(qFish);
                    if (soundEnabled) playBubbleSound(320);
                  }}
                  className={cn(
                    "absolute pointer-events-auto cursor-pointer group transition-transform duration-75 select-none",
                    qFish.isTerrified && "animate-pulse"
                  )}
                  style={{
                    left: `${qFish.x}%`,
                    top: `${qFish.y + bobY * 0.15}%`,
                    transform: `translate(-50%, -50%) scaleX(${qFish.direction}) scale(${qFish.scale})`,
                    zIndex: 16
                  }}
                  title={`Question ${qFish.index}: Click to inspect question prompt, choices & answer key`}
                >
                  {/* Subtle radiant cyan aura for question fish */}
                  <div 
                    className="absolute -inset-3 rounded-full bg-cyan-400/20 blur-md -z-10 group-hover:bg-cyan-400/40 animate-pulse pointer-events-none"
                    style={{ transform: `scaleX(${qFish.direction})` }}
                  />

                  {/* Protective bubble shield after respawn */}
                  {qFish.shieldTimer > 0 && (
                    <div 
                      className="absolute -inset-3 rounded-full border-2 border-cyan-300/80 bg-cyan-400/20 shadow-lg shadow-cyan-300/40 animate-ping -z-10 pointer-events-none"
                    />
                  )}

                  {/* Panic emote when Big Teacher Shark inspects this question */}
                  {qFish.isTerrified && (
                    <div 
                      className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full font-black shadow-xl border pointer-events-none flex items-center gap-1 z-20 bg-red-600 text-white border-red-300 animate-pulse text-[9px]"
                      style={{ transform: `scaleX(${qFish.direction}) translate(-50%, 0)` }}
                    >
                      <span>🦈</span>
                      <span className="tracking-wide">POP QUIZ DRILL!</span>
                    </div>
                  )}

                  {/* Eating celebration effect */}
                  {qFish.eatingEffectTimer > 0 && !qFish.isTerrified && (
                    <div 
                      className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[10px] font-black text-cyan-200 bg-black/75 px-2 py-0.5 rounded-full border border-cyan-400/50 animate-bounce pointer-events-none"
                      style={{ transform: `scaleX(${qFish.direction})` }}
                    >
                      <span>Reviewed!</span>
                      <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
                    </div>
                  )}

                  {/* Question Fish Nametag with Q#, Snippet & Points */}
                  {showNameTags && (
                    <div
                      className={cn(
                        "absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold tracking-tight shadow-xl backdrop-blur-md border transition-all duration-200 pointer-events-none flex items-center gap-1.5",
                        "bg-slate-900/90 text-white border-cyan-400/70 shadow-cyan-950/60 ring-1 ring-cyan-500/30",
                        "group-hover:scale-110 group-hover:bg-slate-950 group-hover:border-cyan-300 group-hover:ring-2 group-hover:ring-cyan-400/50"
                      )}
                      style={{
                        transform: `scaleX(${qFish.direction}) translate(-50%, 0)`,
                        left: '50%'
                      }}
                    >
                      <span className="px-1.5 py-0.2 rounded font-black text-[9px] bg-cyan-400 text-slate-950 shadow-xs">
                        Q{qFish.index}
                      </span>
                      <span className="truncate max-w-[125px] text-cyan-100 font-sans font-medium">
                        {qFish.titleSnippet}
                      </span>
                      <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/60">
                        {qFish.points} pts
                      </span>
                    </div>
                  )}

                  {/* SVG CREATURE BODY */}
                  <div className="relative w-32 h-20 flex items-center justify-center filter drop-shadow-xl group-hover:brightness-110 transition-all">
                    {renderCreatureSVG(qFish)}

                    {/* Question Number Badge Embedded directly onto Creature */}
                    <div 
                      className="absolute left-[44px] top-[26px] w-6 h-6 rounded-full overflow-hidden border-2 border-white shadow-md bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 z-10 transition-all group-hover:scale-110"
                      style={{ transform: `scaleX(${qFish.direction})` }}
                    >
                      <span className="text-[9px] font-black text-white">
                        Q{qFish.index}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            /* STUDENT FISH MODE: Living fish sized by 4-tier score */
            filteredFish.map(fish => {
              const isOnline = activeUsers.some(u => u.uid === fish.id && u.status !== 'offline');
              const isMuchBigger = fish.percentage >= 90;
              const isMedium = fish.percentage >= 70 && fish.percentage < 90;
              const isSmall = fish.percentage >= 50 && fish.percentage < 70;
              const isLittle = fish.percentage < 50;

              const speciesMeta = SPECIES_METADATA[fish.species];
              const bobY = Math.cos(fish.wigglePhase * 0.7) * 3;
              const tierInfo = getFishTierInfo(fish.percentage);

              if (fish.isEaten) {
                return null;
              }

              return (
                <div
                  key={fish.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFish(fish);
                    if (soundEnabled) playBubbleSound();
                  }}
                  className={cn(
                    "absolute pointer-events-auto cursor-pointer group transition-transform duration-75",
                    fish.isTerrified && "animate-pulse"
                  )}
                  style={{
                    left: `${fish.x}%`,
                    top: `${fish.y + bobY * 0.15}%`,
                    transform: `translate(-50%, -50%) scaleX(${fish.direction}) scale(${fish.scale})`,
                    zIndex: isMuchBigger ? 20 : isMedium ? 15 : isSmall ? 10 : 8
                  }}
                >
                  {/* Golden radiant aura for Much Bigger 90-100% fish */}
                  {isMuchBigger && (
                    <div 
                      className="absolute -inset-4 rounded-full bg-amber-400/25 blur-lg -z-10 animate-pulse pointer-events-none"
                      style={{ transform: `scaleX(${fish.direction})` }}
                    />
                  )}

                  {/* Protective bubble shield after respawn */}
                  {fish.shieldTimer > 0 && (
                    <div 
                      className="absolute -inset-3 rounded-full border-2 border-cyan-300/80 bg-cyan-400/20 shadow-lg shadow-cyan-300/40 animate-ping -z-10 pointer-events-none"
                    />
                  )}

                  {/* Panic emote when Big Teacher Shark stalks */}
                  {fish.isTerrified && (
                    <div 
                      className={cn(
                        "absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full font-black shadow-xl border pointer-events-none flex items-center gap-1 z-20",
                        shark.state === 'hunting' && shark.targetFishId === fish.id
                          ? "bg-red-700 text-yellow-200 border-2 border-yellow-300 animate-bounce text-[10px] shadow-red-950/80"
                          : "bg-red-600/90 text-white border-red-300 animate-pulse text-[9px]"
                      )}
                      style={{ transform: `scaleX(${fish.direction}) translate(-50%, 0)` }}
                    >
                      <span>😱</span>
                      <span className="tracking-wide">
                        {shark.state === 'hunting' && shark.targetFishId === fish.id
                          ? "STALKED BY SHARK!"
                          : "SCATTER!"}
                      </span>
                    </div>
                  )}

                  {/* Eating celebration effect */}
                  {fish.eatingEffectTimer > 0 && !fish.isTerrified && (
                    <div 
                      className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[10px] font-black text-amber-300 bg-black/70 px-2 py-0.5 rounded-full border border-amber-400/50 animate-bounce pointer-events-none"
                      style={{ transform: `scaleX(${fish.direction})` }}
                    >
                      <span>Yum!</span>
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                    </div>
                  )}

                  {/* Student Fish Nametag & Size Tag */}
                  {showNameTags && (
                    <div
                      className={cn(
                        "absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold tracking-tight shadow-xl backdrop-blur-md border transition-all duration-200 pointer-events-none flex items-center gap-1.5",
                        fish.isTerrified
                          ? "bg-red-950/90 text-white border-red-500 shadow-red-900/50"
                          : isMuchBigger
                          ? "bg-amber-950/90 text-amber-200 border-amber-400 shadow-amber-900/50 ring-1 ring-amber-400/50" 
                          : isMedium
                          ? "bg-emerald-950/85 text-emerald-200 border-emerald-500/60 shadow-emerald-900/40"
                          : isSmall
                          ? "bg-sky-950/85 text-sky-200 border-sky-500/60 shadow-sky-900/40"
                          : "bg-rose-950/85 text-rose-200 border-rose-500/60 shadow-rose-900/40",
                        "group-hover:scale-110 group-hover:bg-black/90"
                      )}
                      style={{
                        transform: `scaleX(${fish.direction}) translate(-50%, 0)`,
                        left: '50%'
                      }}
                    >
                      <span>{speciesMeta.emoji}</span>
                      {isOnline && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Online now" />
                      )}
                      <span className="truncate max-w-[105px] text-white font-bold">{fish.name}</span>
                      <span className={cn(
                        "font-black px-1.5 py-0.2 rounded-md text-[9px]",
                        tierInfo.badgeBg
                      )}>
                        {fish.percentage}% ({tierInfo.scaleDescription})
                      </span>
                    </div>
                  )}

                  {/* SVG CREATURE BODY */}
                  <div className="relative w-32 h-20 flex items-center justify-center filter drop-shadow-xl">
                    {renderCreatureSVG(fish)}

                    {/* Student Avatar Embedded directly onto Creature */}
                    <div 
                      className="absolute left-[44px] top-[26px] w-6 h-6 rounded-full overflow-hidden border-2 border-white/95 bg-slate-900 shadow-md flex items-center justify-center shrink-0 z-10 transition-all"
                      style={{ transform: `scaleX(${fish.direction})` }}
                    >
                      {fish.photoURL ? (
                        <img
                          src={fish.photoURL}
                          alt={fish.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-[9px] font-black text-white">
                          {fish.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Ambient Reef Seabed Floor Label */}
        <div className="absolute bottom-1.5 inset-x-8 z-10 pointer-events-none flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/50 select-none drop-shadow">
          {tankMode === 'questions' ? (
            <>
              <span className="flex items-center gap-1">❓ Question Reef • Click Any Fish to View Question</span>
              <span className="hidden md:inline text-white/30">• • • Vibrant Interactive Curriculum Habitat • • •</span>
              <span className="flex items-center gap-1">1 Fish = 1 Question 🌊</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1">🐠 Living Reef Sanctuary</span>
              <span className="hidden md:inline text-white/30">• • • Vibrant Coral Habitat • • •</span>
              <span className="flex items-center gap-1">Scale By Grade (0.65x → 2.2x) 🌊</span>
            </>
          )}
        </div>

        {/* ============================================================== */}
        {/* INTERACTIVE FLOATING TOOLBAR DOCK */}
        {/* ============================================================== */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <div className="bg-[#0b1c2d]/90 backdrop-blur-md border border-white/20 text-white rounded-full p-1.5 shadow-2xl flex items-center gap-1 sm:gap-2">
            {/* Feed & Grow Button */}
            <button
              onClick={handleFeedAndGrow}
              className="bg-[#00b4d8] hover:bg-[#38bdf8] active:scale-95 text-slate-950 font-black px-4 py-2 rounded-full shadow-lg transition-all flex items-center gap-2 text-xs"
              title="Feed flakes to grow student fish"
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Feed & Grow</span>
            </button>

            {/* Teacher Shark Button (Big & Slow Bully with Guaranteed Chomp) */}
            <button
              onClick={triggerMinuteSharkFeast}
              className={cn(
                "active:scale-95 px-3.5 py-2 rounded-full text-xs font-black transition-all flex items-center gap-1.5 shadow-md",
                shark.state === 'hunting'
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white"
              )}
              title="Send Big Teacher Shark for a guaranteed chomp!"
            >
              <span>🦈</span>
              <span>{shark.state === 'hunting' ? 'Big Shark Stalking!' : `Big Shark Chomp (${minuteFeastCountdown}s)`}</span>
            </button>

            {/* Tap Glass Button */}
            <button
              onClick={handleTapGlass}
              className="hover:bg-white/10 active:scale-95 px-3 py-2 rounded-full text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
              title="Tap the aquarium glass"
            >
              <Hand className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tap Glass</span>
            </button>

            {/* Sunbeam Button */}
            <button
              onClick={() => setShowSunbeams(prev => !prev)}
              className={cn(
                "active:scale-95 px-3 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                showSunbeams 
                  ? "bg-slate-800/90 text-amber-300 border border-amber-400/40 shadow-xs" 
                  : "hover:bg-white/10 text-slate-300"
              )}
              title="Toggle radiant sunbeam illumination"
            >
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Sunbeam</span>
            </button>

            {/* Squeegee Clean Glass Button */}
            <button
              onClick={handleSqueegee}
              className={cn(
                "hover:bg-white/10 active:scale-95 px-3 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                isSqueegeeActive ? "bg-cyan-500/20 text-cyan-300" : "text-slate-200"
              )}
              title="Wipe aquarium glass sparkling clean"
            >
              <Eraser className="w-3.5 h-3.5 text-cyan-300" />
              <span>Squeegee</span>
            </button>

            {/* Inspect Fish Toggle */}
            <button
              onClick={() => setShowNameTags(prev => !prev)}
              className={cn(
                "active:scale-95 px-3 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                showNameTags 
                  ? "bg-slate-800/90 text-white border border-white/20 shadow-xs" 
                  : "hover:bg-white/10 text-slate-400"
              )}
              title="Toggle student nametags and score tags"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect Fish</span>
            </button>

            {/* Settings & Tuning Slider */}
            <button
              onClick={() => setShowSettingsDrawer(prev => !prev)}
              className={cn(
                "p-2 rounded-full hover:bg-white/15 transition-all text-slate-300 active:scale-95",
                showSettingsDrawer && "bg-white/20 text-white"
              )}
              title="Aquarium Settings & Acceleration"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Floating Quick Controls Bar */}
        <div className="absolute top-4 right-4 z-20 pointer-events-auto flex items-center gap-2">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(prev => !prev)}
            className={cn(
              "p-2 rounded-xl backdrop-blur-md transition-all border shadow-lg",
              soundEnabled 
                ? "bg-slate-900/80 text-cyan-300 border-white/20" 
                : "bg-slate-900/60 text-slate-400 border-white/10 hover:text-white"
            )}
            title={soundEnabled ? "Mute Sound" : "Enable Sound"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleTankFullscreen}
            className="p-2 rounded-xl bg-slate-900/80 backdrop-blur-md text-slate-300 hover:text-white transition-all border border-white/20 shadow-lg"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Projector Mode"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Settings Popover Drawer */}
        <AnimatePresence>
          {showSettingsDrawer && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 w-80 bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-3xl p-5 shadow-2xl z-30 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  Speed & Acceleration
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {speedMultiplier.toFixed(1)}x
                </span>
              </div>

              {/* Speed Slider */}
              <div>
                <input
                  type="range"
                  min="0.3"
                  max="3.0"
                  step="0.1"
                  value={speedMultiplier}
                  onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
                <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-bold">
                  <span>0.3x (Relaxed)</span>
                  <span>1.0x (Normal)</span>
                  <span>3.0x (Turbo)</span>
                </div>
              </div>

              {/* Teacher Shark Toggle */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-white/10 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white text-xs flex items-center gap-1">
                    <span>🦈</span> Big Teacher Shark
                  </p>
                  <p className="text-[10px] text-slate-400">Patrols slowly with guaranteed chomp</p>
                </div>
                <button
                  onClick={() => setShark(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={cn(
                    "px-3 py-1 rounded-xl font-bold text-xs transition-all border",
                    shark.enabled ? "bg-red-500 text-white border-red-400" : "bg-slate-700 text-slate-400 border-transparent"
                  )}
                >
                  {shark.enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Filter by Grade Tier */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Filter by Size Bracket
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'all', label: 'All Fish' },
                    { id: 'giant', label: '90-100% (2.2x)' },
                    { id: 'medium', label: '70-89% (1.45x)' },
                    { id: 'small', label: '50-69% (1.0x)' },
                    { id: 'little', label: '<50% (0.65x)' },
                    { id: 'online', label: 'Online' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setFilterTier(t.id as any)}
                      className={cn(
                        "py-1 rounded-lg text-[10px] font-bold border transition-all",
                        filterTier === t.id ? "bg-cyan-500 text-white border-cyan-400" : "bg-slate-800 text-slate-300 border-white/5"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Surge Burst */}
              <button
                onClick={() => {
                  setIsAccelerationBurst(true);
                  if (soundEnabled) playBubbleSound(250);
                  setTimeout(() => setIsAccelerationBurst(false), 2800);
                }}
                className="w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 fill-black" />
                Trigger Current Surge
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ============================================================== */}
      {/* QUESTION INSPECTION MODAL (Clicking any question fish opens this) */}
      {/* ============================================================== */}
      <AnimatePresence>
        {selectedQuestionFish && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border-2 border-cyan-500/40 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Cyan Gradient Header Glow Strip */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500" />

              {/* Top Bar */}
              <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-black text-sm">
                    Q{selectedQuestionFish.index}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        Question {selectedQuestionFish.index} of {questionFishList.length}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {selectedQuestionFish.type === 'multiple-choice' ? 'Multiple Choice' :
                         selectedQuestionFish.type === 'true-false' ? 'True / False' : 'Short Answer'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                        {selectedQuestionFish.points} Points
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span>{SPECIES_METADATA[selectedQuestionFish.species].emoji}</span>
                      <span>{SPECIES_METADATA[selectedQuestionFish.species].name}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedQuestionFish(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Close Question Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
                {/* Question Prompt */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Question Prompt
                  </span>
                  <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
                    {selectedQuestionFish.questionText}
                  </p>

                  {selectedQuestionFish.imageUrl && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-60">
                      <img 
                        src={selectedQuestionFish.imageUrl} 
                        alt="Question Reference" 
                        className="w-full h-full object-contain bg-black/5" 
                      />
                    </div>
                  )}
                </div>

                {/* Answer Options & Letter Toggle */}
                <div>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-500" />
                      Answer Choices
                    </span>

                    {/* Toggle that shows the letter of the answer */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowAnswerLetter(prev => !prev);
                        if (soundEnabled) playBubbleSound(showAnswerLetter ? 260 : 380);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer select-none active:scale-95",
                        showAnswerLetter
                          ? "bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400 shadow-amber-500/20"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                      )}
                      title={showAnswerLetter ? "Hide the answer letter" : "Show only the letter of the answer"}
                    >
                      {showAnswerLetter ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Hide Answer Letter</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          <span>Show Answer Letter</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* If toggle is active, show only the letter of the answer */}
                  {showAnswerLetter && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-3 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                          Answer Letter:
                        </span>
                        <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-xs">
                          {getQuestionAnswerLetter(selectedQuestionFish)}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        Letter Only
                      </span>
                    </motion.div>
                  )}

                  {selectedQuestionFish.options.length > 0 ? (
                    <div className="space-y-2">
                      {selectedQuestionFish.options.map((opt, oIdx) => {
                        const optLetter = String.fromCharCode(65 + oIdx);
                        const isTargetLetter = showAnswerLetter && (optLetter === getQuestionAnswerLetter(selectedQuestionFish));

                        return (
                          <div
                            key={oIdx}
                            className={cn(
                              "p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3",
                              isTargetLetter
                                ? "bg-amber-50/90 dark:bg-amber-950/30 border-2 border-amber-500 dark:border-amber-500/80 shadow-xs"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={cn(
                                "w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center shrink-0 border transition-all",
                                isTargetLetter
                                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-xs"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                              )}>
                                {optLetter}
                              </span>
                              <span className={cn(
                                "text-sm font-medium",
                                isTargetLetter ? "font-bold text-slate-900 dark:text-white" : "text-slate-800 dark:text-slate-200"
                              )}>
                                {opt}
                              </span>
                            </div>

                            {isTargetLetter && (
                              <span className="text-xs font-black text-amber-600 dark:text-amber-400 shrink-0">
                                Letter {optLetter}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Open-Ended / Short Answer display */
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Open-ended / Short Answer Question
                      </p>
                      {showAnswerLetter ? (
                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                          Expected Answer: {selectedQuestionFish.correctAnswer}
                        </p>
                      ) : (
                        <p className="text-xs italic text-slate-400">
                          Student writes in free-form response.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer with Cycle Controls & Question Direct Jump */}
              <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-[260px] sm:max-w-xs py-1">
                  {questionFishList.map(q => (
                    <button
                      key={q.id}
                      onClick={() => {
                        setSelectedQuestionFish(q);
                        if (soundEnabled) playBubbleSound(360);
                      }}
                      className={cn(
                        "w-7 h-7 rounded-lg text-[10px] font-black transition-all shrink-0 border",
                        selectedQuestionFish.id === q.id
                          ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm scale-105"
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-cyan-400"
                      )}
                      title={`Jump to Question ${q.index}`}
                    >
                      {q.index}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const curIdx = selectedQuestionFish.index - 1;
                      const prevIdx = (curIdx - 1 + questionFishList.length) % questionFishList.length;
                      setSelectedQuestionFish(questionFishList[prevIdx]);
                      if (soundEnabled) playBubbleSound(280);
                    }}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Previous Question"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      const curIdx = selectedQuestionFish.index - 1;
                      const nextIdx = (curIdx + 1) % questionFishList.length;
                      setSelectedQuestionFish(questionFishList[nextIdx]);
                      if (soundEnabled) playBubbleSound(350);
                    }}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Next Question"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setSelectedQuestionFish(null)}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95 ml-1"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* STUDENT INSPECTION MODAL */}
      <AnimatePresence>
        {selectedFish && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden"
            >
              <div className={cn(
                "absolute top-0 left-0 right-0 h-2",
                selectedFish.percentage >= 90 ? "bg-gradient-to-r from-amber-400 to-yellow-500" :
                selectedFish.percentage >= 70 ? "bg-gradient-to-r from-emerald-400 to-teal-500" :
                selectedFish.percentage >= 50 ? "bg-gradient-to-r from-sky-400 to-blue-600" :
                "bg-gradient-to-r from-rose-400 to-red-500"
              )} />

              <button
                onClick={() => setSelectedFish(null)}
                className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-start gap-4 mb-6">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden ring-4 ring-cyan-500/20 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    {selectedFish.photoURL ? (
                      <img 
                        src={selectedFish.photoURL} 
                        alt={selectedFish.name} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {selectedFish.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {activeUsers.some(u => u.uid === selectedFish.id && u.status !== 'offline') && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full flex items-center justify-center shadow-xs" title="Online now">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white truncate">
                      {selectedFish.name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                      <span>{SPECIES_METADATA[selectedFish.species].emoji}</span>
                      <span>{SPECIES_METADATA[selectedFish.species].name}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono">
                    {selectedFish.email}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    Submitted: {new Date(selectedFish.submittedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Assessment Performance Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Score Earned</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                    {selectedFish.score} <span className="text-xs font-medium text-slate-400">/ {selectedFish.totalPoints}</span>
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Percentage</p>
                  <p className={cn(
                    "text-xl font-black mt-0.5",
                    selectedFish.percentage >= 90 ? "text-amber-500" :
                    selectedFish.percentage >= 70 ? "text-emerald-500" :
                    selectedFish.percentage >= 50 ? "text-sky-500" : "text-rose-500"
                  )}>
                    {selectedFish.percentage}%
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fish Size</p>
                  <p className="text-xl font-black text-cyan-600 dark:text-cyan-400 mt-0.5">
                    {getFishTierInfo(selectedFish.percentage).scaleDescription}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Time Taken</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                    {selectedFish.timeTaken ? `${Math.round(selectedFish.timeTaken / 60)}m` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Anti-cheat status */}
              <div className={cn(
                "p-3 rounded-xl border flex items-center gap-2.5 text-xs font-medium mb-6",
                selectedFish.antiCheatTriggered || (selectedFish.breachCount && selectedFish.breachCount > 0)
                  ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300"
                  : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300"
              )}>
                {selectedFish.antiCheatTriggered || (selectedFish.breachCount && selectedFish.breachCount > 0) ? (
                  <>
                    <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                    <span>Anti-cheat flagged: {selectedFish.breachCount || 1} tab switch / window blur incidents detected.</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Integrity verified: Clean assessment session with 0 tab violations.</span>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setSelectedFish(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
                <Link
                  to={`/teacher/quiz/${selectedQuizId}`}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 active:scale-95 flex items-center gap-1.5"
                >
                  Inspect Full Responses
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Embedded CSS animations */}
      <style>{`
        @keyframes bubbleFloat {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0.15;
          }
          50% {
            transform: translateY(-320px) translateX(10px);
            opacity: 0.75;
          }
          100% {
            transform: translateY(-750px) translateX(-6px);
            opacity: 0;
          }
        }
        @keyframes glassRipple {
          0% {
            width: 0px;
            height: 0px;
            opacity: 0.8;
          }
          100% {
            width: 260px;
            height: 260px;
            opacity: 0;
          }
        }
        @keyframes squeegeeWipe {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(1200%);
          }
        }
        .animate-glass-ripple {
          animation: glassRipple 0.8s ease-out forwards;
        }
        .animate-squeegee-wipe {
          animation: squeegeeWipe 2.2s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
}
