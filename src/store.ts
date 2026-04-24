import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Paper, Question, Section, User, BlockType, AnyBlock, SectionBlock, MCQBlock, ShortBlock, LongBlock, FillBlankBlock } from './types';
import { supabase } from './supabase';

interface AppState {
  user: User | null;
  papers: Paper[];
  sections: Map<string, Section[]>;
  questions: Question[];
  currentPaperId: string | null;
  loading: boolean;
  
  setUser: (user: User | null) => void;
  setCurrentPaper: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  getState: () => AppState;
  
  fetchPapers: () => Promise<void>;
  fetchSections: (paperId: string) => Promise<void>;
  fetchQuestions: (sectionId?: string) => Promise<void>;
  
  createPaper: (title: string, subject: string, grade: string, instructions?: string, duration?: number, course?: string, examDate?: string, maxMarks?: number) => Promise<string>;
  updatePaper: (id: string, updates: Partial<Paper>) => Promise<void>;
  deletePaper: (id: string) => Promise<void>;
  duplicatePaper: (id: string) => string;
  
  createSection: (paperId: string, title: string) => Promise<string>;
  updateSection: (paperId: string, sectionId: string, updates: Partial<Section>) => Promise<void>;
  deleteSection: (paperId: string, sectionId: string) => Promise<void>;
  reorderSections: (paperId: string, sections: Section[]) => Promise<void>;
  
  createQuestion: (sectionId: string, question: Omit<Question, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateQuestion: (questionId: string, updates: Partial<Question>) => Promise<void>;
  deleteQuestion: (questionId: string) => Promise<void>;
  
  saveQuestionToBank: (question: Omit<Question, 'id' | 'userId' | 'sectionId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  deleteQuestionFromBank: (questionId: string) => Promise<void>;
  
  addBlock: (paperId: string, type: BlockType) => Promise<void>;
  updateBlock: (paperId: string, blockId: string, updates: Partial<AnyBlock>) => Promise<void>;
  deleteBlock: (paperId: string, blockId: string) => Promise<void>;
  reorderBlocks: (paperId: string, blocks: AnyBlock[]) => Promise<void>;
}

const generateId = () => crypto.randomUUID();

const createDefaultBlock = (type: BlockType): AnyBlock => {
  const base = { id: generateId() };
  switch (type) {
    case 'section':
      return { ...base, type: 'section', title: 'Section A', instruction: '' } as SectionBlock;
    case 'mcq':
      return { ...base, type: 'mcq', question: '', options: ['', '', '', ''], correctAnswer: 0, marks: 1 } as MCQBlock;
    case 'short':
      return { ...base, type: 'short', question: '', lines: 3, marks: 2 } as ShortBlock;
    case 'long':
      return { ...base, type: 'long', question: '', marks: 5 } as LongBlock;
    case 'fillblank':
      return { ...base, type: 'fillblank', text: '', answers: '', marks: 1 } as FillBlankBlock;
  }
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      papers: [],
      sections: new Map(),
      questions: [],
      currentPaperId: null,
      loading: false,

      setUser: (user) => set({ user }),

      setCurrentPaper: (id) => set({ currentPaperId: id }),

      setLoading: (loading) => set({ loading }),
      
      getState: () => {
        let state: AppState | null = null;
        set((s) => {
          state = s;
          return s;
        });
        return state!;
      },

      fetchPapers: async () => {
        const { user } = get();
        if (!user?.id) return;
        
        set({ loading: true });
        const { data, error } = await supabase
          .from('papers')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });
        
        if (!error && data) {
          const papers: Paper[] = data.map(p => ({
            id: p.id,
            userId: p.user_id,
            title: p.title,
            subject: p.subject,
            grade: p.grade,
            schoolName: p.school_name || '',
            instructions: p.instructions,
            duration: p.duration,
            course: p.course,
            examDate: p.exam_date,
            maxMarks: p.max_marks,
            totalMarks: p.total_marks || 0,
            isPublished: p.is_published || false,
            blocks: p.blocks || [],
            createdAt: new Date(p.created_at).getTime(),
            updatedAt: new Date(p.updated_at).getTime(),
          }));
          set({ papers });
        }
        set({ loading: false });
      },

