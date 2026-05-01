import { create } from 'zustand';
import type { Course, Subject, Class, Question, QuestionPaper, PaperQuestion, User, QuestionType, Difficulty, PaperSection } from './types';
import { supabase } from './supabase';

interface AppState {
  user: User | null;
  courses: Course[];
  subjects: Subject[];
  classes: Class[];
  questionPapers: QuestionPaper[];
  questions: Question[];
  paperQuestions: Map<string, PaperQuestion[]>;
  currentPaperId: string | null;
  loading: boolean;
  
  setUser: (user: User | null) => void;
  setCurrentPaper: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  
  fetchCourses: () => Promise<void>;
  fetchSubjects: () => Promise<void>;
  fetchClasses: () => Promise<void>;
  fetchQuestionPapers: () => Promise<void>;
  fetchQuestions: () => Promise<void>;
  fetchPaperQuestions: (paperId: string) => Promise<void>;
  
  createCourse: (name: string) => Promise<string>;
  updateCourse: (id: string, name: string) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  
  createSubject: (name: string) => Promise<string>;
  updateSubject: (id: string, name: string) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  
  createClass: (name: string) => Promise<string>;
  updateClass: (id: string, name: string) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  
  createQuestionPaper: (title: string, date?: string, maxMarks?: number, courseId?: string, subjectId?: string, classId?: string, instructions?: string, duration?: number) => Promise<string>;
  updateQuestionPaper: (id: string, updates: Partial<QuestionPaper>) => Promise<void>;
  deleteQuestionPaper: (id: string) => Promise<void>;
  duplicateQuestionPaper: (id: string) => string;
  
  createQuestion: (content: string, questionType: QuestionType, options?: string[], courseId?: string, subjectId?: string, classId?: string, difficulty?: Difficulty, explanation?: string, imageUrl?: string) => Promise<string>;
  updateQuestion: (id: string, updates: Partial<Question>) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
  
  addQuestionToPaper: (paperId: string, questionId: string, section?: PaperSection, marks?: number) => Promise<string>;
  updatePaperQuestion: (id: string, updates: Partial<PaperQuestion>) => Promise<void>;
  removeQuestionFromPaper: (paperId: string, questionId: string) => Promise<void>;
  reorderPaperQuestions: (paperId: string, paperQuestionsList: PaperQuestion[]) => Promise<void>;
  createAndAddQuestion: (paperId: string, content: string, questionType: QuestionType, options?: string[], section?: PaperSection, marks?: number, courseId?: string, subjectId?: string, classId?: string, difficulty?: Difficulty, explanation?: string, imageUrl?: string, typeHeader?: string) => Promise<string>;
}

const generateId = () => crypto.randomUUID();

