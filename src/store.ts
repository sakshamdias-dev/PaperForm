import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Paper, Question, AnyBlock, BlockType, SectionBlock, MCQBlock, ShortBlock, LongBlock, FillBlankBlock } from './types';
import { supabase } from './supabase';

interface AppState {
  papers: Paper[];
  questions: Question[];
  currentPaperId: string | null;
  user: { id: string; name: string; schoolName: string } | null;
  loading: boolean;
  
  setUser: (user: { id: string; name: string; schoolName: string }) => void;
  setCurrentPaper: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  getState: () => AppState;
  
  fetchPapers: () => Promise<void>;
  fetchQuestions: () => Promise<void>;
  createPaper: (title: string, subject: string, grade: string) => Promise<string>;
  updatePaper: (id: string, updates: Partial<Paper>) => Promise<void>;
  deletePaper: (id: string) => Promise<void>;
  duplicatePaper: (id: string) => string;
  
  addBlock: (paperId: string, type: BlockType) => Promise<void>;
  updateBlock: <T extends AnyBlock>(paperId: string, blockId: string, updates: Partial<T>) => Promise<void>;
  deleteBlock: (paperId: string, blockId: string) => Promise<void>;
  reorderBlocks: (paperId: string, blocks: AnyBlock[]) => Promise<void>;
  
  saveQuestionToBank: (question: Omit<Question, 'id' | 'createdAt'>) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

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
      papers: [],
      questions: [],
      currentPaperId: null,
      user: null,
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
            title: p.title,
            subject: p.subject,
            grade: p.grade,
            schoolName: p.school_name,
            blocks: p.blocks || [],
            createdAt: new Date(p.created_at).getTime(),
            updatedAt: new Date(p.updated_at).getTime(),
          }));
          set({ papers });
        }
        set({ loading: false });
      },

      fetchQuestions: async () => {
        const { user } = get();
        if (!user?.id) return;

        const { data, error } = await supabase
          .from('questions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const questions: Question[] = data.map(q => ({
            id: q.id,
            type: q.type,
            question: q.question_text,
            options: q.options,
            correctAnswer: q.correct_answer,
            marks: q.marks,
            subject: q.subject,
            createdAt: new Date(q.created_at).getTime(),
          }));
          set({ questions });
        }
      },

      createPaper: async (title, subject, grade) => {
        const { user } = get();
        const id = generateId();
        
        const newPaper: Paper = {
          id,
          title,
          subject,
          grade,
          schoolName: user?.schoolName || 'My School',
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
            blocks: [],
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
          await supabase.from('papers').update({
            title: updates.title,
            subject: updates.subject,
            grade: updates.grade,
            blocks: updates.blocks,
            updated_at: new Date().toISOString(),
          }).eq('id', id);
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
          blocks: paper.blocks.map((b) => ({ ...b, id: generateId() })),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ papers: [newPaper, ...state.papers] }));
        return newId;
      },

      addBlock: async (paperId, type) => {
        const block = createDefaultBlock(type);
        const paper = get().papers.find(p => p.id === paperId);
        if (!paper) return;

        const newBlocks = [...paper.blocks, block];
        
        set((state) => ({
          papers: state.papers.map((p) =>
            p.id === paperId
              ? { ...p, blocks: newBlocks, updatedAt: Date.now() }
              : p
          ),
        }));

        await get().updatePaper(paperId, { blocks: newBlocks });
      },

      updateBlock: async (paperId, blockId, updates) => {
        const paper = get().papers.find(p => p.id === paperId);
        if (!paper) return;

        const newBlocks = paper.blocks.map((b) =>
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

        const newBlocks = paper.blocks.filter((b) => b.id !== blockId);

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

      saveQuestionToBank: async (question) => {
        const { user } = get();
        const newQuestion: Question = {
          ...question,
          id: generateId(),
          createdAt: Date.now(),
        };

        set((state) => ({ questions: [newQuestion, ...state.questions] }));

        if (user?.id) {
          await supabase.from('questions').insert({
            id: newQuestion.id,
            user_id: user.id,
            type: question.type,
            question_text: question.question,
            options: question.options,
            correct_answer: question.correctAnswer,
            marks: question.marks,
            subject: question.subject,
            created_at: new Date().toISOString(),
          });
        }
      },

      deleteQuestion: async (id) => {
        const { user } = get();
        
        set((state) => ({ questions: state.questions.filter((q) => q.id !== id) }));

        if (user?.id) {
          await supabase.from('questions').delete().eq('id', id);
        }
      },
    }),
    {
      name: 'paperform-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
);

export const store = useStore;