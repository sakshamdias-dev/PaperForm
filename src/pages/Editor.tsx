import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  Plus,
  Trash2,
  GripVertical,
  Download,
  ArrowLeft,
  Check,
  ListChecks,
  AlignLeft,
  CheckSquare,
  CircleCheck,
  NotebookPen,
  Search,
  Pencil,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useStore } from '../store';
import type { Question, PaperQuestion, QuestionType, PaperSection, Difficulty } from '../types';

const BLOCK_TYPES: { type: QuestionType; label: string; icon: typeof AlignLeft; description: string; header: string }[] = [
  { type: 'mcq', label: 'Multiple Choice', icon: ListChecks, description: 'Question with options A-D', header: 'Multiple Choice:' },
  { type: 'subjective', label: 'Subjective Question', icon: AlignLeft, description: 'Answer the following', header: 'Answer the following:' },
  { type: 'fillblank', label: 'Fill in the Blank', icon: NotebookPen, description: 'Complete the sentence', header: 'Fill in the blanks:' },
  { type: 'truefalse', label: 'True / False', icon: CircleCheck, description: 'Binary choice question', header: 'True or False:' },
  { type: 'match', label: 'Match the Following', icon: CheckSquare, description: 'Match items in columns', header: 'Match the following:' },
];

function getTypeHeader(type: QuestionType): string {
  return BLOCK_TYPES.find(b => b.type === type)?.header || type;
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

interface SortableQuestionProps {
  paperQuestion: PaperQuestion;
  question: Question;
  isSelected: boolean;
  questionNumber: number;
  onSelect: () => void;
  onRemove: () => void;
  onEdit: () => void;
}

function getMaxWordsInOptions(options: string[]): number {
  return Math.max(...options.map(o => o.trim().split(/\s+/).filter(Boolean).length));
}

function getMcqLayout(options: string[]): string {
  if (options.length === 0) return 'vertical';
  const maxWords = getMaxWordsInOptions(options);
  if (maxWords > 5) return 'vertical';
  if (maxWords > 2) return 'grid';
  return 'horizontal';
}

function SortableQuestion({ paperQuestion, question, isSelected, questionNumber, onSelect, onRemove, onEdit }: SortableQuestionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: paperQuestion.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const mcqLayout = question.questionType === 'mcq' ? getMcqLayout(question.options || []) : 'vertical';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rendered-question-item ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      {/* Admin overlay - hidden on print */}
      <div className="admin-overlay-left">
        <div className="drag-handle" {...attributes} {...listeners}>
          <GripVertical size={14} />
        </div>
      </div>
      <div className="admin-overlay-right">
        <span className="marks-text">{paperQuestion.marks} marks</span>
        <button className="hover-action-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit">
          <Pencil size={12} />
        </button>
        <button className="hover-action-btn danger" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Delete">
          <Trash2 size={12} />
        </button>
      </div>

       {/* Clean HTML - this is exactly what prints */}
       <div className="clean-question">
         <span className="q-number">{questionNumber}.</span>
         <span className="q-text" dangerouslySetInnerHTML={{ __html: question.content }} />
        {question.questionType === 'mcq' && question.options && question.options.length > 0 && (
          <div className={`q-options q-options-${mcqLayout}`}>
            {question.options.map((opt, i) => (
              <span key={i} className="q-option">{String.fromCharCode(65 + i)}. {opt}</span>
            ))}
          </div>
        )}
        {question.questionType === 'truefalse' && (
          <div className="q-options q-options-horizontal">
            <span className="q-option">(a) True</span>
            <span className="q-option">(b) False</span>
          </div>
        )}
        {/* {(question.questionType === 'subjective' || question.questionType === 'fillblank') && (
          <div className="q-answer-space" />
        )} */}
      </div>
    </div>
  );
}

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    questionPapers,
    questions,
    paperQuestions,
    courses,
    subjects,
    classes,
    fetchPaperQuestions,
    fetchQuestions,
    removeQuestionFromPaper,
    reorderPaperQuestions,
    updatePaperQuestion,
    createAndAddQuestion,
    updateQuestion,
    deleteQuestion,
  } = useStore();

  const paper = questionPapers.find(qp => qp.id === id);
  const [selectedPQId, setSelectedPQId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [suggestedSearch, setSuggestedSearch] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  const [draftType, setDraftType] = useState<QuestionType | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [draftOptions, setDraftOptions] = useState(['', '', '', '']);
  const [draftSection, setDraftSection] = useState<PaperSection>('A');
  const [draftMarks, setDraftMarks] = useState(1);
  const [draftDifficulty, setDraftDifficulty] = useState<Difficulty>('medium');
  const [draftTypeHeader, setDraftTypeHeader] = useState('');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const quillRef = useRef<ReactQuill>(null);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);

  const insertTable = () => {
    setShowTableDialog(true);
  };

  const confirmTableInsert = () => {
    if (quillRef.current && tableRows > 0 && tableCols > 0) {
      let tableHtml = '<table>';
      // Add header row
      tableHtml += '<thead><tr>';
      for (let i = 0; i < tableCols; i++) {
        tableHtml += `<th>Header ${i + 1}</th>`;
      }
      tableHtml += '</tr></thead><tbody>';
      // Add data rows
      for (let r = 0; r < tableRows; r++) {
        tableHtml += '<tr>';
        for (let c = 0; c < tableCols; c++) {
          tableHtml += `<td>Cell ${r * tableCols + c + 1}</td>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table><p><br></p>';

      const quill = quillRef.current.getEditor();
      const range = quill.getSelection();
      quill.clipboard.dangerouslyPasteHTML(range?.index || 0, tableHtml);
    }
    setShowTableDialog(false);
  };

  const modules = {
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', { 'script': 'sub'}, { 'script': 'super'}, 'clean', { 'list': 'ordered'}, { 'list': 'bullet' }, 'image', 'link', 'table']
      ],
      handlers: {
        table: insertTable
      }
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      fetchPaperQuestions(id);
      fetchQuestions();
    }
  }, [id]);

  const paperQuestionsList = useMemo(() => {
    return paperQuestions.get(id || '') || [];
  }, [paperQuestions, id]);

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && id) {
      const oldIndex = paperQuestionsList.findIndex(pq => pq.id === active.id);
      const newIndex = paperQuestionsList.findIndex(pq => pq.id === over.id);
      const newList = arrayMove(paperQuestionsList, oldIndex, newIndex);
      await reorderPaperQuestions(id, newList);
    }
  };

  const handleSelectBlockType = (type: QuestionType) => {
    setDraftType(type);
    setDraftContent('');
    setDraftOptions(['', '', '', '']);
    setDraftSection(selectedPQId ? (paperQuestionsList.find(pq => pq.id === selectedPQId)?.section || 'A') : 'A');
    setDraftMarks(selectedPQId ? (paperQuestionsList.find(pq => pq.id === selectedPQId)?.marks || 1) : 1);
    setDraftDifficulty('medium');
    setDraftTypeHeader(getTypeHeader(type));
    setSelectedPQId(null);
  };

  const handleAddDraftToPaper = async () => {
    if (!id || !draftType || !draftContent.trim()) return;
    setSaving(true);
    try {
      const options = draftType === 'mcq' ? draftOptions.filter(o => o.trim()) : [];
      const result = await createAndAddQuestion(
        id,
        draftContent.trim(),
        draftType,
        options.length > 0 ? options : undefined,
        draftSection,
        draftMarks,
        undefined,
        paper?.subjectId,
        paper?.classId,
        draftDifficulty,
        undefined,
        undefined,
        draftTypeHeader || undefined,
      );
      if (result) {
        showToastMessage('Question added to paper!');
        setDraftType(null);
        setDraftContent('');
        setDraftOptions(['', '', '', '']);
        setEditingQuestionId(null);
      } else {
        showToastMessage('Failed to add question. Check console.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestionId || !draftType || !draftContent.trim()) return;
    setSaving(true);
    try {
      const options = draftType === 'mcq' ? draftOptions.filter(o => o.trim()) : [];
      const pq = paperQuestionsList.find(p => p.questionId === editingQuestionId);
      if (pq) {
        handleUpdatePQ(pq.id, draftSection, draftMarks);
      }
      await updateQuestion(editingQuestionId, {
        content: draftContent.trim(),
        questionType: draftType,
        options: options.length > 0 ? options : undefined,
        difficulty: draftDifficulty,
        typeHeader: draftTypeHeader || undefined,
      });
      showToastMessage('Question updated!');
      setEditingQuestionId(null);
      setDraftType(null);
      setDraftContent('');
      setDraftOptions(['', '', '', '']);
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePQ = (_pqId: string, questionId: string) => {
    if (id) {
      removeQuestionFromPaper(id, questionId);
      if (selectedPQId === _pqId) setSelectedPQId(null);
      showToastMessage('Question removed');
    }
  };

  const handleUpdatePQ = (pqId: string, section: PaperSection, marks: number) => {
    updatePaperQuestion(pqId, { section, marks });
  };

  const handleEditQuestion = () => {
    const pq = paperQuestionsList.find(pq => pq.id === selectedPQId);
    if (!pq) return;
    const q = questions.find(q => q.id === pq.questionId);
    if (!q) return;
    setEditingQuestionId(q.id);
    setDraftType(q.questionType);
    setDraftContent(q.content);
    const opts = q.options || [];
    setDraftOptions([opts[0] || '', opts[1] || '', opts[2] || '', opts[3] || '']);
    setDraftSection(pq.section);
    setDraftMarks(pq.marks);
    setDraftDifficulty(q.difficulty || 'medium');
    setDraftTypeHeader(q.typeHeader || '');
    setSelectedPQId(null);
  };

  const resetDraft = () => {
    setDraftType(null);
    setEditingQuestionId(null);
    setDraftContent('');
    setDraftOptions(['', '', '', '']);
    setDraftTypeHeader('');
  };

  const getQuestion = (questionId: string) => questions.find(q => q.id === questionId);
  const getCourse = (id?: string) => courses.find(c => c.id === id);
  const getSubject = (id?: string) => subjects.find(s => s.id === id);
  const getClass = (id?: string) => classes.find(c => c.id === id);

  const selectedPQ = useMemo(() => {
    return paperQuestionsList.find(pq => pq.id === selectedPQId);
  }, [paperQuestionsList, selectedPQId]);

  const selectedQuestion = useMemo(() => {
    if (!selectedPQ) return null;
    return questions.find(q => q.id === selectedPQ.questionId);
  }, [selectedPQ, questions]);

  const totalMarks = useMemo(() => {
    return paperQuestionsList.reduce((sum, pq) => sum + pq.marks, 0);
  }, [paperQuestionsList]);

  const sequentialRenderedList = useMemo(() => {
    const items: (
      | { type: 'section'; section: PaperSection }
      | { type: 'header'; header: string }
      | { type: 'question'; pq: PaperQuestion; q: Question; questionNumber: number }
    )[] = [];
    let lastHeader = '';
    let questionCounter = 0;
    let lastSection: PaperSection | null = null;
    paperQuestionsList.forEach((pq) => {
      const q = getQuestion(pq.questionId);
      if (!q) return;
      if (pq.section !== lastSection) {
        items.push({ type: 'section' as const, section: pq.section });
        lastSection = pq.section;
        questionCounter = 0;
        lastHeader = '';
      }
      const currentHeader = q.typeHeader || '';
      if (currentHeader && currentHeader !== lastHeader) {
        items.push({ type: 'header' as const, header: currentHeader });
        lastHeader = currentHeader;
        questionCounter = 0;
      }
      questionCounter++;
      items.push({ type: 'question' as const, pq, q, questionNumber: questionCounter });
    });
    return items;
  }, [paperQuestionsList]);

  const suggestedQuestions = useMemo(() => {
    return questions
      .filter(q => !suggestedSearch || q.content.toLowerCase().includes(suggestedSearch.toLowerCase()))
      .slice(0, 15);
  }, [questions, suggestedSearch]);

  const handleAddSuggested = async (questionId: string) => {
    if (!id) return;
    const q = questions.find(q => q.id === questionId);
    if (!q) return;
    setSaving(true);
    try {
      await createAndAddQuestion(
        id,
        q.content,
        q.questionType,
        q.options,
        'A',
        1,
        undefined,
        q.subjectId,
        q.classId,
        q.difficulty,
        undefined,
        undefined,
        q.typeHeader || getTypeHeader(q.questionType),
      );
      showToastMessage('Question added from bank!');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBankQuestion = async (questionId: string) => {
    await deleteQuestion(questionId);
    showToastMessage('Question deleted from bank');
  };

  const exportPDF = () => {
    window.print();
  };

  if (!paper) {
    return (
      <div className="editor-layout" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p>Paper not found</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go to Dashboard</button>
      </div>
    );
  }

   return (
    <div className="editor-layout">
      {/* Table Insertion Dialog */}
      {showTableDialog && (
        <div className="modal-overlay" onClick={() => setShowTableDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title">Insert Table</h2>
            </div>
            <div className="modal-content">
              <div className="property-field">
                <label className="property-label">Rows</label>
                <input
                  type="number"
                  className="property-input"
                  value={tableRows}
                  onChange={(e) => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                />
              </div>
              <div className="property-field">
                <label className="property-label">Columns</label>
                <input
                  type="number"
                  className="property-input"
                  value={tableCols}
                  onChange={(e) => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowTableDialog(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmTableInsert}>Insert Table</button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR */}
      <div className="editor-sidebar">
        <div className="editor-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <button onClick={() => navigate('/')} style={{ padding: 4 }}>
              <ArrowLeft size={20} />
            </button>
            <h2 className="editor-sidebar-title" style={{ margin: 0 }}>{paper.title}</h2>
          </div>
          <p className="editor-sidebar-subtitle">
            {getCourse(paper.courseId)?.name || 'No Course'} • {getSubject(paper.subjectId)?.name || 'No Subject'}
          </p>
          <p className="editor-sidebar-subtitle">
            {paper.qpCode} • {totalMarks} / {paper.maxMarks || totalMarks} marks{paper.duration ? ` • ${paper.duration} min` : ''}
          </p>
        </div>

        <div className="block-palette">
          <h3 className="block-palette-title">Question Blocks</h3>
          <div className="block-items">
            {BLOCK_TYPES.map(({ type, label, icon: Icon, description }) => (
              <button
                key={type}
                className={`block-item ${draftType === type ? 'active' : ''}`}
                onClick={() => handleSelectBlockType(type)}
              >
                <div className="block-item-icon"><Icon size={16} /></div>
                <div className="block-item-info">
                  <span className="block-item-label">{label}</span>
                  <span className="block-item-desc">{description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="block-palette" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column' }}>
          <button
            className="suggested-toggle"
            onClick={() => setSuggestionsOpen(!suggestionsOpen)}
          >
            <span className="suggested-toggle-label">Suggested Questions</span>
            {suggestionsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <div className={`suggested-content${suggestionsOpen ? ' expanded' : ''}`}>
            <div style={{ padding: '0 12px 8px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input
                  type="text"
                  placeholder="Search your bank..."
                  value={suggestedSearch}
                  onChange={(e) => setSuggestedSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: 28, fontSize: 12 }}
                  className="property-input"
                />
              </div>
            </div>
            <div className="question-bank-list">
              {suggestedQuestions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                  <p>No questions in your bank yet</p>
                  <p>Create one using the blocks above</p>
                </div>
              ) : (
                suggestedQuestions.map(q => (
                  <div
                    key={q.id}
                    className="question-bank-item"
                  >
                    <div
                      className="question-bank-item-content"
                      onClick={() => handleAddSuggested(q.id)}
                    >
                      <div className="question-bank-item-top">
                        <span className="question-type-badge">{q.questionType}</span>
                        <div className="bank-action-btns">
                          <button
                            className="bank-add-btn"
                            onClick={(e) => { e.stopPropagation(); handleAddSuggested(q.id); }}
                            title="Add to paper"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            className="bank-delete-btn"
                            onClick={(e) => { e.stopPropagation(); handleDeleteBankQuestion(q.id); }}
                            title="Delete from bank"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <p>{stripHtml(q.content).slice(0, 80)}{stripHtml(q.content).length > 80 ? '...' : ''}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CENTER - Clean HTML Paper (WYSIWYG) */}
      <div className="editor-canvas">
        <div className="paper-container" ref={paperRef} id="printable-paper">
          <div className="paper-header">
            <h1 className="paper-school-name">Question Paper</h1>
            <h2 className="paper-exam-title">{paper.title}</h2>
            {paper.qpCode && <p className="paper-info">{paper.qpCode}</p>}
            <div className="paper-info">
              <span>Course: {getCourse(paper.courseId)?.name || '-'}</span>
              <span>Subject: {getSubject(paper.subjectId)?.name || '-'}</span>
              <span>Class: {getClass(paper.classId)?.name || '-'}</span>
              {paper.date && <span>Date: {new Date(paper.date).toLocaleDateString()}</span>}
              {paper.duration && <span>Duration: {paper.duration} min</span>}
              <span>Marks: {totalMarks} / {paper.maxMarks || totalMarks}</span>
            </div>
            {paper.instructions && (
              <div className="paper-instructions">
                <strong>Instructions:</strong> {paper.instructions}
              </div>
            )}
          </div>

          {paperQuestionsList.length === 0 ? (
            <div className="empty-paper">
              <div className="empty-paper-icon">
                <Plus size={28} />
              </div>
              <h3>No questions yet</h3>
              <p>Select a question block from the left panel to get started</p>
            </div>
          ) : (
            <div className="paper-questions-list">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={paperQuestionsList.map(pq => pq.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sequentialRenderedList.map((item) => {
                    if (item.type === 'section') {
                      return (
                        <div key={`section-${item.section}`} className="section-divider">
                          <span>Section {item.section}</span>
                        </div>
                      );
                    }
                    if (item.type === 'header') {
                      return (
                        <div key={item.header} className="type-header">
                          <span>{item.header}</span>
                        </div>
                      );
                    }
                    const globalIndex = item.questionNumber;
                    return (
                      <SortableQuestion
                        key={item.pq.id}
                        paperQuestion={item.pq}
                        question={item.q}
                        isSelected={selectedPQId === item.pq.id}
                        questionNumber={globalIndex}
                        onSelect={() => { setSelectedPQId(item.pq.id); setDraftType(null); }}
                        onRemove={() => handleRemovePQ(item.pq.id, item.pq.questionId)}
                        onEdit={() => handleEditQuestion()}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="property-panel">
        <div className="property-panel-header">
          <h2 className="property-panel-title">
            {draftType ? (editingQuestionId ? 'Edit Question' : 'Add Question') : selectedPQ ? 'Properties' : 'Properties'}
          </h2>
        </div>
        <div className="property-panel-content">
          {draftType && (
            <>
              <div className="property-field">
                <label className="property-label editor-label">Question Type</label>
                <div className="question-type-badge">{BLOCK_TYPES.find(b => b.type === draftType)?.label || draftType}</div>
              </div>
              <div className="property-field">
                <label className="property-label editor-label">Question Content</label>
                <div className="rich-editor-wrapper">
                  <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={draftContent}
                    onChange={(content) => setDraftContent(content || '')}
                    placeholder="Enter your question..."
                    modules={modules}
                    style={{ background: 'white', borderRadius: 'var(--radius-md)' }}
                  />
                </div>
              </div>
              <div className="property-field">
                <label className="property-label editor-label">Section Header Label</label>
                <input
                  type="text"
                  className="property-input"
                  placeholder="e.g., Answer the following:"
                  value={draftTypeHeader}
                  onChange={(e) => setDraftTypeHeader(e.target.value)}
                  style={{ marginBottom: 6 }}
                />
              </div>
              {draftType === 'mcq' && (
                <div className="property-field">
                  <label className="property-label editor-label">Options</label>
                  {draftOptions.map((opt, i) => (
                    <input
                      key={i}
                      type="text"
                      className="property-input"
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...draftOptions];
                        newOpts[i] = e.target.value;
                        setDraftOptions(newOpts);
                      }}
                      style={{ marginBottom: 6 }}
                    />
                  ))}
                </div>
              )}
              {draftType === 'truefalse' && (
                <div className="property-field">
                  <label className="property-label editor-label">Answer</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }}>True</button>
                    <button className="btn btn-secondary" style={{ flex: 1 }}>False</button>
                  </div>
                </div>
              )}
              <div className="property-field">
                <label className="property-label editor-label">Section</label>
                <select
                  className="property-input"
                  value={draftSection}
                  onChange={(e) => setDraftSection(e.target.value as PaperSection)}
                >
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                  <option value="D">Section D</option>
                </select>
              </div>
              <div className="property-field">
                <label className="property-label editor-label">Marks</label>
                <input
                  type="number"
                  className="property-input"
                  value={draftMarks}
                  onChange={(e) => setDraftMarks(parseInt(e.target.value) || 1)}
                  min={1}
                />
              </div>
              <div className="property-field">
                <label className="property-label editor-label">Difficulty</label>
                <select
                  className="property-input"
                  value={draftDifficulty}
                  onChange={(e) => setDraftDifficulty(e.target.value as Difficulty)}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              {editingQuestionId ? (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={handleUpdateQuestion}
                    disabled={saving || !draftContent.trim()}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    {saving ? 'Updating...' : 'Update Question'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={resetDraft}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={handleAddDraftToPaper}
                    disabled={saving || !draftContent.trim()}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    {saving ? 'Adding...' : 'Add to Paper'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={resetDraft}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </>
          )}

          {!draftType && selectedPQ && selectedQuestion && (
            <>
              <div className="property-field">
                <label className="property-label editor-label">Question Content</label>
                <div className="rich-editor-wrapper">
                  <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={draftContent}
                    onChange={(content) => setDraftContent(content || '')}
                    placeholder="Enter your question..."
                    modules={modules}
                    style={{ background: 'white', borderRadius: 'var(--radius-md)' }}
                  />
                </div>
              </div>
              <div className="property-field">
                <label className="property-label editor-label">Section</label>
                <select
                  className="property-input"
                  value={selectedPQ.section}
                  onChange={(e) => handleUpdatePQ(selectedPQ.id, e.target.value as PaperSection, selectedPQ.marks)}
                >
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                  <option value="D">Section D</option>
                </select>
              </div>
              <div className="property-field">
                <label className="property-label editor-label">Marks</label>
                <input
                  type="number"
                  className="property-input"
                  value={selectedPQ.marks}
                  onChange={(e) => handleUpdatePQ(selectedPQ.id, selectedPQ.section, parseInt(e.target.value) || 1)}
                  min={1}
                />
              </div>
              <div className="property-field">
                <label className="property-label editor-label">Question Content</label>
                <div className="question-content-preview" dangerouslySetInnerHTML={{ __html: selectedQuestion.content }} />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleEditQuestion}
                style={{ width: '100%', marginTop: 8 }}
              >
                Edit Question Content
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedPQId(null)}
                style={{ width: '100%', marginTop: 8 }}
              >
                Deselect
              </button>
            </>
          )}

          {!draftType && !selectedPQ && (
            <div className="no-selection">
              <div className="no-selection-icon">
                <Plus size={24} />
              </div>
              <h3>Select or Create</h3>
              <p>Click a question block on the left to create one, or click a question in the paper to edit</p>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM TOOLBAR */}
      <div className="editor-toolbar">
        <button className="toolbar-btn primary" onClick={exportPDF}>
          <Download size={18} />
          Export PDF
        </button>
      </div>

      {showToast && (
        <div className="toast-notification">
          <Check size={18} />
          {toastMessage}
        </div>
      )}
    </div>
  );
}