      fetchSections: async (paperId: string) => {
        const { data, error } = await supabase
          .from('sections')
          .select('*')
          .eq('paper_id', paperId)
          .order('order_index', { ascending: true });

        if (!error && data) {
          const sections: Section[] = data.map(s => ({
            id: s.id,
            paperId: s.paper_id,
            title: s.title,
            instruction: s.instruction,
            orderIndex: s.order_index,
            createdAt: new Date(s.created_at).getTime(),
            updatedAt: new Date(s.updated_at).getTime(),
          }));
          set((state) => {
            const newSections = new Map(state.sections);
            newSections.set(paperId, sections);
            return { sections: newSections };
          });
        }
      },

      fetchQuestions: async (sectionId?: string) => {
        const { user } = get();
        if (!user?.id) return;

        let query = supabase
          .from('questions')
          .select('*')
          .eq('user_id', user.id);

        if (sectionId) {
          query = query.eq('section_id', sectionId);
        } else {
          query = query.is('section_id', null);
        }

        const { data, error } = await query.order('order_index', { ascending: true });

        if (!error && data) {
          const questions: Question[] = data.map(q => ({
            id: q.id,
            userId: q.user_id,
            sectionId: q.section_id,
            questionText: q.question_text,
            questionType: q.question_type,
            options: q.options,
            correctAnswer: q.correct_answer,
            marks: q.marks,
            subject: q.subject,
            topic: q.topic,
            difficulty: q.difficulty,
            explanation: q.explanation,
            orderIndex: q.order_index,
            createdAt: new Date(q.created_at).getTime(),
            updatedAt: new Date(q.updated_at).getTime(),
          }));
          set({ questions });
        }
      },

