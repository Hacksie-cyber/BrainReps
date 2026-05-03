import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { askHandoutAssistant, HandoutMessage, ContextSource } from '../lib/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Bot, Sparkles, Brain, Info, History, Database, AlertCircle, Filter, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';

export default function NeuralAssistant() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<HandoutMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<ContextSource[]>([]);
  const [activeSources, setActiveSources] = useState<('handout' | 'quiz')[]>(['handout', 'quiz']);
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [fetching, setFetching] = useState(true);
  const [dailyUsage, setDailyUsage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const DAILY_LIMIT = 20;
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    fetchData();
    if (profile?.uid) fetchUsage();
  }, [profile?.uid]);

  const fetchData = async () => {
    setFetching(true);
    try {
      const handoutSnap = await getDocs(collection(db, 'handouts'));
      const quizSnap = await getDocs(collection(db, 'quizzes'));

      const hData: ContextSource[] = handoutSnap.docs.map(d => {
        const data = d.data();
        return {
          title: data.title,
          content: data.content,
          subject: data.subject || data.title.split(' ')[0] || 'General',
          type: 'handout'
        };
      });

      const qData: ContextSource[] = quizSnap.docs.map(d => {
        const data = d.data();
        return {
          title: data.title,
          content: `${data.description}. Questions: ${data.questions?.map((q: any) => q.question).join(', ')}`,
          subject: data.subject || data.title.split(' ')[0] || 'General',
          type: 'quiz'
        };
      });

      setSources([...hData, ...qData]);
    } catch (error) {
      console.error("Failed to sync neural materials:", error);
    } finally {
      setFetching(false);
    }
  };

  const fetchUsage = async () => {
    if (!profile?.uid) return;
    const usageId = `${profile.uid}_${today}`;
    try {
      const uDoc = await getDoc(doc(db, 'usage', usageId));
      if (uDoc.exists()) {
        setDailyUsage(uDoc.data().count || 0);
      }
    } catch (error) {
      console.error("Usage fetch failed:", error);
    }
  };

  const updateUsage = async () => {
    if (!profile?.uid) return;
    const usageId = `${profile.uid}_${today}`;
    try {
      const uRef = doc(db, 'usage', usageId);
      const uDoc = await getDoc(uRef);
      if (!uDoc.exists()) {
        await setDoc(uRef, { userId: profile.uid, date: today, count: 1 });
        setDailyUsage(1);
      } else {
        await updateDoc(uRef, { count: increment(1) });
        setDailyUsage(prev => prev + 1);
      }
    } catch (error) {
      console.error("Usage update failed:", error);
    }
  };

  const filteredSources = sources.filter(s => {
    const matchesType = activeSources.includes(s.type);
    const matchesSubject = selectedSubject === 'All' || s.subject === selectedSubject;
    return matchesType && matchesSubject;
  });

  const subjects = ['All', ...new Set(sources.map(s => s.subject || 'General'))];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    
    if (dailyUsage >= DAILY_LIMIT) {
      const limitMsg: HandoutMessage = { 
        role: 'model', 
        content: `**Neural Quota Reached:** You have consumed your daily allocation of ${DAILY_LIMIT} synchronizations. Your cognitive interface will reset in 24 hours.`
      };
      setMessages(prev => [...prev, { role: 'user', content: input.trim() }, limitMsg]);
      setInput('');
      return;
    }

    const userMsg: HandoutMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await askHandoutAssistant(userMsg.content, filteredSources, messages);
      await updateUsage();
      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: `**Neural Desync Detected:** ${error.message || 'The AI synchronization was interrupted.'}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
              <Brain className="h-6 w-6" />
            </div>
            Neural AI Assistant
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight italic mt-1">
            Grounded in your institutional material repository.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <Database className="h-4 w-4 text-indigo-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {fetching ? 'Syncing...' : `${filteredSources.length} Nodes Filtered`}
            </span>
          </div>
          <div className={cn(
            "flex items-center gap-3 px-4 py-2 rounded-xl border shadow-sm transition-colors",
            dailyUsage >= DAILY_LIMIT 
              ? "bg-red-50 border-red-100 dark:bg-red-950/20 dark:border-red-900/50" 
              : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              dailyUsage >= DAILY_LIMIT ? "bg-red-500" : "bg-green-500"
            )} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Quota: {dailyUsage}/{DAILY_LIMIT}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden relative">
          {dailyUsage >= DAILY_LIMIT && messages.length === 0 && (
            <div className="absolute inset-0 z-20 bg-white/60 dark:bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-8">
              <div className="text-center max-w-sm bg-white dark:bg-slate-900 p-8 rounded-3xl border border-red-100 dark:border-red-900/50 shadow-2xl">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">Limit Reached</h3>
                <p className="text-sm text-slate-500 mt-2">
                  You have reached your daily neural sync limit. Access will be restored at midnight.
                </p>
              </div>
            </div>
          )}
          
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 scrollbar-thin scrollbar-thumb-slate-200"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-6">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 animate-pulse">
                  <Sparkles className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 font-display italic">Awaiting Synchronous Query</h3>
                  <p className="text-sm text-slate-500 font-medium mt-2">
                    Ask me anything about your handouts, subjects, or handouts. I am grounded in the institutional data repository.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex gap-4 max-w-[85%]",
                    m.role === 'user' ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg shrink-0 flex items-center justify-center shadow-sm",
                    m.role === 'user' ? "bg-slate-100 dark:bg-slate-800" : "bg-indigo-600 text-white"
                  )}>
                    {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={cn(
                    "rounded-2xl px-5 py-4 text-sm leading-relaxed",
                    m.role === 'user' 
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium" 
                      : (m.content.includes("Quota Reached") ? "bg-red-50 border-red-100 text-red-900" : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800 shadow-sm markdown-body prose prose-slate dark:prose-invert max-w-none")
                  )}>
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center animate-pulse">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-5 py-4 flex gap-1.5 items-center">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" />
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
            <form onSubmit={handleSend} className="relative group">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={dailyUsage >= DAILY_LIMIT ? "Neural sync quota reached..." : "Synchronize query with neural core..."}
                className={cn(
                  "w-full bg-white dark:bg-slate-900 border rounded-2xl py-4 pl-6 pr-14 text-sm shadow-sm transition-all font-medium",
                  dailyUsage >= DAILY_LIMIT 
                    ? "border-red-200 text-slate-400 cursor-not-allowed" 
                    : "border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500"
                )}
                disabled={loading || dailyUsage >= DAILY_LIMIT}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading || dailyUsage >= DAILY_LIMIT}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-30 disabled:shadow-none active:scale-95"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="hidden lg:block lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2">
              <Filter className="h-4 w-4 text-indigo-500" />
              Focus Configuration
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source Material</label>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => setActiveSources(prev => prev.includes('handout') ? prev.filter(p => p !== 'handout') : [...prev, 'handout'])}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all border",
                      activeSources.includes('handout') 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                        : "bg-slate-50 border-slate-100 text-slate-400"
                    )}
                  >
                    <span>Handouts</span>
                    {activeSources.includes('handout') && <CheckCircle2 className="h-4 w-4" />}
                  </button>
                  <button 
                    onClick={() => setActiveSources(prev => prev.includes('quiz') ? prev.filter(p => p !== 'quiz') : [...prev, 'quiz'])}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all border",
                      activeSources.includes('quiz') 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                        : "bg-slate-50 border-slate-100 text-slate-400"
                    )}
                  >
                    <span>Assessments</span>
                    {activeSources.includes('quiz') && <CheckCircle2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Topic Focus</label>
                <div className="flex flex-wrap gap-2">
                  {subjects.map(s => (
                    <button 
                      key={s}
                      onClick={() => setSelectedSubject(s)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                        selectedSubject === s 
                          ? "bg-indigo-600 text-white" 
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:scale-150 transition-transform duration-700" />
            <h3 className="text-lg font-bold font-display mb-3">Neural Status</h3>
            <p className="text-sm text-indigo-100 mb-6 leading-relaxed">
              Grounded in {filteredSources.length} active nodes. 
            </p>
            <div className="space-y-4">
              <div className="bg-white/10 rounded-xl p-3 flex items-center gap-3">
                <History className="h-4 w-4 text-indigo-200" />
                <span className="text-xs font-black uppercase tracking-widest">{messages.length} Synchronizations</span>
              </div>
              <div className="bg-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className={cn(
                  "h-2 w-full bg-white/20 rounded-full overflow-hidden"
                )}>
                  <div 
                    className="h-full bg-white transition-all duration-1000"
                    style={{ width: `${(dailyUsage / DAILY_LIMIT) * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest text-center">
                {DAILY_LIMIT - dailyUsage} Syncs available
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
