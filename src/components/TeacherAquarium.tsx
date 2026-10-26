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
  SlidersHorizontal,
  Utensils,
  Eraser,
  Flame,
  AlertTriangle
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
  "Zero extra credit for you! 😈",
  "No copying in my tank! 🚫",
  "Burp! Needs improvement! 💨",
  "Delicious... but study harder next time! 🦈",
  "Back to Chapter 1 with you!",
  "Class average must go up! CHOMP!"
];

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

  // Shark bullying & eating state
  isTerrified: boolean;
  isEaten: boolean;
  respawnTimer: number; // counts down when eaten
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
  } else if (percentage >= 75) {
    const pool: AquaticSpecies[] = ['bluetang', 'yellowtang', 'anthias', 'goldfish', 'mantaray'];
    return pool[hash % pool.length];
  } else if (percentage >= 50) {
    const pool: AquaticSpecies[] = ['clownfish', 'bluetang', 'anthias', 'turtle', 'pufferfish'];
    return pool[hash % pool.length];
  } else {
    const pool: AquaticSpecies[] = ['clownfish', 'pufferfish', 'anthias', 'goldfish'];
    return pool[hash % pool.length];
  }
}

function calculateScoreScale(percentage: number): number {
  const ratio = Math.max(0, Math.min(1, percentage / 100));
  return Number((0.55 + ratio * 0.90).toFixed(2));
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

  // Speed & Settings
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [isAccelerationBurst, setIsAccelerationBurst] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [filterTier, setFilterTier] = useState<'all' | '90+' | '75-89' | '50-74' | '<50' | 'online'>('all');
  const [filterSpecies, setFilterSpecies] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Animated Entities
  const [fishList, setFishList] = useState<FishEntity[]>([]);
  const [foodFlakes, setFoodFlakes] = useState<FoodFlake[]>([]);
  const tankContainerRef = useRef<HTMLDivElement>(null);

  // TEACHER SHARK ENTITY (The Bully Teacher Predator)
  const [shark, setShark] = useState<TeacherSharkEntity>({
    x: 25,
    y: 35,
    vx: 0.32,
    vy: 0.04,
    targetVx: 0.32,
    targetVy: 0.04,
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
    huntCooldown: 120
  });

  const speedRef = useRef({ multiplier: 1.0, burst: false });
  useEffect(() => {
    speedRef.current = { multiplier: speedMultiplier, burst: isAccelerationBurst };
  }, [speedMultiplier, isAccelerationBurst]);

  // 1. Parse quizId from query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qId = params.get('quizId');
    if (qId) {
      setSelectedQuizId(qId);
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

  // 4. Initialize Fish Entities
  useEffect(() => {
    if (submissions.length === 0) {
      setFishList([]);
      return;
    }

    const newFish: FishEntity[] = submissions.map((sub, index) => {
      const percentage = Math.round((sub.score / Math.max(sub.totalPoints, 1)) * 100);
      const species = determineSpecies(percentage, sub.studentId);
      const scale = calculateScoreScale(percentage);

      const x = 12 + (index * 16) % 76 + Math.random() * 4;
      const y = 20 + (index * 22) % 52 + Math.random() * 4;
      const initialDir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
      
      let baseSpeed = 0.26;
      if (species === 'turtle') baseSpeed = 0.18;
      else if (species === 'mantaray') baseSpeed = 0.22;
      else if (species === 'yellowtang' || species === 'bluetang') baseSpeed = 0.29;
      else if (species === 'moorishidol') baseSpeed = 0.27;
      else if (species === 'anthias') baseSpeed = 0.28;
      else if (species === 'pufferfish') baseSpeed = 0.20;

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
        wiggleSpeed: species === 'turtle' ? 0.08 : 0.17,
        eatingEffectTimer: 0,
        isTerrified: false,
        isEaten: false,
        respawnTimer: 0
      };
    });

    setFishList(newFish);
  }, [submissions, studentsProfileMap]);

  // 5. Physics Animation Loop with TEACHER SHARK HUNTING & EATING PHYSICS
  useEffect(() => {
    let animId: number;

    const updatePhysics = () => {
      const { multiplier, burst } = speedRef.current;
      const effectiveSpeedMultiplier = multiplier * (burst ? 2.2 : 1.0);
      const accelFactor = 0.06 * effectiveSpeedMultiplier;

      // UPDATE TEACHER SHARK
      setShark(prevShark => {
        if (!prevShark.enabled) return prevShark;

        let { 
          x, y, vx, vy, targetVx, targetVy, direction, 
          state, targetFishId, targetFishName, chompTimer, 
          quote, quoteTimer, eatenCount, wigglePhase, huntCooldown 
        } = prevShark;

        wigglePhase += 0.22 * effectiveSpeedMultiplier;

        if (quoteTimer > 0) {
          quoteTimer -= 1;
        }

        if (chompTimer > 0) {
          chompTimer -= 1;
          if (chompTimer === 0) {
            state = 'patrolling';
            huntCooldown = 140; // cool down before next target
          }
        }

        // FIND ACTIVE TARGET FISH (if hunting)
        let targetFish: FishEntity | undefined;
        if (state === 'hunting' && targetFishId) {
          targetFish = fishList.find(f => f.id === targetFishId && !f.isEaten);
          if (!targetFish) {
            // Target was eaten or lost, revert to patrol
            state = 'patrolling';
            targetFishId = null;
          }
        }

        // DECIDE TO HUNT A STUDENT FISH
        if (state === 'patrolling') {
          if (huntCooldown > 0) {
            huntCooldown -= 1;
          } else if (fishList.length > 0 && Math.random() < 0.02) {
            // Pick a student fish to bully and hunt!
            const availableFish = fishList.filter(f => !f.isEaten);
            if (availableFish.length > 0) {
              // Prefer lowest scoring fish or random student to bully!
              const chosen = availableFish[Math.floor(Math.random() * availableFish.length)];
              state = 'hunting';
              targetFishId = chosen.id;
              targetFishName = chosen.name;
              quote = SHARK_ACADEMIC_QUOTES[Math.floor(Math.random() * SHARK_ACADEMIC_QUOTES.length)];
              quoteTimer = 160;
              targetFish = chosen;
            }
          }
        }

        // SHARK BEHAVIOR & MOVEMENT
        if (state === 'hunting' && targetFish) {
          // Relentlessly chase target student fish!
          const dx = targetFish.x - x;
          const dy = targetFish.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const chaseSpeed = 0.52 * effectiveSpeedMultiplier;
          if (dist > 0.5) {
            targetVx = (dx / dist) * chaseSpeed;
            targetVy = (dy / dist) * chaseSpeed;
            direction = dx > 0 ? 1 : -1;
          }

          // CHOMP STUDENT FISH!
          if (dist < 4.8) {
            state = 'chomping';
            chompTimer = 55;
            eatenCount += 1;
            quote = `CHOMP! 📚 Study harder, ${targetFish.name}!`;
            quoteTimer = 180;
            if (soundEnabled) {
              playChompSound();
            }

            // Mark target student fish as eaten
            setFishList(prevFishes => prevFishes.map(f => {
              if (f.id === targetFish!.id) {
                return {
                  ...f,
                  isEaten: true,
                  respawnTimer: 240, // 4 seconds in shark belly before respawn
                  isTerrified: false
                };
              }
              return f;
            }));
          }
        } else {
          // Patrol smoothly across the coral reef
          if (Math.random() < 0.015) {
            targetVy = (Math.random() - 0.5) * 0.22;
          }

          const patrolSpeed = 0.32 * effectiveSpeedMultiplier;
          if (x <= 10) {
            targetVx = patrolSpeed;
            direction = 1;
          } else if (x >= 88) {
            targetVx = -patrolSpeed;
            direction = -1;
          }

          if (y <= 16) targetVy = 0.15;
          if (y >= 74) targetVy = -0.15;
        }

        // Smooth acceleration
        vx += (targetVx - vx) * accelFactor;
        vy += (targetVy - vy) * accelFactor;

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
          huntCooldown
        };
      });

      // UPDATE STUDENT FISH
      setFishList(prevFish => {
        if (prevFish.length === 0) return prevFish;

        return prevFish.map(fish => {
          let { x, y, vx, vy, targetVx, targetVy, direction, wigglePhase, eatingEffectTimer, baseSpeed, isEaten, respawnTimer, isTerrified } = fish;

          // HANDLE EATEN & RESPAWNING
          if (isEaten) {
            if (respawnTimer > 0) {
              respawnTimer -= 1;
              if (respawnTimer === 0) {
                // Respawn from the coral reef with a protective bubble shield!
                isEaten = false;
                x = 15 + Math.random() * 70;
                y = 65; // bottom coral bed
                eatingEffectTimer = 60; // happy respawn celebration
                if (soundEnabled) {
                  playBubbleSound(200);
                }
              }
            }
            return { ...fish, respawnTimer, isEaten };
          }

          // CHECK PROXIMITY TO TEACHER SHARK (BULLY EVASION!)
          const sX = shark.x;
          const sY = shark.y;
          const distToShark = Math.sqrt((sX - x) * (sX - x) + (sY - y) * (sY - y));

          // If shark is hunting this fish or comes very close, panic and evade!
          const isTargeted = shark.state === 'hunting' && shark.targetFishId === fish.id;
          if (distToShark < 18 || isTargeted) {
            isTerrified = true;
            // Flee away from shark with frantic burst speed
            const fleeDx = x - sX;
            const fleeDy = y - sY;
            const fleeDist = Math.max(0.1, Math.sqrt(fleeDx * fleeDx + fleeDy * fleeDy));
            const fleeSpeed = baseSpeed * 2.6;
            targetVx = (fleeDx / fleeDist) * fleeSpeed;
            targetVy = (fleeDy / fleeDist) * fleeSpeed;
            direction = fleeDx > 0 ? 1 : -1;
            wigglePhase += 0.35 * effectiveSpeedMultiplier; // frantic flutter!
          } else {
            isTerrified = false;

            // Check if there are food flakes to seek
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
                  playBubbleSound(100);
                }
              }
            } else {
              if (Math.random() < 0.015) {
                targetVy = (Math.random() - 0.5) * 0.25;
              }

              const minX = 6;
              const maxX = 90;
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
            respawnTimer
          };
        });
      });

      // Update food flakes sinking
      setFoodFlakes(prev => {
        if (prev.length === 0) return prev;
        return prev
          .map(f => ({ ...f, y: f.y + f.vy * effectiveSpeedMultiplier }))
          .filter(f => f.y < 78);
      });

      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animId);
  }, [foodFlakes, soundEnabled, shark.enabled, shark.state, shark.targetFishId, shark.x, shark.y, fishList]);

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
  };

  // Unleash / Direct Teacher Shark Hunt
  const triggerSharkHunt = () => {
    const availableFish = fishList.filter(f => !f.isEaten);
    if (availableFish.length === 0) return;
    const target = availableFish[Math.floor(Math.random() * availableFish.length)];
    setShark(prev => ({
      ...prev,
      enabled: true,
      state: 'hunting',
      targetFishId: target.id,
      targetFishName: target.name,
      quote: `POP QUIZ, ${target.name.toUpperCase()}! 🦈`,
      quoteTimer: 180,
      huntCooldown: 120
    }));
    if (soundEnabled) {
      playChompSound();
    }
  };

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
      if (filterTier === '90+') return fish.percentage >= 90;
      if (filterTier === '75-89') return fish.percentage >= 75 && fish.percentage < 90;
      if (filterTier === '50-74') return fish.percentage >= 50 && fish.percentage < 75;
      if (filterTier === '<50') return fish.percentage < 50;
      if (filterTier === 'online') {
        return activeUsers.some(u => u.uid === fish.id && u.status !== 'offline');
      }
      return true;
    });
  }, [fishList, searchTerm, filterTier, filterSpecies, activeUsers]);

  const currentQuiz = quizzes.find(q => q.id === selectedQuizId);

  const stats = useMemo(() => {
    if (submissions.length === 0) {
      return { count: 0, avg: 0, high: 0, low: 0 };
    }
    const scores = submissions.map(s => Math.round((s.score / Math.max(s.totalPoints, 1)) * 100));
    const count = scores.length;
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / count);
    const high = Math.max(...scores);
    const low = Math.min(...scores);
    return { count, avg, high, low };
  }, [submissions]);

  // Render Species-Specific SVG Creature
  const renderCreatureSVG = (fish: FishEntity) => {
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
            Students swim as tropical reef creatures. <span className="font-bold text-cyan-600 dark:text-cyan-400">Scale represents their score.</span> Watch out for the Teacher Shark patrolling and bullying the tank!
          </p>
        </div>

        {/* Assessment Selector Dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] sm:min-w-[320px]">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
              Select Assessment (Only Takers Swim)
            </label>
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
            className="self-end p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all shadow-sm active:scale-95"
            title="Refresh Tank Submissions"
          >
            <RefreshCw className={cn("w-4 h-4", loadingSubmissions && "animate-spin text-cyan-500")} />
          </button>
        </div>
      </div>

      {/* Assessment Summary Badges */}
      {currentQuiz && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-100 dark:border-cyan-900 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
              <Fish className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Swimmers</p>
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

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Top Grade</p>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">{stats.high}%</p>
            </div>
          </div>

          {/* Teacher Shark Status */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 flex items-center justify-center text-2xl shrink-0">
              🦈
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fish Chomped</p>
              <p className="text-xl font-black text-red-600 dark:text-red-400 leading-none mt-0.5">{shark.eatenCount}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-900 flex items-center justify-center text-2xl shrink-0">
              🐢
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reef Turtles</p>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5">
                {fishList.filter(f => f.species === 'turtle').length}
              </p>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Scale className="w-3 h-3 text-cyan-500" /> Score Scale
            </p>
            <div className="flex items-center justify-between text-[11px] font-black text-slate-700 dark:text-slate-200 mt-1">
              <span>0% (0.55x)</span>
              <span>→</span>
              <span className="text-amber-500 font-black">100% (1.45x)</span>
            </div>
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
        {/* Soft Volumetric Radiant Sunbeams */}
        {showSunbeams && (
          <div 
            className="absolute inset-0 pointer-events-none mix-blend-screen transition-opacity duration-700"
            style={{
              background: 'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.45) 0%, rgba(56, 189, 248, 0.25) 45%, transparent 75%)'
            }}
          />
        )}

        {/* Dual Vertical Bubble Aeration Columns */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Left Bubble Column */}
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={`left-col-${i}`}
              className="absolute rounded-full border border-white/70 shadow-xs"
              style={{
                left: `${9 + (Math.sin(i * 1.3) * 3)}%`,
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
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={`right-col-${i}`}
              className="absolute rounded-full border border-white/70 shadow-xs"
              style={{
                left: `${87 + (Math.cos(i * 1.3) * 3)}%`,
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

          {/* Gentle ambient center bubbles */}
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
        {/* TEACHER SHARK (THE BULLY EDUCATOR PREDATOR) */}
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
              transform: `translate(-50%, -50%) scaleX(${shark.direction}) scale(1.35)`,
            }}
            title="Click to unleash Teacher Shark hunt!"
          >
            {/* Humorous Teacher Comic Dialogue Bubble */}
            {shark.quoteTimer > 0 && (
              <div 
                className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-black tracking-wide shadow-2xl backdrop-blur-md border border-red-500/80 bg-red-950/90 text-amber-200 animate-bounce pointer-events-none flex items-center gap-1.5 z-30"
                style={{ transform: `scaleX(${shark.direction}) translate(-50%, 0)` }}
              >
                <span>📢</span>
                <span>{shark.quote}</span>
              </div>
            )}

            {/* Teacher Shark Nametag with Bully Badge */}
            <div
              className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-tight shadow-xl backdrop-blur-md border border-slate-700 bg-slate-900/90 text-white pointer-events-none flex items-center gap-1.5"
              style={{ transform: `scaleX(${shark.direction}) translate(-50%, 0)` }}
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>Prof. {profile?.name || 'Educator'} 🦈</span>
              <span className="px-1.5 py-0.2 rounded bg-red-600 text-[9px] text-white">
                {shark.state === 'hunting' ? 'HUNTING!' : shark.state === 'chomping' ? 'CHOMP!' : 'PATROL'}
              </span>
            </div>

            {/* GREAT WHITE TEACHER SHARK SVG */}
            <div className="relative w-40 h-24 flex items-center justify-center filter drop-shadow-2xl">
              <svg viewBox="0 0 160 90" className="w-full h-full overflow-visible">
                <defs>
                  {/* Shark Dorsal Slate Gradient */}
                  <linearGradient id="sharkDorsalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="50%" stopColor="#334155" />
                    <stop offset="100%" stopColor="#475569" />
                  </linearGradient>
                  {/* Shark Belly White Gradient */}
                  <linearGradient id="sharkBellyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f8fafc" />
                    <stop offset="100%" stopColor="#cbd5e1" />
                  </linearGradient>
                </defs>

                {/* Powerful Crescent Caudal Shark Tail Fin */}
                <g style={{ transformOrigin: '24px 45px', transform: `rotate(${Math.sin(shark.wigglePhase) * 22}deg)` }}>
                  <path
                    d="M 24 45 C 10 15, -12 2, -4 45 C -12 88, 10 75, 24 45 Z"
                    fill="url(#sharkDorsalGrad)"
                    stroke="#0f172a"
                    strokeWidth="1.2"
                  />
                  {/* Tail notch */}
                  <polygon points="-4,45 8,40 8,50" fill="#1e293b" />
                </g>

                {/* Sharp Iconic Dorsal Fin (Cutting through water) */}
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
                  {/* Open Mouth Gullet */}
                  <path d="M 124 50 Q 142 48, 148 54 Q 136 60, 124 50 Z" fill="#881337" />
                  {/* Upper Row of Sharp Triangular Teeth */}
                  <polygon points="126,50 129,53 132,50 135,53 138,50 141,53 144,50" fill="#ffffff" />
                  {/* Lower Row of Sharp Teeth */}
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

                {/* ======================================================= */}
                {/* TEACHER ACADEMIC ACCESSORIES (MORTARBOARD & GLASSES) */}
                {/* ======================================================= */}
                {/* Professor Spectacles perched on snout */}
                <circle cx="134" cy="38" r="5" stroke="#ca8a04" strokeWidth="1.5" fill="none" />
                <line x1="139" y1="38" x2="144" y2="39" stroke="#ca8a04" strokeWidth="1.5" />

                {/* Black Graduation Mortarboard Cap */}
                <g transform="translate(100, 10)">
                  {/* Skull cap */}
                  <rect x="14" y="10" width="16" height="8" rx="2" fill="#0f172a" stroke="#ca8a04" strokeWidth="1" />
                  {/* Diamond Mortarboard top */}
                  <polygon points="22,0 42,7 22,14 2,7" fill="#090d16" stroke="#ca8a04" strokeWidth="1.2" />
                  {/* Center gold button */}
                  <circle cx="22" cy="7" r="2" fill="#facc15" />
                  {/* Swaying Golden Tassel */}
                  <path d="M 22 7 Q 34 10, 36 22" stroke="#facc15" strokeWidth="1.5" fill="none" />
                  <circle cx="36" cy="22" r="2" fill="#eab308" />
                </g>
              </svg>

              {/* Embedded Faculty Avatar Badge on Shark */}
              <div 
                className="absolute left-[72px] top-[28px] w-7 h-7 rounded-full overflow-hidden border-2 border-yellow-400 shadow-xl bg-slate-900 flex items-center justify-center shrink-0 z-10"
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
                  <span className="text-[10px] font-black text-yellow-300">
                    {(profile?.name || 'T').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SWIMMING CREATURES LAYER */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {filteredFish.map(fish => {
            const isOnline = activeUsers.some(u => u.uid === fish.id && u.status !== 'offline');
            const isTopAchiever = fish.percentage >= 90;
            const speciesMeta = SPECIES_METADATA[fish.species];
            const bobY = Math.cos(fish.wigglePhase * 0.7) * 3;

            // If fish is currently eaten in shark's belly
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
                  zIndex: isTopAchiever ? 15 : 10
                }}
              >
                {/* Terrified / Panic emote when Teacher Shark attacks */}
                {fish.isTerrified && (
                  <div 
                    className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-xl border border-red-300 animate-bounce pointer-events-none flex items-center gap-1 z-20"
                    style={{ transform: `scaleX(${fish.direction}) translate(-50%, 0)` }}
                  >
                    <span>😱</span>
                    <span className="tracking-wide">HELP!</span>
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

                {/* Nametag & Score Pill */}
                {showNameTags && (
                  <div
                    className={cn(
                      "absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight shadow-xl backdrop-blur-md border transition-all duration-200 pointer-events-none flex items-center gap-1.5",
                      fish.isTerrified
                        ? "bg-red-950/90 text-white border-red-500 shadow-red-900/50"
                        : fish.percentage >= 90
                        ? "bg-amber-950/85 text-amber-200 border-amber-500/60 shadow-amber-900/40" 
                        : fish.percentage >= 75
                        ? "bg-emerald-950/85 text-emerald-200 border-emerald-500/60 shadow-emerald-900/40"
                        : fish.percentage >= 50
                        ? "bg-sky-950/85 text-sky-200 border-sky-500/60 shadow-sky-900/40"
                        : "bg-orange-950/85 text-orange-200 border-orange-500/60 shadow-orange-900/40",
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
                    <span className="truncate max-w-[100px] text-white">{fish.name}</span>
                    <span className={cn(
                      "font-black px-1.5 py-0.2 rounded-md text-[9px]",
                      fish.percentage >= 90 ? "bg-amber-500 text-black" :
                      fish.percentage >= 75 ? "bg-emerald-500 text-black" :
                      fish.percentage >= 50 ? "bg-sky-500 text-black" : "bg-orange-500 text-white"
                    )}>
                      {fish.percentage}% ({fish.scale}x)
                    </span>
                  </div>
                )}

                {/* SVG CREATURE BODY */}
                <div className="relative w-28 h-18 flex items-center justify-center filter drop-shadow-xl">
                  {isTopAchiever && (
                    <div className="absolute inset-0 rounded-full bg-amber-400/25 blur-md -z-10 animate-pulse" />
                  )}

                  {renderCreatureSVG(fish)}

                  {/* Student Avatar Embedded directly onto Creature Body/Shell */}
                  <div 
                    className="absolute left-[40px] top-[24px] w-6 h-6 rounded-full overflow-hidden border-2 border-white/95 shadow-md bg-slate-900 flex items-center justify-center shrink-0 z-10"
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
          })}
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
              title="Feed flakes to grow student creatures"
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Feed & Grow</span>
            </button>

            {/* Teacher Shark Button (Bully & Eat fish) */}
            <button
              onClick={triggerSharkHunt}
              className={cn(
                "active:scale-95 px-3 py-2 rounded-full text-xs font-black transition-all flex items-center gap-1.5 shadow-md",
                shark.state === 'hunting'
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white"
              )}
              title="Send Teacher Shark to hunt and eat student fish!"
            >
              <span>🦈</span>
              <span>{shark.state === 'hunting' ? 'Bullying Fish!' : 'Teacher Shark'}</span>
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
                    <span>🦈</span> Teacher Shark Mode
                  </p>
                  <p className="text-[10px] text-slate-400">Bully and eat student fish</p>
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

              {/* Filter by Tier */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Filter by Grade Tier
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'all', label: 'All' },
                    { id: '90+', label: '90%+' },
                    { id: '75-89', label: '75-89%' },
                    { id: '50-74', label: '50-74%' },
                    { id: '<50', label: '<50%' },
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
                selectedFish.percentage >= 75 ? "bg-gradient-to-r from-emerald-400 to-teal-500" :
                selectedFish.percentage >= 50 ? "bg-gradient-to-r from-sky-400 to-blue-600" :
                "bg-gradient-to-r from-orange-400 to-red-500"
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
                    selectedFish.percentage >= 75 ? "text-emerald-500" :
                    selectedFish.percentage >= 50 ? "text-sky-500" : "text-orange-500"
                  )}>
                    {selectedFish.percentage}%
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Creature Scale</p>
                  <p className="text-xl font-black text-cyan-600 dark:text-cyan-400 mt-0.5">
                    {selectedFish.scale}x
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
