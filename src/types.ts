export type BlockType = 'section' | 'mcq' | 'short' | 'long' | 'fillblank';

export interface Block {
  id: string;
  type: BlockType;
}

export interface SectionBlock extends Block {
  type: 'section';
  title: string;
  instruction: string;
}

export interface MCQBlock extends Block {
  type: 'mcq';
  question: string;
  options: string[];
  correctAnswer: number;
  marks: number;
}

export interface ShortBlock extends Block {
  type: 'short';
  question: string;
  lines: number;
  marks: number;
}

export interface LongBlock extends Block {
  type: 'long';
  question: string;
  marks: number;
}

export interface FillBlankBlock extends Block {
  type: 'fillblank';
  text: string;
  answers: string;
  marks: number;
}

export type AnyBlock = SectionBlock | MCQBlock | ShortBlock | LongBlock | FillBlankBlock;

export interface User {
  id: string;
  email: string;
  fullName: string;
  schoolName: string;
  avatarUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Paper {
  id: string;
  userId: string;
  title: string;
  subject: string;
  grade: string;
  schoolName: string;
  description?: string;
  instructions?: string;
  duration?: number;
  course?: string;
  examDate?: string;
  maxMarks?: number;
  totalMarks: number;
  isPublished: boolean;
  blocks: AnyBlock[];
  createdAt: number;
  updatedAt: number;
}

export interface Section {
  id: string;
  paperId: string;
  title: string;
  instruction?: string;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface Question {
  id: string;
  userId: string;
  sectionId?: string;
  questionText: string;
  questionType: BlockType;
  options?: string[];
  correctAnswer?: string;
  marks: number;
  subject?: string;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  explanation?: string;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
}

export type Subject = 'Mathematics' | 'Science' | 'English' | 'History' | 'Geography' | 'Physics' | 'Chemistry' | 'Biology' | 'Other';
export type Grade = '9th Grade' | '10th Grade';

export const SUBJECTS: Subject[] = ['Mathematics', 'Science', 'English', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology', 'Other'];
export const GRADES: Grade[] = ['9th Grade', '10th Grade'];