export const useStore = create<AppState>()((set, get) => ({
    user: null,
      courses: [],
      subjects: [],
      classes: [],
      questionPapers: [],
      questions: [],
      paperQuestions: new Map(),
      currentPaperId: null,
      loading: false,

      setUser: (user) => set({ user }),
      setCurrentPaper: (id) => set({ currentPaperId: id }),
      setLoading: (loading) => set({ loading }),
      logout: () => {
        set({
          user: null,
          courses: [],
          subjects: [],
          classes: [],
          questionPapers: [],
          questions: [],
          paperQuestions: new Map(),
          currentPaperId: null,
        });
      },

      fetchCourses: async () => {
        const { user } = get();
        if (!user?.id) return;
        
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .eq('teacher_id', user.id)
          .order('name');
        
        if (!error && data) {
          const courses: Course[] = data.map(c => ({
            id: c.id,
            teacherId: c.teacher_id,
            name: c.name,
            createdAt: new Date(c.created_at).getTime(),
            updatedAt: new Date(c.updated_at).getTime(),
          }));
          set({ courses });
        }
      },

      fetchSubjects: async () => {
        const { user } = get();
        if (!user?.id) return;
        
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .eq('teacher_id', user.id)
          .order('name');
        
        if (!error && data) {
          const subjects: Subject[] = data.map(s => ({
            id: s.id,
            teacherId: s.teacher_id,
            name: s.name,
            createdAt: new Date(s.created_at).getTime(),
            updatedAt: new Date(s.updated_at).getTime(),
          }));
          set({ subjects });
        }
      },

      fetchClasses: async () => {
        const { user } = get();
        if (!user?.id) return;
        
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .eq('teacher_id', user.id)
          .order('name');
        
        if (!error && data) {
          const classes: Class[] = data.map(c => ({
            id: c.id,
            teacherId: c.teacher_id,
            name: c.name,
            createdAt: new Date(c.created_at).getTime(),
            updatedAt: new Date(c.updated_at).getTime(),
          }));
          set({ classes });
        }
      },

      fetchQuestionPapers: async () => {
        const { user } = get();
        if (!user?.id) return;
        
        set({ loading: true });
        const { data, error } = await supabase
          .from('qp_metadata')
          .select('*')
          .eq('teacher_id', user.id)
          .order('updated_at', { ascending: false });
        
        if (!error && data) {
          const questionPapers: QuestionPaper[] = data.map(qp => ({
            id: qp.id,
            qpCode: qp.qp_code,
            teacherId: qp.teacher_id,
            title: qp.title,
            date: qp.date,
            maxMarks: qp.max_marks,
            courseId: qp.course_id,
            subjectId: qp.subject_id,
            classId: qp.class_id,
            instructions: qp.instructions,
            isPublished: qp.is_published || false,
            totalMarks: qp.max_marks || 0,
            duration: qp.duration || 0,
            createdAt: new Date(qp.created_at).getTime(),
            updatedAt: new Date(qp.updated_at).getTime(),
          }));
          set({ questionPapers });
        }
        set({ loading: false });
      },

      fetchQuestions: async () => {
        const { user } = get();
        if (!user?.id) return;

        const { data, error } = await supabase
          .from('questions')
          .select('*')
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const questions: Question[] = data.map(q => ({
            id: q.id,
            teacherId: q.teacher_id,
            content: q.content,
            courseId: q.course_id,
            subjectId: q.subject_id,
            classId: q.class_id,
            questionType: q.question_type,
            options: q.options || [],
            difficulty: q.difficulty,
            explanation: q.explanation,
            imageUrl: q.image_url,
            typeHeader: q.type_header,
            createdAt: new Date(q.created_at).getTime(),
            updatedAt: new Date(q.updated_at).getTime(),
          }));
          set({ questions });
        }
      },

      fetchPaperQuestions: async (paperId: string) => {
        const { data, error } = await supabase
          .from('paper_questions')
          .select('*')
          .eq('paper_id', paperId)
          .order('order_index', { ascending: true });

        if (!error && data) {
          const pq: PaperQuestion[] = data.map(pq => ({
            id: pq.id,
            paperId: pq.paper_id,
            questionId: pq.question_id,
            section: pq.section,
            marks: pq.marks,
            orderIndex: pq.order_index,
            createdAt: new Date(pq.created_at).getTime(),
            updatedAt: new Date(pq.updated_at).getTime(),
          }));
          set((state) => {
            const newPaperQuestions = new Map(state.paperQuestions);
            newPaperQuestions.set(paperId, pq);
            return { paperQuestions: newPaperQuestions };
          });
        }
      },

      createCourse: async (name: string) => {
        const { user } = get();
        if (!user?.id) return '';
        
        const id = generateId();
        
        set((state) => ({ courses: [...state.courses, {
          id,
          teacherId: user.id,
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }] }));

        if (user?.id) {
          await supabase.from('courses').insert({
            id,
            teacher_id: user.id,
            name,
          });
        }

        return id;
      },

      updateCourse: async (id: string, name: string) => {
        set((state) => ({
          courses: state.courses.map(c =>
            c.id === id ? { ...c, name, updatedAt: Date.now() } : c
          ),
        }));

        await supabase.from('courses').update({ name }).eq('id', id);
      },

      deleteCourse: async (id: string) => {
        set((state) => ({
          courses: state.courses.filter(c => c.id !== id),
        }));

        await supabase.from('courses').delete().eq('id', id);
      },

      createSubject: async (name: string) => {
        const { user } = get();
        if (!user?.id) return '';
        
        const id = generateId();
        
        set((state) => ({ subjects: [...state.subjects, {
          id,
          teacherId: user.id,
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }] }));

        if (user?.id) {
          await supabase.from('subjects').insert({
            id,
            teacher_id: user.id,
            name,
          });
        }

        return id;
      },

      updateSubject: async (id: string, name: string) => {
        set((state) => ({
          subjects: state.subjects.map(s =>
            s.id === id ? { ...s, name, updatedAt: Date.now() } : s
          ),
        }));

        await supabase.from('subjects').update({ name }).eq('id', id);
      },

      deleteSubject: async (id: string) => {
        set((state) => ({
          subjects: state.subjects.filter(s => s.id !== id),
        }));

        await supabase.from('subjects').delete().eq('id', id);
      },

      createClass: async (name: string) => {
        const { user } = get();
        if (!user?.id) return '';
        
        const id = generateId();
        
        set((state) => ({ classes: [...state.classes, {
          id,
          teacherId: user.id,
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }] }));

        if (user?.id) {
          await supabase.from('classes').insert({
            id,
            teacher_id: user.id,
            name,
          });
        }

        return id;
      },

      updateClass: async (id: string, name: string) => {
        set((state) => ({
          classes: state.classes.map(c =>
            c.id === id ? { ...c, name, updatedAt: Date.now() } : c
          ),
        }));

        await supabase.from('classes').update({ name }).eq('id', id);
      },

      deleteClass: async (id: string) => {
        set((state) => ({
          classes: state.classes.filter(c => c.id !== id),
        }));

        await supabase.from('classes').delete().eq('id', id);
      },

      createQuestionPaper: async (title: string, date?: string, maxMarks?: number, courseId?: string, subjectId?: string, classId?: string, instructions?: string, duration?: number) => {
        const { user } = get();
        if (!user?.id) return '';
        
        const id = generateId();
        
        const newPaper: QuestionPaper = {
          id,
          qpCode: '',
          teacherId: user.id,
          title,
          date,
          maxMarks,
          courseId,
          subjectId,
          classId,
          instructions,
          isPublished: false,
          totalMarks: 0,
          duration,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({ questionPapers: [newPaper, ...state.questionPapers], currentPaperId: id }));

        if (user?.id) {
          await supabase.from('qp_metadata').insert({
            id,
            teacher_id: user.id,
            title,
            date,
            max_marks: maxMarks,
            course_id: courseId,
            subject_id: subjectId,
            class_id: classId,
            instructions: instructions || '',
            is_published: false,
            duration,
          });
        }

        return id;
      },

      updateQuestionPaper: async (id: string, updates: Partial<QuestionPaper>) => {
        set((state) => ({
          questionPapers: state.questionPapers.map(qp =>
            qp.id === id ? { ...qp, ...updates, updatedAt: Date.now() } : qp
          ),
        }));

        const supabaseUpdates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.title !== undefined) supabaseUpdates.title = updates.title;
        if (updates.date !== undefined) supabaseUpdates.date = updates.date;
        if (updates.maxMarks !== undefined) supabaseUpdates.max_marks = updates.maxMarks;
        if (updates.courseId !== undefined) supabaseUpdates.course_id = updates.courseId;
        if (updates.subjectId !== undefined) supabaseUpdates.subject_id = updates.subjectId;
        if (updates.classId !== undefined) supabaseUpdates.class_id = updates.classId;
        if (updates.instructions !== undefined) supabaseUpdates.instructions = updates.instructions;
        if (updates.isPublished !== undefined) supabaseUpdates.is_published = updates.isPublished;
        if (updates.duration !== undefined) supabaseUpdates.duration = updates.duration;

        await supabase.from('qp_metadata').update(supabaseUpdates).eq('id', id);
      },

      deleteQuestionPaper: async (id: string) => {
        set((state) => ({
          questionPapers: state.questionPapers.filter(qp => qp.id !== id),
          currentPaperId: state.currentPaperId === id ? null : state.currentPaperId,
        }));

        await supabase.from('qp_metadata').delete().eq('id', id);
      },

      duplicateQuestionPaper: (id: string) => {
        const paper = get().questionPapers.find(qp => qp.id === id);
        if (!paper) return '';
        
        const newId = generateId();
        const newPaper: QuestionPaper = {
          ...paper,
          id: newId,
          title: `${paper.title} (Copy)`,
          qpCode: '',
          isPublished: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        
        set((state) => ({ questionPapers: [newPaper, ...state.questionPapers] }));
        return newId;
      },

      createQuestion: async (content: string, questionType: QuestionType, options?: string[], courseId?: string, subjectId?: string, classId?: string, difficulty?: Difficulty, explanation?: string, imageUrl?: string) => {
        const { user } = get();
        if (!user?.id) return '';
        
        const id = generateId();
        
        const newQuestion: Question = {
          id,
          teacherId: user.id,
          content,
          courseId,
          subjectId,
          classId,
          questionType,
          options: options || [],
          difficulty: difficulty || 'medium',
          explanation,
          imageUrl,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({ questions: [newQuestion, ...state.questions] }));

        if (user?.id) {
          await supabase.from('questions').insert({
            id,
            teacher_id: user.id,
            content,
            course_id: courseId,
            subject_id: subjectId,
            class_id: classId,
            question_type: questionType,
            options: options || [],
            difficulty: difficulty || 'medium',
            explanation,
            image_url: imageUrl,
          });
        }

        return id;
      },

      updateQuestion: async (id: string, updates: Partial<Question>) => {
        set((state) => ({
          questions: state.questions.map(q =>
            q.id === id ? { ...q, ...updates, updatedAt: Date.now() } : q
          ),
        }));

        const supabaseUpdates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.content !== undefined) supabaseUpdates.content = updates.content;
        if (updates.questionType !== undefined) supabaseUpdates.question_type = updates.questionType;
        if (updates.options !== undefined) supabaseUpdates.options = updates.options;
        if (updates.courseId !== undefined) supabaseUpdates.course_id = updates.courseId;
        if (updates.subjectId !== undefined) supabaseUpdates.subject_id = updates.subjectId;
        if (updates.classId !== undefined) supabaseUpdates.class_id = updates.classId;
        if (updates.difficulty !== undefined) supabaseUpdates.difficulty = updates.difficulty;
        if (updates.explanation !== undefined) supabaseUpdates.explanation = updates.explanation;
        if (updates.imageUrl !== undefined) supabaseUpdates.image_url = updates.imageUrl;
        if (updates.typeHeader !== undefined) supabaseUpdates.type_header = updates.typeHeader;

        const { error } = await supabase.from('questions').update(supabaseUpdates).eq('id', id);
        if (error) console.error('Failed to update question:', error.message);
      },

      deleteQuestion: async (id: string) => {
        set((state) => {
          const newPaperQuestions = new Map(state.paperQuestions);
          for (const [paperId, pqs] of newPaperQuestions) {
            newPaperQuestions.set(paperId, pqs.filter(pq => pq.questionId !== id));
          }
          return {
            questions: state.questions.filter(q => q.id !== id),
            paperQuestions: newPaperQuestions,
          };
        });

        await supabase.from('questions').delete().eq('id', id);
      },

      addQuestionToPaper: async (paperId: string, questionId: string, section: PaperSection = 'A', marks: number = 1) => {
        const id = generateId();
        const paperQuestionsList = get().paperQuestions.get(paperId) || [];
        const orderIndex = paperQuestionsList.length;

        const newPQ: PaperQuestion = {
          id,
          paperId,
          questionId,
          section,
          marks,
          orderIndex,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => {
          const newPaperQuestions = new Map(state.paperQuestions);
          newPaperQuestions.set(paperId, [...paperQuestionsList, newPQ]);
          return { paperQuestions: newPaperQuestions };
        });

        await supabase.from('paper_questions').insert({
          id,
          paper_id: paperId,
          question_id: questionId,
          section,
          marks,
          order_index: orderIndex,
        });

        return id;
      },

      updatePaperQuestion: async (id: string, updates: Partial<PaperQuestion>) => {
        set((state) => {
          const newPaperQuestions = new Map(state.paperQuestions);
          for (const [paperId, pqs] of newPaperQuestions) {
            const updated = pqs.map(pq =>
              pq.id === id ? { ...pq, ...updates, updatedAt: Date.now() } : pq
            );
            newPaperQuestions.set(paperId, updated);
          }
          return { paperQuestions: newPaperQuestions };
        });

        const supabaseUpdates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.section !== undefined) supabaseUpdates.section = updates.section;
        if (updates.marks !== undefined) supabaseUpdates.marks = updates.marks;
        if (updates.orderIndex !== undefined) supabaseUpdates.order_index = updates.orderIndex;

        await supabase.from('paper_questions').update(supabaseUpdates).eq('id', id);
      },

      removeQuestionFromPaper: async (paperId: string, questionId: string) => {
        set((state) => {
          const newPaperQuestions = new Map(state.paperQuestions);
          const pqs = newPaperQuestions.get(paperId) || [];
          newPaperQuestions.set(paperId, pqs.filter(pq => pq.questionId !== questionId));
          return { paperQuestions: newPaperQuestions };
        });

        await supabase.from('paper_questions')
          .delete()
          .eq('paper_id', paperId)
          .eq('question_id', questionId);
      },

      reorderPaperQuestions: async (paperId: string, paperQuestionsList: PaperQuestion[]) => {
        set((state) => {
          const newPaperQuestions = new Map(state.paperQuestions);
          newPaperQuestions.set(paperId, paperQuestionsList);
          return { paperQuestions: newPaperQuestions };
        });

        const updates = paperQuestionsList.map((pq, i) => ({
          id: pq.id,
          order_index: i,
        }));

        await supabase.from('paper_questions').upsert(updates);
      },

      createAndAddQuestion: async (paperId: string, content: string, questionType: QuestionType, options?: string[], section?: PaperSection, marks?: number, courseId?: string, subjectId?: string, classId?: string, difficulty?: Difficulty, explanation?: string, imageUrl?: string, typeHeader?: string) => {
        const { user, questionPapers } = get();
        if (!user?.id) return '';

        const questionId = generateId();
        const pqId = generateId();

        const paper = questionPapers.find(qp => qp.id === paperId);
        const paperQuestionsList = get().paperQuestions.get(paperId) || [];
        const orderIndex = paperQuestionsList.length;

        const newQuestion: Question = {
          id: questionId,
          teacherId: user.id,
          content,
          courseId,
          subjectId: subjectId || paper?.subjectId,
          classId: classId || paper?.classId,
          questionType,
          options: options || [],
          difficulty: difficulty || 'medium',
          explanation,
          imageUrl,
          typeHeader,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const newPQ: PaperQuestion = {
          id: pqId,
          paperId,
          questionId,
          section: section || 'A',
          marks: marks || 1,
          orderIndex,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          questions: [newQuestion, ...state.questions],
          paperQuestions: new Map(state.paperQuestions).set(paperId, [...paperQuestionsList, newPQ]),
        }));

        const { error: qError } = await supabase.from('questions').insert({
          id: questionId,
          teacher_id: user.id,
          content,
          course_id: courseId,
          subject_id: subjectId || paper?.subjectId,
          class_id: classId || paper?.classId,
          question_type: questionType,
          options: options || [],
          difficulty: difficulty || 'medium',
          explanation,
          image_url: imageUrl,
          type_header: typeHeader,
        });
        if (qError) {
          console.error('Failed to insert question:', qError.message);
          set((state) => ({
            questions: state.questions.filter(q => q.id !== questionId),
            paperQuestions: new Map(state.paperQuestions).set(paperId, paperQuestionsList),
          }));
          return '';
        }

        const { error: pqError } = await supabase.from('paper_questions').insert({
          id: pqId,
          paper_id: paperId,
          question_id: questionId,
          section: section || 'A',
          marks: marks || 1,
          order_index: orderIndex,
        });
        if (pqError) {
          console.error('Failed to insert paper_question:', pqError.message);
        }

        return questionId;
      },
    }),
);