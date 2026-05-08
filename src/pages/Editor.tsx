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
import { Rnd } from 'react-rnd';
import {
  Plus,
  Trash2,
  GripVertical,
  Download,
  ArrowLeft,
  Check,
  ListChecks,
  AlignLeft,
  CircleCheck,
  NotebookPen,
  Search,
  Pencil,
  Image as ImageIcon,
  Table2,
} from 'lucide-react';
import { useStore } from '../store';
import type { Question, PaperQuestion, QuestionType, PaperSection, Difficulty } from '../types';

const BLOCK_TYPES: { type: QuestionType; label: string; icon: typeof AlignLeft; description: string; header: string }[] = [
  { type: 'mcq', label: 'Multiple Choice', icon: ListChecks, description: 'Question with options A-D', header: 'Multiple Choice:' },
  { type: 'subjective', label: 'Subjective Question', icon: AlignLeft, description: 'Answer the following', header: 'Answer the following:' },
  { type: 'fillblank', label: 'Fill in the Blank', icon: NotebookPen, description: 'Complete the sentence', header: 'Fill in the blanks:' },
  { type: 'truefalse', label: 'True / False', icon: CircleCheck, description: 'Binary choice question', header: 'True or False:' },
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
  showSectionHeader?: string;
  showTypeHeader?: string;
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

function SortableQuestion({ 
  paperQuestion, 
  question, 
  isSelected, 
  questionNumber, 
  onSelect, 
  onRemove, 
  onEdit,
  showSectionHeader,
  showTypeHeader
}: SortableQuestionProps) {
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
        <button className="hover-action-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit">
          <Pencil size={12} />
        </button>
        <button className="hover-action-btn danger" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Delete">
          <Trash2 size={12} />
        </button>
      </div>

      {/* Clean HTML - this is exactly what prints */}
      <div className="clean-question">
        {showSectionHeader && (
          <div className="section-divider">
            <span>Section {showSectionHeader}</span>
          </div>
        )}
        {showTypeHeader && (
          <div className="type-header">
            <span>{showTypeHeader}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <span className="q-number">{questionNumber}.</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="q-text" dangerouslySetInnerHTML={{ __html: question.content }} />
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
          </div>
          <span className="marks-inline" style={{ flexShrink: 0, marginLeft: 24 }}>{paperQuestion.marks}m</span>
        </div>
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
    updateQuestionPaper,
    createAndAddQuestion,
    updateQuestion,
    deleteQuestion,
  } = useStore();

  const user = useStore((s) => s.user);

  const paper = questionPapers.find(qp => qp.id === id);
  const [selectedPQId, setSelectedPQId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [suggestedSearch, setSuggestedSearch] = useState('');
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
      const quill = quillRef.current.getEditor();
      const range = quill.getSelection();
      const tableModule = quill.getModule('table') as any;
      if (tableModule) {
        quill.insertText(range?.index || quill.getLength() - 1, '\n');
        tableModule.insertTable(tableRows + 1, tableCols);
      }
    }
    setShowTableDialog(false);
  };

  const CustomToolbar = () => (
    <div id="toolbar">
      <span className="ql-formats">
        <button className="ql-bold" />
        <button className="ql-italic" />
        <button className="ql-underline" />
        <button className="ql-strike" />
      </span>
      <span className="ql-formats">
        <button className="ql-list" value="ordered" />
        <button className="ql-list" value="bullet" />
      </span>
      <span className="ql-formats">
        <button className="ql-script" value="sub" />
        <button className="ql-script" value="super" />
      </span>
      <span className="ql-formats">
        <select className="ql-align" />
        <button className="ql-image">
          <ImageIcon size={16} />
        </button>
        <button className="ql-table">
          <Table2 size={16} />
        </button>
        <button className="ql-clean" />
      </span>
    </div>
  );

  const modules = {
    toolbar: {
      container: "#toolbar",
      handlers: {
        table: insertTable
      }
    },
    table: true
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const paperRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const PAGE_HEIGHT = 953;
  const HEADER_ESTIMATE = 190;
  const REST_HEADER_ESTIMATE = 35;

  const [pageRanges, setPageRanges] = useState<Array<{ start: number; end: number }>>([{ start: 0, end: 0 }]);

  useEffect(() => {
    if (id) {
      fetchPaperQuestions(id);
      fetchQuestions();
    }
  }, [id]);

  const paperQuestionsList = useMemo(() => {
    return paperQuestions.get(id || '') || [];
  }, [paperQuestions, id]);

  useEffect(() => {
    if (paperQuestionsList.length === 0) {
      setPageRanges([{ start: 0, end: 0 }]);
      return;
    }
    const raf = requestAnimationFrame(() => {
      if (!measureRef.current) return;
      const items = measureRef.current.querySelectorAll('[data-pq-id]');
      if (items.length === 0) {
        setPageRanges([{ start: 0, end: paperQuestionsList.length }]);
        return;
      }
      let curH = HEADER_ESTIMATE;
      let curStart = 0;
      const ranges: Array<{ start: number; end: number }> = [];
      [...items].forEach((el, i) => {
        const h = el.getBoundingClientRect().height + 16;
        if (curH + h > PAGE_HEIGHT && i > curStart) {
          ranges.push({ start: curStart, end: i });
          curStart = i;
          curH = (ranges.length === 0 ? HEADER_ESTIMATE : REST_HEADER_ESTIMATE) + h;
        } else {
          curH += h;
        }
      });
      ranges.push({ start: curStart, end: paperQuestionsList.length });
      setPageRanges(ranges);
    });
    return () => cancelAnimationFrame(raf);
  }, [paperQuestionsList, questions]);

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

  const handleUpdateHeaderConfig = async (updates: Partial<any>) => {
    if (!paper) return;
    const newConfig = { ...(paper.headerConfig || {}), ...updates };
    await updateQuestionPaper(paper.id, { headerConfig: newConfig });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleUpdateHeaderConfig({ logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
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

  const renderQuestionRange = (startIdx: number, endIdx: number) => {
    return paperQuestionsList.slice(startIdx, endIdx).map((pq, idx) => {
      const globalIndex = startIdx + idx;
      const q = getQuestion(pq.questionId);
      if (!q) return null;

      let showSectionHeader: string | undefined;
      let showTypeHeader: string | undefined;

      const prevPQ = globalIndex > 0 ? paperQuestionsList[globalIndex - 1] : null;
      const prevQ = prevPQ ? getQuestion(prevPQ.questionId) : null;

      if (!prevPQ || prevPQ.section !== pq.section) {
        showSectionHeader = pq.section;
      }

      const currentHeader = q.typeHeader || '';
      const prevHeader = prevQ?.typeHeader || '';
      if (currentHeader && currentHeader !== prevHeader) {
        showTypeHeader = currentHeader;
      }

      let questionNumber = 1;
      for (let i = globalIndex - 1; i >= 0; i--) {
        const itemPQ = paperQuestionsList[i];
        const itemQ = getQuestion(itemPQ.questionId);
        if (itemPQ.section !== pq.section || (itemQ?.typeHeader !== q.typeHeader)) {
          break;
        }
        questionNumber++;
      }

      return (
        <SortableQuestion
          key={pq.id}
          paperQuestion={pq}
          question={q}
          isSelected={selectedPQId === pq.id}
          questionNumber={questionNumber}
          showSectionHeader={showSectionHeader}
          showTypeHeader={showTypeHeader}
          onSelect={() => { setSelectedPQId(pq.id); setDraftType(null); }}
          onRemove={() => handleRemovePQ(pq.id, pq.questionId)}
          onEdit={() => handleEditQuestion()}
        />
      );
    });
  };

  const renderPaperHeader = () => (
    <div className="paper-header" style={{ position: 'relative', minHeight: 180 }}>
      {paper.headerConfig?.logoUrl && (
        <>
          <Rnd
            size={{ width: paper.headerConfig.logoSize || 80, height: 'auto' }}
            position={paper.headerConfig.logoPos || { x: 20, y: 20 }}
            onDragStop={(_e, d) => { void handleUpdateHeaderConfig({ logoPos: { x: d.x, y: d.y } }); }}
            onResizeStop={(_e, _dir, ref) => {
              void handleUpdateHeaderConfig({ logoSize: parseInt(ref.style.width) });
            }}
            bounds="parent"
            className="no-print-handles"
          >
            <img
              src={paper.headerConfig.logoUrl}
              alt="Logo"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </Rnd>
          <img
            className="logo-print-only"
            src={paper.headerConfig.logoUrl}
            alt="Logo"
            style={{
              position: 'absolute',
              left: `${paper.headerConfig.logoPos?.x || 20}px`,
              top: `${paper.headerConfig.logoPos?.y || 20}px`,
              width: `${paper.headerConfig.logoSize || 80}px`,
            }}
          />
        </>
      )}

      <Rnd
        position={paper.headerConfig?.barcodePos || { x: 550, y: 20 }}
        onDragStop={(_e, d) => { void handleUpdateHeaderConfig({ barcodePos: { x: d.x, y: d.y } }); }}
        bounds="parent"
        disableResizing
        className="no-print-handles"
      >
        <div className="barcode-wrapper">
          <div className="barcode-text">QP Code: {paper.qpCode}</div>
        </div>
      </Rnd>

      <div
        className="barcode-print-only"
        style={{
          position: 'absolute',
          left: `${paper.headerConfig?.barcodePos?.x || 550}px`,
          top: `${paper.headerConfig?.barcodePos?.y || 20}px`,
        }}
      >
        <div className="barcode-text">QP Code: {paper.qpCode}</div>
      </div>

      <h1 className="paper-school-name">{user?.schoolName || 'School Name'}</h1>
      <h2 className="paper-exam-title">{paper.title}</h2>
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
  );

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
              <ArrowLeft size={20} style={{ color: 'white' }} />
            </button>
            <h2 className="editor-sidebar-title" style={{ margin: 0, fontSize: 22 }}>{paper.title}</h2>
          </div>
          <p className="editor-sidebar-subtitle">
            {getCourse(paper.courseId)?.name || 'No Course'} • {getSubject(paper.subjectId)?.name || 'No Subject'} • {totalMarks} / {paper.maxMarks || totalMarks} marks{paper.duration ? ` • ${paper.duration} min` : ''}
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

        <div className="block-palette" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <h3 className="block-palette-title">Question Bank</h3>
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
          <div className="block-items" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {suggestedQuestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                <p>No questions found</p>
              </div>
            ) : (
              suggestedQuestions.map(q => (
                <button
                  key={q.id}
                  className="block-item bank-item-suggested"
                  onClick={() => handleAddSuggested(q.id)}
                  style={{ position: 'relative' }}
                >
                  <div className="bank-item-actions">
                    <Plus
                      size={16}
                      onClick={(e) => { e.stopPropagation(); handleAddSuggested(q.id); }}
                      style={{ cursor: 'pointer', flexShrink: 0 }}
                    />
                    <Trash2
                      size={16}
                      onClick={(e) => { e.stopPropagation(); handleDeleteBankQuestion(q.id); }}
                      style={{ cursor: 'pointer', flexShrink: 0 }}
                    />
                  </div>
                  <div className="block-item-info" style={{ paddingRight: 40, minWidth: 0 }}>
                    <span className="block-item-label">
                      {BLOCK_TYPES.find(b => b.type === q.questionType)?.label || q.questionType}
                    </span>
                    <span className="block-item-desc" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {stripHtml(q.content)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CENTER - Clean HTML Paper (WYSIWYG) */}
      <div className="editor-canvas">
        <div className="paper-container" ref={paperRef} id="printable-paper">
          {/* Hidden measurement container */}
          <div
            ref={measureRef}
            style={{
              position: 'absolute', left: -9999, top: 0,
              width: '794px', padding: '20px 40px',
              background: 'white', zIndex: -1, opacity: 0, pointerEvents: 'none',
            }}
          >
            {paperQuestionsList.map((pq) => {
              const q = getQuestion(pq.questionId);
              if (!q) return null;
              const mcqLayout = q.questionType === 'mcq' ? getMcqLayout(q.options || []) : 'vertical';
              return (
                <div key={pq.id} data-pq-id={pq.id} className="clean-question" style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <span className="q-number">1.</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="q-text" dangerouslySetInnerHTML={{ __html: q.content }} />
                      {q.questionType === 'mcq' && q.options && q.options.length > 0 && (
                        <div className={`q-options q-options-${mcqLayout}`}>
                          {q.options.map((opt, i) => (
                            <span key={i} className="q-option">{String.fromCharCode(65 + i)}. {opt}</span>
                          ))}
                        </div>
                      )}
                      {q.questionType === 'truefalse' && (
                        <div className="q-options q-options-horizontal">
                          <span className="q-option">(a) True</span>
                          <span className="q-option">(b) False</span>
                        </div>
                      )}
                    </div>
                    <span className="marks-inline" style={{ flexShrink: 0, marginLeft: 24 }}>{pq.marks}m</span>
                  </div>
                </div>
              );
            })}
          </div>

          {paperQuestionsList.length === 0 ? (
            <div className="paper-page last-page">
              {renderPaperHeader()}
              <div className="empty-paper">
                <div className="empty-paper-icon">
                  <Plus size={28} />
                </div>
                <h3>No questions yet</h3>
                <p>Select a question block from the left panel to get started</p>
              </div>
            </div>
          ) : pageRanges[0].end === 0 ? (
            <div className="paper-page last-page">
              {renderPaperHeader()}
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
                    {renderQuestionRange(0, paperQuestionsList.length)}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          ) : (
            pageRanges.map((range, pageIdx) => {
              const pageIds = paperQuestionsList.slice(range.start, range.end).map(pq => pq.id);
              return (
                <div key={pageIdx} className={`paper-page${pageIdx === pageRanges.length - 1 ? ' last-page' : ''}`}>
                  {pageIdx === 0 ? (
                    renderPaperHeader()
                  ) : (
                    <div style={{
                      textAlign: 'right',
                      fontSize: 11,
                      color: '#888',
                      marginBottom: 16,
                      paddingBottom: 8,
                      borderBottom: '1px solid #ccc',
                    }}>
                      {paper.qpCode} • Continued...
                    </div>
                  )}
                  <div className="paper-questions-list">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={pageIds}
                        strategy={verticalListSortingStrategy}
                      >
                        {renderQuestionRange(range.start, range.end)}
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              );
            })
          )}
          <div className="print-footer">Created using PaperForm</div>
          <div className="print-spacer" />
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="property-panel">
        <div className="property-panel-header">
          <h2 className="property-panel-title">
            {draftType ? (editingQuestionId ? 'Edit Question' : 'Add Question') : selectedPQ ? 'Properties' : 'Page Settings'}
          </h2>
        </div>
        <div className="property-panel-content">
          {!draftType && !selectedPQ && (
            <div className="header-settings">
              <h3 className="block-palette-title" style={{ padding: 0, marginBottom: 12 }}>Paper Metadata</h3>
              <div className="property-field">
                <label className="property-label editor-label">Paper Title</label>
                <input
                  type="text"
                  className="property-input"
                  value={paper.title}
                  onChange={(e) => updateQuestionPaper(paper.id, { title: e.target.value })}
                />
              </div>
              <div className="property-field">
                <label className="property-label editor-label">School/College Name</label>
                <input
                  type="text"
                  className="property-input"
                  value={user?.schoolName || ''}
                  onChange={(e) => {
                    if (user) useStore.getState().setUser({ ...user, schoolName: e.target.value });
                  }}
                  placeholder="Enter school name..."
                />
              </div>
              <div className="property-field">
                <label className="property-label editor-label">School/College Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="property-input"
                  style={{ fontSize: 12 }}
                />
                {paper.headerConfig?.logoUrl && (
                  <button
                    className="btn btn-danger"
                    onClick={() => handleUpdateHeaderConfig({ logoUrl: undefined })}
                    style={{ width: '100%', marginTop: 8, fontSize: 12, padding: '4px 8px' }}
                  >
                    Remove Logo
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label editor-label">Course</label>
                  <select
                    className="property-input"
                    value={paper.courseId || ''}
                    onChange={(e) => updateQuestionPaper(paper.id, { courseId: e.target.value || undefined })}
                  >
                    <option value="">No Course</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label editor-label">Subject</label>
                  <select
                    className="property-input"
                    value={paper.subjectId || ''}
                    onChange={(e) => updateQuestionPaper(paper.id, { subjectId: e.target.value || undefined })}
                  >
                    <option value="">No Subject</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label editor-label">Class</label>
                  <select
                    className="property-input"
                    value={paper.classId || ''}
                    onChange={(e) => updateQuestionPaper(paper.id, { classId: e.target.value || undefined })}
                  >
                    <option value="">No Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label editor-label">Date</label>
                  <input
                    type="date"
                    className="property-input"
                    value={paper.date || ''}
                    onChange={(e) => updateQuestionPaper(paper.id, { date: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label editor-label">Max Marks</label>
                  <input
                    type="number"
                    className="property-input"
                    value={paper.maxMarks || 0}
                    onChange={(e) => updateQuestionPaper(paper.id, { maxMarks: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label editor-label">Duration (min)</label>
                  <input
                    type="number"
                    className="property-input"
                    value={paper.duration || 0}
                    onChange={(e) => updateQuestionPaper(paper.id, { duration: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="property-field">
                <label className="property-label editor-label">Instructions</label>
                <textarea
                  className="property-input"
                  style={{ minHeight: 80, resize: 'vertical' }}
                  value={paper.instructions || ''}
                  onChange={(e) => updateQuestionPaper(paper.id, { instructions: e.target.value })}
                />
              </div>
            </div>
          )}
          {draftType && (
            <>
              <div className="property-field">
                <label className="property-label editor-label">Question Type</label>
                <div className="question-type-badge">{BLOCK_TYPES.find(b => b.type === draftType)?.label || draftType}</div>
              </div>
              <div className="property-field">
                <label className="property-label editor-label">Question Content</label>
                <div className="rich-editor-wrapper">
                  <CustomToolbar />
                  <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={draftContent}
                    onChange={(content) => setDraftContent(content || '')}
                    placeholder="Enter your question..."
                    modules={modules}
                    style={{ background: 'white', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}
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
                  <CustomToolbar />
                  <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={draftContent}
                    onChange={(content) => setDraftContent(content || '')}
                    placeholder="Enter your question..."
                    modules={modules}
                    style={{ background: 'white', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}
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
