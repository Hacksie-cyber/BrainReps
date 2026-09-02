export interface QuizTheme {
  id: string;
  name: string;
  gradientBar: string;
  cardBorderHover: string;
  cardShadowHover: string;
  cardHoverBg: string;
  iconBoxBg: string;
  iconBoxText: string;
  iconBoxHoverBg: string;
  iconBoxBorder: string;
  titleHover: string;
  authorAvatarBg: string;
  authorAvatarText: string;
  buttonBg: string;
  retakeScoreText: string;
  subtleBadge: string;
  topAchieverBorder: string;
  topAchieverBg: string;
  accentHex: string;
}

export const QUIZ_THEMES: QuizTheme[] = [
  // 1. Indigo / Royal Blue
  {
    id: 'indigo',
    name: 'Indigo Violet',
    gradientBar: 'from-indigo-500 via-indigo-600 to-violet-600',
    cardBorderHover: 'hover:border-indigo-300 dark:hover:border-indigo-700/80',
    cardShadowHover: 'hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/10',
    cardHoverBg: 'group-hover:bg-gradient-to-b group-hover:from-indigo-50/20 group-hover:to-transparent dark:group-hover:from-indigo-950/20',
    iconBoxBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    iconBoxText: 'text-indigo-600 dark:text-indigo-400',
    iconBoxHoverBg: 'group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-500 dark:group-hover:text-white',
    iconBoxBorder: 'border-indigo-200/60 dark:border-indigo-800/50',
    titleHover: 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400',
    authorAvatarBg: 'group-hover/educator:bg-indigo-100 dark:group-hover/educator:bg-indigo-900/50',
    authorAvatarText: 'group-hover/educator:text-indigo-600 dark:group-hover/educator:text-indigo-400',
    buttonBg: 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40',
    retakeScoreText: 'text-indigo-600 dark:text-indigo-400',
    subtleBadge: 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/50',
    topAchieverBorder: 'border-indigo-200/50 dark:border-indigo-900/30',
    topAchieverBg: 'bg-indigo-50/30 dark:bg-indigo-950/20',
    accentHex: '#6366f1',
  },
  // 2. Emerald / Forest Green
  {
    id: 'emerald',
    name: 'Emerald Jade',
    gradientBar: 'from-emerald-500 via-teal-500 to-green-600',
    cardBorderHover: 'hover:border-emerald-300 dark:hover:border-emerald-700/80',
    cardShadowHover: 'hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/10',
    cardHoverBg: 'group-hover:bg-gradient-to-b group-hover:from-emerald-50/20 group-hover:to-transparent dark:group-hover:from-emerald-950/20',
    iconBoxBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    iconBoxText: 'text-emerald-600 dark:text-emerald-400',
    iconBoxHoverBg: 'group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-500 dark:group-hover:text-white',
    iconBoxBorder: 'border-emerald-200/60 dark:border-emerald-800/50',
    titleHover: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
    authorAvatarBg: 'group-hover/educator:bg-emerald-100 dark:group-hover/educator:bg-emerald-900/50',
    authorAvatarText: 'group-hover/educator:text-emerald-600 dark:group-hover/educator:text-emerald-400',
    buttonBg: 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40',
    retakeScoreText: 'text-emerald-600 dark:text-emerald-400',
    subtleBadge: 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/50',
    topAchieverBorder: 'border-emerald-200/50 dark:border-emerald-900/30',
    topAchieverBg: 'bg-emerald-50/30 dark:bg-emerald-950/20',
    accentHex: '#10b981',
  },
  // 3. Amber / Solar Gold
  {
    id: 'amber',
    name: 'Amber Solar',
    gradientBar: 'from-amber-500 via-orange-500 to-yellow-500',
    cardBorderHover: 'hover:border-amber-300 dark:hover:border-amber-700/80',
    cardShadowHover: 'hover:shadow-amber-500/10 dark:hover:shadow-amber-500/10',
    cardHoverBg: 'group-hover:bg-gradient-to-b group-hover:from-amber-50/20 group-hover:to-transparent dark:group-hover:from-amber-950/20',
    iconBoxBg: 'bg-amber-500/10 dark:bg-amber-500/20',
    iconBoxText: 'text-amber-600 dark:text-amber-400',
    iconBoxHoverBg: 'group-hover:bg-amber-600 group-hover:text-white dark:group-hover:bg-amber-500 dark:group-hover:text-white',
    iconBoxBorder: 'border-amber-200/60 dark:border-amber-800/50',
    titleHover: 'group-hover:text-amber-600 dark:group-hover:text-amber-400',
    authorAvatarBg: 'group-hover/educator:bg-amber-100 dark:group-hover/educator:bg-amber-900/50',
    authorAvatarText: 'group-hover/educator:text-amber-600 dark:group-hover/educator:text-amber-400',
    buttonBg: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 text-white shadow-lg shadow-amber-600/25 hover:shadow-amber-600/40',
    retakeScoreText: 'text-amber-600 dark:text-amber-400',
    subtleBadge: 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/50',
    topAchieverBorder: 'border-amber-200/50 dark:border-amber-900/30',
    topAchieverBg: 'bg-amber-50/30 dark:bg-amber-950/20',
    accentHex: '#f59e0b',
  },
  // 4. Rose / Crimson Pink
  {
    id: 'rose',
    name: 'Rose Crimson',
    gradientBar: 'from-rose-500 via-pink-500 to-red-500',
    cardBorderHover: 'hover:border-rose-300 dark:hover:border-rose-700/80',
    cardShadowHover: 'hover:shadow-rose-500/10 dark:hover:shadow-rose-500/10',
    cardHoverBg: 'group-hover:bg-gradient-to-b group-hover:from-rose-50/20 group-hover:to-transparent dark:group-hover:from-rose-950/20',
    iconBoxBg: 'bg-rose-500/10 dark:bg-rose-500/20',
    iconBoxText: 'text-rose-600 dark:text-rose-400',
    iconBoxHoverBg: 'group-hover:bg-rose-600 group-hover:text-white dark:group-hover:bg-rose-500 dark:group-hover:text-white',
    iconBoxBorder: 'border-rose-200/60 dark:border-rose-800/50',
    titleHover: 'group-hover:text-rose-600 dark:group-hover:text-rose-400',
    authorAvatarBg: 'group-hover/educator:bg-rose-100 dark:group-hover/educator:bg-rose-900/50',
    authorAvatarText: 'group-hover/educator:text-rose-600 dark:group-hover/educator:text-rose-400',
    buttonBg: 'bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 text-white shadow-lg shadow-rose-600/25 hover:shadow-rose-600/40',
    retakeScoreText: 'text-rose-600 dark:text-rose-400',
    subtleBadge: 'bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/50',
    topAchieverBorder: 'border-rose-200/50 dark:border-rose-900/30',
    topAchieverBg: 'bg-rose-50/30 dark:bg-rose-950/20',
    accentHex: '#f43f5e',
  },
  // 5. Cyan / Oceanic Sky
  {
    id: 'cyan',
    name: 'Cyan Ocean',
    gradientBar: 'from-cyan-500 via-sky-500 to-blue-500',
    cardBorderHover: 'hover:border-cyan-300 dark:hover:border-cyan-700/80',
    cardShadowHover: 'hover:shadow-cyan-500/10 dark:hover:shadow-cyan-500/10',
    cardHoverBg: 'group-hover:bg-gradient-to-b group-hover:from-cyan-50/20 group-hover:to-transparent dark:group-hover:from-cyan-950/20',
    iconBoxBg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    iconBoxText: 'text-cyan-600 dark:text-cyan-400',
    iconBoxHoverBg: 'group-hover:bg-cyan-600 group-hover:text-white dark:group-hover:bg-cyan-500 dark:group-hover:text-white',
    iconBoxBorder: 'border-cyan-200/60 dark:border-cyan-800/50',
    titleHover: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400',
    authorAvatarBg: 'group-hover/educator:bg-cyan-100 dark:group-hover/educator:bg-cyan-900/50',
    authorAvatarText: 'group-hover/educator:text-cyan-600 dark:group-hover/educator:text-cyan-400',
    buttonBg: 'bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/25 hover:shadow-cyan-600/40',
    retakeScoreText: 'text-cyan-600 dark:text-cyan-400',
    subtleBadge: 'bg-cyan-50/80 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200/60 dark:border-cyan-800/50',
    topAchieverBorder: 'border-cyan-200/50 dark:border-cyan-900/30',
    topAchieverBg: 'bg-cyan-50/30 dark:bg-cyan-950/20',
    accentHex: '#06b6d4',
  },
  // 6. Purple / Vivid Violet
  {
    id: 'purple',
    name: 'Purple Vivid',
    gradientBar: 'from-purple-500 via-fuchsia-500 to-pink-500',
    cardBorderHover: 'hover:border-purple-300 dark:hover:border-purple-700/80',
    cardShadowHover: 'hover:shadow-purple-500/10 dark:hover:shadow-purple-500/10',
    cardHoverBg: 'group-hover:bg-gradient-to-b group-hover:from-purple-50/20 group-hover:to-transparent dark:group-hover:from-purple-950/20',
    iconBoxBg: 'bg-purple-500/10 dark:bg-purple-500/20',
    iconBoxText: 'text-purple-600 dark:text-purple-400',
    iconBoxHoverBg: 'group-hover:bg-purple-600 group-hover:text-white dark:group-hover:bg-purple-500 dark:group-hover:text-white',
    iconBoxBorder: 'border-purple-200/60 dark:border-purple-800/50',
    titleHover: 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
    authorAvatarBg: 'group-hover/educator:bg-purple-100 dark:group-hover/educator:bg-purple-900/50',
    authorAvatarText: 'group-hover/educator:text-purple-600 dark:group-hover/educator:text-purple-400',
    buttonBg: 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25 hover:shadow-purple-600/40',
    retakeScoreText: 'text-purple-600 dark:text-purple-400',
    subtleBadge: 'bg-purple-50/80 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/50',
    topAchieverBorder: 'border-purple-200/50 dark:border-purple-900/30',
    topAchieverBg: 'bg-purple-50/30 dark:bg-purple-950/20',
    accentHex: '#a855f7',
  },
  // 7. Teal / Mint Wave
  {
    id: 'teal',
    name: 'Teal Mint',
    gradientBar: 'from-teal-500 via-emerald-400 to-cyan-500',
    cardBorderHover: 'hover:border-teal-300 dark:hover:border-teal-700/80',
    cardShadowHover: 'hover:shadow-teal-500/10 dark:hover:shadow-teal-500/10',
    cardHoverBg: 'group-hover:bg-gradient-to-b group-hover:from-teal-50/20 group-hover:to-transparent dark:group-hover:from-teal-950/20',
    iconBoxBg: 'bg-teal-500/10 dark:bg-teal-500/20',
    iconBoxText: 'text-teal-600 dark:text-teal-400',
    iconBoxHoverBg: 'group-hover:bg-teal-600 group-hover:text-white dark:group-hover:bg-teal-500 dark:group-hover:text-white',
    iconBoxBorder: 'border-teal-200/60 dark:border-teal-800/50',
    titleHover: 'group-hover:text-teal-600 dark:group-hover:text-teal-400',
    authorAvatarBg: 'group-hover/educator:bg-teal-100 dark:group-hover/educator:bg-teal-900/50',
    authorAvatarText: 'group-hover/educator:text-teal-600 dark:group-hover/educator:text-teal-400',
    buttonBg: 'bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-lg shadow-teal-600/25 hover:shadow-teal-600/40',
    retakeScoreText: 'text-teal-600 dark:text-teal-400',
    subtleBadge: 'bg-teal-50/80 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200/60 dark:border-teal-800/50',
    topAchieverBorder: 'border-teal-200/50 dark:border-teal-900/30',
    topAchieverBg: 'bg-teal-50/30 dark:bg-teal-950/20',
    accentHex: '#14b8a6',
  },
  // 8. Orange / Sunset Coral
  {
    id: 'orange',
    name: 'Sunset Orange',
    gradientBar: 'from-orange-500 via-amber-500 to-red-500',
    cardBorderHover: 'hover:border-orange-300 dark:hover:border-orange-700/80',
    cardShadowHover: 'hover:shadow-orange-500/10 dark:hover:shadow-orange-500/10',
    cardHoverBg: 'group-hover:bg-gradient-to-b group-hover:from-orange-50/20 group-hover:to-transparent dark:group-hover:from-orange-950/20',
    iconBoxBg: 'bg-orange-500/10 dark:bg-orange-500/20',
    iconBoxText: 'text-orange-600 dark:text-orange-400',
    iconBoxHoverBg: 'group-hover:bg-orange-600 group-hover:text-white dark:group-hover:bg-orange-500 dark:group-hover:text-white',
    iconBoxBorder: 'border-orange-200/60 dark:border-orange-800/50',
    titleHover: 'group-hover:text-orange-600 dark:group-hover:text-orange-400',
    authorAvatarBg: 'group-hover/educator:bg-orange-100 dark:group-hover/educator:bg-orange-900/50',
    authorAvatarText: 'group-hover/educator:text-orange-600 dark:group-hover/educator:text-orange-400',
    buttonBg: 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-500 text-white shadow-lg shadow-orange-600/25 hover:shadow-orange-600/40',
    retakeScoreText: 'text-orange-600 dark:text-orange-400',
    subtleBadge: 'bg-orange-50/80 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200/60 dark:border-orange-800/50',
    topAchieverBorder: 'border-orange-200/50 dark:border-orange-900/30',
    topAchieverBg: 'bg-orange-50/30 dark:bg-orange-950/20',
    accentHex: '#f97316',
  },
];

/**
 * Returns a stable, deterministic theme for a quiz based on its unique ID or index.
 */
export function getQuizColorTheme(quizId: string, index?: number): QuizTheme {
  if (!quizId) {
    return QUIZ_THEMES[(index ?? 0) % QUIZ_THEMES.length];
  }

  let hash = 0;
  for (let i = 0; i < quizId.length; i++) {
    hash = (hash << 5) - hash + quizId.charCodeAt(i);
    hash |= 0;
  }

  // Combine string hash with index offset to guarantee adjacent cards have diverse colors
  const offset = index !== undefined ? (index % QUIZ_THEMES.length) : 0;
  const themeIndex = Math.abs(hash + offset * 3) % QUIZ_THEMES.length;
  return QUIZ_THEMES[themeIndex];
}