      createPaper: async (title, subject, grade, instructions, duration, course, examDate, maxMarks) => {
        const { user } = get();
        if (!user?.id) return '';
        
        const id = generateId();
        
        const newPaper: Paper = {
          id,
          userId: user.id,
          title,
          subject,
          grade,
          schoolName: user.schoolName || '',
          instructions: instructions || '',
          duration: duration,
          course: course || 'K12',
          examDate: examDate,
          maxMarks: maxMarks,
          totalMarks: 0,
          isPublished: false,
          blocks: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({ papers: [newPaper, ...state.papers], currentPaperId: id }));

        if (user?.id) {
          await supabase.from('papers').insert({
            id,
            user_id: user.id,
            title,
            subject,
            grade,
            school_name: newPaper.schoolName,
            instructions: instructions || '',
            duration: duration,
            course: course || 'K12',
            exam_date: examDate,
            max_marks: maxMarks,
            blocks: [],
            total_marks: 0,
            is_published: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        return id;
      },

      updatePaper: async (id, updates) => {
        const { user } = get();
        
        set((state) => ({
          papers: state.papers.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
          ),
        }));

        if (user?.id) {
          const supabaseUpdates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };
          if (updates.title !== undefined) supabaseUpdates.title = updates.title;
          if (updates.subject !== undefined) supabaseUpdates.subject = updates.subject;
          if (updates.grade !== undefined) supabaseUpdates.grade = updates.grade;
          if (updates.schoolName !== undefined) supabaseUpdates.school_name = updates.schoolName;
          if (updates.instructions !== undefined) supabaseUpdates.instructions = updates.instructions;
          if (updates.duration !== undefined) supabaseUpdates.duration = updates.duration;
          if (updates.course !== undefined) supabaseUpdates.course = updates.course;
          if (updates.examDate !== undefined) supabaseUpdates.exam_date = updates.examDate;
          if (updates.maxMarks !== undefined) supabaseUpdates.max_marks = updates.maxMarks;
          if (updates.totalMarks !== undefined) supabaseUpdates.total_marks = updates.totalMarks;
          if (updates.isPublished !== undefined) supabaseUpdates.is_published = updates.isPublished;
          if (updates.blocks !== undefined) supabaseUpdates.blocks = updates.blocks;

          await supabase.from('papers').update(supabaseUpdates).eq('id', id);
        }
      },

      deletePaper: async (id) => {
        const { user } = get();
        
        set((state) => ({
          papers: state.papers.filter((p) => p.id !== id),
          currentPaperId: state.currentPaperId === id ? null : state.currentPaperId,
        }));

        if (user?.id) {
          await supabase.from('papers').delete().eq('id', id);
        }
      },

      duplicatePaper: (id) => {
        const paper = get().papers.find((p) => p.id === id);
        if (!paper) return '';
        const newId = generateId();
        const newPaper: Paper = {
          ...paper,
          id: newId,
          title: `${paper.title} (Copy)`,
          isPublished: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ papers: [newPaper, ...state.papers] }));
        return newId;
      },

      createSection: async (paperId, title) => {
        const id = generateId();
        const { sections } = get();
        const paperSections = sections.get(paperId) || [];
        const orderIndex = paperSections.length;

        const newSection: Section = {
          id,
          paperId,
          title,
          instruction: '',
          orderIndex,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => {
          const newSections = new Map(state.sections);
          newSections.set(paperId, [...paperSections, newSection]);
          return { sections: newSections };
        });

        await supabase.from('sections').insert({
          id,
          paper_id: paperId,
          title,
          instruction: '',
          order_index: orderIndex,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        return id;
      },

      updateSection: async (paperId, sectionId, updates) => {
        set((state) => {
          const newSections = new Map(state.sections);
          const paperSections = newSections.get(paperId) || [];
          newSections.set(paperId, paperSections.map(s =>
            s.id === sectionId ? { ...s, ...updates, updatedAt: Date.now() } : s
          ));
          return { sections: newSections };
        });

        const supabaseUpdates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.title !== undefined) supabaseUpdates.title = updates.title;
        if (updates.instruction !== undefined) supabaseUpdates.instruction = updates.instruction;
        if (updates.orderIndex !== undefined) supabaseUpdates.order_index = updates.orderIndex;

        await supabase.from('sections').update(supabaseUpdates).eq('id', sectionId);
      },

      deleteSection: async (paperId, sectionId) => {
        set((state) => {
          const newSections = new Map(state.sections);
          const paperSections = newSections.get(paperId) || [];
          newSections.set(paperId, paperSections.filter(s => s.id !== sectionId));
          return { sections: newSections };
        });

        await supabase.from('sections').delete().eq('id', sectionId);
      },

      reorderSections: async (paperId, sectionsList) => {
        set((state) => {
          const newSections = new Map(state.sections);
          newSections.set(paperId, sectionsList);
          return { sections: newSections };
        });

        const updates = sectionsList.map((s, i) => ({
          id: s.id,
          order_index: i,
        }));

        await supabase.from('sections').upsert(updates);
      },

      createQuestion: async (sectionId, question) => {
        const { user } = get();
        if (!user?.id) return '';

        const id = generateId();
        const { questions } = get();
        const sectionQuestions = questions.filter(q => q.sectionId === sectionId);
        const orderIndex = sectionQuestions.length;

        const newQuestion: Question = {
          id,
          userId: user.id,
          sectionId,
          questionText: question.questionText,
          questionType: question.questionType,
          options: question.options,
          correctAnswer: question.correctAnswer,
          marks: question.marks,
          subject: question.subject,
          topic: question.topic,
          difficulty: question.difficulty,
          explanation: question.explanation,
          orderIndex,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({ questions: [...state.questions, newQuestion] }));

        await supabase.from('questions').insert({
          id,
          user_id: user.id,
          section_id: sectionId,
          question_text: question.questionText,
          question_type: question.questionType,
          options: question.options,
          correct_answer: question.correctAnswer,
          marks: question.marks,
          subject: question.subject,
          topic: question.topic,
          difficulty: question.difficulty,
          explanation: question.explanation,
          order_index: orderIndex,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        return id;
      },

      updateQuestion: async (questionId, updates) => {
        set((state) => ({
          questions: state.questions.map(q =>
            q.id === questionId ? { ...q, ...updates, updatedAt: Date.now() } : q
          ),
        }));

        const supabaseUpdates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.questionText !== undefined) supabaseUpdates.question_text = updates.questionText;
        if (updates.questionType !== undefined) supabaseUpdates.question_type = updates.questionType;
        if (updates.options !== undefined) supabaseUpdates.options = updates.options;
        if (updates.correctAnswer !== undefined) supabaseUpdates.correct_answer = updates.correctAnswer;
        if (updates.marks !== undefined) supabaseUpdates.marks = updates.marks;
        if (updates.subject !== undefined) supabaseUpdates.subject = updates.subject;
        if (updates.topic !== undefined) supabaseUpdates.topic = updates.topic;
        if (updates.difficulty !== undefined) supabaseUpdates.difficulty = updates.difficulty;
        if (updates.explanation !== undefined) supabaseUpdates.explanation = updates.explanation;
        if (updates.orderIndex !== undefined) supabaseUpdates.order_index = updates.orderIndex;

        await supabase.from('questions').update(supabaseUpdates).eq('id', questionId);
      },

      deleteQuestion: async (questionId) => {
        set((state) => ({
          questions: state.questions.filter(q => q.id !== questionId),
        }));

        await supabase.from('questions').delete().eq('id', questionId);
      },

      saveQuestionToBank: async (question) => {
        const { user } = get();
        if (!user?.id) return '';

        const id = generateId();

        const newQuestion: Question = {
          id,
          userId: user.id,
          sectionId: undefined,
          questionText: question.questionText,
          questionType: question.questionType,
          options: question.options,
          correctAnswer: question.correctAnswer,
          marks: question.marks,
          subject: question.subject,
          topic: question.topic,
          difficulty: question.difficulty,
          explanation: question.explanation,
          orderIndex: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({ questions: [newQuestion, ...state.questions] }));

        await supabase.from('questions').insert({
          id,
          user_id: user.id,
          section_id: null,
          question_text: question.questionText,
          question_type: question.questionType,
          options: question.options,
          correct_answer: question.correctAnswer,
          marks: question.marks,
          subject: question.subject,
          topic: question.topic,
          difficulty: question.difficulty,
          explanation: question.explanation,
          order_index: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        return id;
      },

      deleteQuestionFromBank: async (questionId) => {
        set((state) => ({
          questions: state.questions.filter(q => q.id !== questionId),
        }));

        await supabase.from('questions').delete().eq('id', questionId);
      },

      addBlock: async (paperId, type) => {
        const block = createDefaultBlock(type);
        const paper = get().papers.find(p => p.id === paperId);
        if (!paper) return;

        const newBlocks = [...(paper.blocks || []), block];
        
        set((state) => ({
          papers: state.papers.map((p) =>
            p.id === paperId
              ? { ...p, blocks: newBlocks, updatedAt: Date.now() }
              : p
          ),
        }));

        await get().updatePaper(paperId, { blocks: newBlocks });
      },

      updateBlock: async (paperId: string, blockId: string, updates: Partial<AnyBlock>) => {
        const paper = get().papers.find(p => p.id === paperId);
        if (!paper) return;

        const newBlocks = (paper.blocks || []).map((b) =>
          b.id === blockId ? { ...b, ...updates } as AnyBlock : b
        );

        set((state) => ({
          papers: state.papers.map((p) =>
            p.id === paperId
              ? { ...p, blocks: newBlocks, updatedAt: Date.now() }
              : p
          ),
        }));

        await get().updatePaper(paperId, { blocks: newBlocks });
      },

      deleteBlock: async (paperId, blockId) => {
        const paper = get().papers.find(p => p.id === paperId);
        if (!paper) return;

        const newBlocks = (paper.blocks || []).filter((b) => b.id !== blockId);

        set((state) => ({
          papers: state.papers.map((p) =>
            p.id === paperId
              ? { ...p, blocks: newBlocks, updatedAt: Date.now() }
              : p
          ),
        }));

        await get().updatePaper(paperId, { blocks: newBlocks });
      },

      reorderBlocks: async (paperId, blocks) => {
        set((state) => ({
          papers: state.papers.map((p) =>
            p.id === paperId ? { ...p, blocks, updatedAt: Date.now() } : p
          ),
        }));

        await get().updatePaper(paperId, { blocks });
      },
    }),
    {
      name: 'paperform-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
);

export const store = useStore;