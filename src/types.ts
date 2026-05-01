export type QuestionType = 'mcq' | 'subjective' | 'fillblank' | 'truefalse' | 'match';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type PaperSection = 'A' | 'B' | 'C' | 'D';

export interface User {
  id: string;
  email: string;
  fullName: string;
  schoolName?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Course {
  id: string;
  teacherId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Subject {
  id: string;
  teacherId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Class {
  id: string;
  teacherId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Question {
  id: string;
  teacherId: string;
  content: string;
  courseId?: string;
  subjectId?: string;
  classId?: string;
  questionType: QuestionType;
  options: string[];
  difficulty: Difficulty;
  explanation?: string;
  imageUrl?: string;
  typeHeader?: string;
  createdAt: number;
  updatedAt: number;
}

export interface HeaderConfig {
  logoUrl?: string;
  logoSize?: number;
  logoPos?: { x: number; y: number };
  barcodePos?: { x: number; y: number };
  showBarcode?: boolean;
}

export interface QuestionPaper {
  id: string;
  qpCode: string;
  teacherId: string;
  title: string;
  date?: string;
  maxMarks?: number;
  courseId?: string;
  subjectId?: string;
  classId?: string;
  instructions?: string;
  isPublished: boolean;
  totalMarks: number;
  duration?: number;
  headerConfig?: HeaderConfig;
  createdAt: number;
  updatedAt: number;
}

export interface PaperQuestion {
  id: string;
  paperId: string;
  questionId: string;
  section: PaperSection;
  marks: number;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
}

export type AnyBlock = SectionBlock | MCQBlock | ShortBlock | LongBlock | FillBlankBlock;

export interface SectionBlock {
  id: string;
  type: 'section';
  title: string;
  instruction: string;
}

export interface MCQBlock {
  id: string;
  type: 'mcq';
  question: string;
  options: string[];
  correctAnswer: number;
  marks: number;
}

export interface ShortBlock {
  id: string;
  type: 'short';
  question: string;
  lines: number;
  marks: number;
}

export interface LongBlock {
  id: string;
  type: 'long';
  question: string;
  marks: number;
}

export interface FillBlankBlock {
  id: string;
  type: 'fillblank';
  text: string;
  answers: string;
  marks: number;
}