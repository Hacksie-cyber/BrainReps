export type UserRole = 'teacher' | 'student';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  isBanned?: boolean;
}

export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer';

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer: string;
  points: number;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  createdAt: string;
  questions: Question[];
  retakeLimit: number;
  timeLimit?: number; // In minutes
  isHidden?: boolean;
  allowedStudentIds?: string[];
}

export interface QuizSubmission {
  id: string;
  quizId: string;
  quizTitle: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  responses: {
    questionId: string;
    answer: string;
    isCorrect?: boolean;
    pointsEarned: number;
    maxPoints: number;
  }[];
  score: number;
  totalPoints: number;
  submittedAt: string;
  graded: boolean;
  status?: 'in-progress' | 'completed';
}
