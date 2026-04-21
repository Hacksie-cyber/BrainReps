import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDeadline(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid Date";
  
  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d);

  // Remove "at " if it appears and lowercase AM/PM
  return formatted.replace(' at ', ', ').replace(/\s([AP]M)$/, (match, p1) => ` ${p1.toLowerCase()}`);
}
