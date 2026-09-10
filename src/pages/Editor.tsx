import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
import { MathfieldElement } from 'mathlive';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

async function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error('Canvas is empty');
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
    }, 'image/jpeg');
  });
}


MathfieldElement.fontsDirectory = '/fonts';
MathfieldElement.soundsDirectory = '/sounds';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'math-field': any;
    }
  }
}

declare global {
  interface Window {
    MathJax: any;
  }
}

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
  Search,
  Pencil,
  Image as ImageIcon,
  Table2,
  Keyboard,
  Eye,
  Settings,
  X,
  ChevronUp,
  ChevronDown,
  GitFork,
} from 'lucide-react';
import { useStore } from '../store';
import type { Question, PaperQuestion, QuestionType, PaperSection, Difficulty } from '../types';

const BLOCK_TYPES: { type: QuestionType; label: string; icon: typeof AlignLeft; description: string; header: string }[] = [
  { type: 'mcq', label: 'Multiple Choice', icon: ListChecks, description: 'Question with options A-D', header: 'Multiple Choice:' },
  { type: 'subjective', label: 'Subjective Question', icon: AlignLeft, description: 'Answer the following', header: 'Answer the following:' },
];


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
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onAddSubQuestion?: () => void;
  showSectionHeader?: string;
  sectionNumber?: number;
  sectionMarks?: number;
  canMoveSectionUp?: boolean;
  canMoveSectionDown?: boolean;
  onMoveSectionUp?: (section: string) => void;
  onMoveSectionDown?: (section: string) => void;
  onAddQuestionToSection?: (section: string) => void;
  showTypeHeader?: string;
}

function getMcqLayout(options: string[]): string {
  if (options.length === 0) return 'vertical';

  const hasLargeOption = options.some(opt => {
    // If it contains an image or table, it's very big
    if (opt.includes('<img') || opt.includes('<table')) return true;

    // Check character length of plain text
    const textOnly = stripHtml(opt).trim();
    // 35 characters is a safe threshold for half-width (2x2 grid) padding
    return textOnly.length > 35;
  });

  if (hasLargeOption) return 'vertical';

  return 'grid'; // 2x2 grid is the default
}

function SortableQuestion({
  paperQuestion,
  question,
  isSelected,
  questionNumber,
  onSelect,
  onRemove,
  onEdit,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onAddSubQuestion,
  showSectionHeader,
  canMoveSectionUp,
  canMoveSectionDown,
  onMoveSectionUp,
  onMoveSectionDown,
  onAddQuestionToSection,
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
      data-question-id={question.id}
    >
      {/* Section Divider Header */}
      {showSectionHeader && (
        <div className="section-divider">
          <span>Section {showSectionHeader}</span>
          <div className="section-admin-actions">
            {onAddQuestionToSection && (
              <button
                className="section-add-btn"
                onClick={(e) => { e.stopPropagation(); onAddQuestionToSection(showSectionHeader); }}
                title={`Add Question to Section ${showSectionHeader}`}
              >
                <Plus size={13} />
                <span>Add Question</span>
              </button>
            )}
            {onMoveSectionUp && (
              <button
                className="section-action-icon-btn"
                onClick={(e) => { e.stopPropagation(); onMoveSectionUp(showSectionHeader); }}
                disabled={!canMoveSectionUp}
                title={`Move Section ${showSectionHeader} Up`}
              >
                <ChevronUp size={14} />
              </button>
            )}
            {onMoveSectionDown && (
              <button
                className="section-action-icon-btn"
                onClick={(e) => { e.stopPropagation(); onMoveSectionDown(showSectionHeader); }}
                disabled={!canMoveSectionDown}
                title={`Move Section ${showSectionHeader} Down`}
              >
                <ChevronDown size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Clean HTML - Question Content & Options with Inline Actions */}
      <div className="clean-question">
        {showTypeHeader && (
          <div className="type-header">
            <span>{showTypeHeader}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, position: 'relative' }}>
          <div className="q-drag-handle" {...attributes} {...listeners} title="Drag to reorder">
            <GripVertical size={14} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
            <span className="q-number">
              {questionNumber}.
            </span>
            <div className="q-content-wrapper" style={{ flex: 1, minWidth: 0 }}>
              <div className="q-text" dangerouslySetInnerHTML={{ __html: question.content }} />
              {question.questionType === 'mcq' && question.options && question.options.length > 0 && (
                <div className={`q-options q-options-${mcqLayout}`}>
                  {question.options.map((opt, i) => (
                    <span key={i} className="q-option" data-option-index={i} style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
                      <span style={{ marginRight: '4px' }}>{String.fromCharCode(65 + i)}.</span>
                      <span dangerouslySetInnerHTML={{ __html: opt }} />
                    </span>
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
          </div>

          {/* Right side on the same level: Marks + Question Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 16 }}>
            <span className="marks-inline">
              {paperQuestion.marks}m
            </span>
            <div className="question-card-actions">
              {onAddSubQuestion && (
                <button
                  className="q-subquestion-btn"
                  onClick={(e) => { e.stopPropagation(); onAddSubQuestion(); }}
                  title="Add Subquestion"
                >
                  <GitFork size={13} style={{ transform: 'rotate(90deg)' }} />
                  <span>Subquestion</span>
                </button>
              )}
              {onMoveUp && (
                <button
                  className="q-action-icon-btn"
                  onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                  disabled={!canMoveUp}
                  title="Move Question Up"
                >
                  <ChevronUp size={14} />
                </button>
              )}
              {onMoveDown && (
                <button
                  className="q-action-icon-btn"
                  onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                  disabled={!canMoveDown}
                  title="Move Question Down"
                >
                  <ChevronDown size={14} />
                </button>
              )}
              <button
                className="q-action-icon-btn"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                title="Edit Question"
              >
                <Pencil size={13} />
              </button>
              <button
                className="q-action-icon-btn danger"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                title="Delete Question"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CustomToolbar = ({ id = "toolbar" }: { id?: string }) => (
  <div id={id}>
    <span className="ql-formats">
      <button className="ql-bold" title="Bold" />
      <button className="ql-italic" title="Italic" />
      <button className="ql-underline" title="Underline" />
      <button className="ql-strike" title="Strikethrough" />
    </span>
    <span className="ql-formats">
      <button className="ql-list" value="ordered" title="Numbered List" />
      <button className="ql-list" value="bullet" title="Bullet List" />
    </span>
    <span className="ql-formats">
      <button className="ql-script" value="sub" title="Subscript" />
      <button className="ql-script" value="super" title="Superscript" />
    </span>
    <span className="ql-formats">
      <select className="ql-align" title="Text Alignment">
        <option value="" />
        <option value="center" />
        <option value="right" />
        <option value="justify" />
      </select>
    </span>
    <span className="ql-formats">
      <button className="ql-image" title="Insert Image">
        <ImageIcon size={16} />
      </button>
      <button className="ql-table" title="Insert Table">
        <Table2 size={16} />
      </button>
      <button className="ql-math" title="Insert LaTeX Formula">
        <span style={{ fontSize: 16, fontWeight: 'bold' }}>&sum;</span>
      </button>
      <button className="ql-clean" title="Clear Formatting" />
    </span>
  </div>
);

function FullQuill({ value, onChange, placeholder, openMathDialog, toolbarId = "toolbar" }: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  openMathDialog: (onInsert: (latex: string) => void) => void;
  toolbarId?: string;
}) {
  const quillRef = useRef<ReactQuill>(null);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);

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

  const modules = useMemo(() => ({
    toolbar: {
      container: `#${toolbarId}`,
      handlers: {
        table: () => setShowTableDialog(true),
        math: () => {
          if (!quillRef.current) return;
          const quill = quillRef.current.getEditor();
          const range = quill.getSelection(true) || { index: Math.max(0, quill.getLength() - 1) };
          openMathDialog((latex) => {
            const mathText = `\\(${latex}\\)`;
            quill.insertText(range.index, mathText, 'user');
            quill.setSelection(range.index + mathText.length, 0);
          });
        }
      }
    },
    table: true
  }), [toolbarId, openMathDialog]);

  return (
    <div className="rich-editor-wrapper">
      <CustomToolbar id={toolbarId} />
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        placeholder={placeholder}
        style={{ background: 'white', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}
      />

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
  const [draftOptions, setDraftOptions] = useState<string[]>(['', '', '', '']);
  const [draftSection, setDraftSection] = useState<PaperSection>('A');
  const [draftMarks, setDraftMarks] = useState(1);
  const [draftDifficulty, setDraftDifficulty] = useState<Difficulty>('medium');
  const [draftTypeHeader, setDraftTypeHeader] = useState('');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const [showMathDialog, setShowMathDialog] = useState(false);
  const [showCreatorHub, setShowCreatorHub] = useState(false);
  const [showPaperSettings, setShowPaperSettings] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [mathKeyboardVisible, setMathKeyboardVisible] = useState(false);
  const mathDialogCallbackRef = useRef<((latex: string) => void) | null>(null);
  const mathFieldRef = useRef<any>(null);

  const [editingImage, setEditingImage] = useState<{
    src: string;
    questionId: string;
    isOption: boolean;
    optionIndex?: number;
    originalHtml: string;
    width: number;
    height: number;
    top: number;
    left: number;
    imgElement: HTMLImageElement;
  } | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageResizeWidth, setImageResizeWidth] = useState<number>(0);

  // Track MathLive virtual keyboard visibility
  useEffect(() => {
    const kbd = window.mathVirtualKeyboard;
    if (!kbd) return;
    const handler = () => {
      setMathKeyboardVisible(kbd.visible);
    };
    kbd.addEventListener('geometrychange', handler);
    return () => kbd.removeEventListener('geometrychange', handler);
  }, []);

  const openMathDialog = useCallback((onInsert: (latex: string) => void) => {
    mathDialogCallbackRef.current = onInsert;
    setShowMathDialog(true);
    setTimeout(() => {
      if (mathFieldRef.current) {
        mathFieldRef.current.focus();
      }
    }, 100);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const paperRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      fetchPaperQuestions(id);
      fetchQuestions();
    }
  }, [id, fetchPaperQuestions, fetchQuestions]);

  const paperQuestionsList = useMemo(() => {
    return paperQuestions.get(id || '') || [];
  }, [paperQuestions, id]);

  // Render MathJax formulas in the paper preview and property panel
  useEffect(() => {
    // Dynamically load MathJax if it's not already loaded
    if (!window.MathJax) {
      window.MathJax = {
        tex: {
          inlineMath: [['\\(', '\\)']],
          displayMath: [['$$', '$$']],
          macros: {
            degree: '^\\circ'
          }
        },
        svg: {
          fontCache: 'global'
        },
        options: {
          ignoreHtmlClass: 'ql-editor',
          processHtmlClass: 'tex2jax_process'
        }
      };
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
      script.async = true;
      document.head.appendChild(script);
    } else if (window.MathJax.typesetPromise) {
      // If MathJax is already loaded, re-render the math on the page
      window.MathJax.typesetPromise().catch((err: any) => console.log('MathJax error:', err));
    }
  });



  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleMoveQuestion = async (pqId: string, direction: 'up' | 'down') => {
    if (!id) return;
    const currentIndex = paperQuestionsList.findIndex(pq => pq.id === pqId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= paperQuestionsList.length) return;
    const newList = arrayMove(paperQuestionsList, currentIndex, targetIndex);
    await reorderPaperQuestions(id, newList);
  };

  const distinctSections = useMemo(() => {
    const seen = new Set<string>();
    const res: string[] = [];
    for (const pq of paperQuestionsList) {
      if (!seen.has(pq.section)) {
        seen.add(pq.section);
        res.push(pq.section);
      }
    }
    return res;
  }, [paperQuestionsList]);

  const sectionTotalMarks = useMemo(() => {
    const map: Record<string, number> = {};
    for (const pq of paperQuestionsList) {
      map[pq.section] = (map[pq.section] || 0) + (pq.marks || 0);
    }
    return map;
  }, [paperQuestionsList]);

  const handleMoveSection = async (section: string, direction: 'up' | 'down') => {
    if (!id) return;
    const secIdx = distinctSections.indexOf(section);
    if (secIdx === -1) return;
    const targetSecIdx = direction === 'up' ? secIdx - 1 : secIdx + 1;
    if (targetSecIdx < 0 || targetSecIdx >= distinctSections.length) return;

    const targetSection = distinctSections[targetSecIdx];
    const newOrderSections = [...distinctSections];
    newOrderSections[secIdx] = targetSection;
    newOrderSections[targetSecIdx] = section;

    const grouped: Record<string, PaperQuestion[]> = {};
    for (const s of newOrderSections) grouped[s] = [];
    for (const pq of paperQuestionsList) {
      if (grouped[pq.section]) {
        grouped[pq.section].push(pq);
      } else {
        grouped[pq.section] = [pq];
      }
    }

    const newList: PaperQuestion[] = [];
    for (const s of newOrderSections) {
      if (grouped[s]) newList.push(...grouped[s]);
    }
    for (const pq of paperQuestionsList) {
      if (!newList.some(item => item.id === pq.id)) {
        newList.push(pq);
      }
    }

    await reorderPaperQuestions(id, newList);
  };

  const handleAddQuestionToSection = (section: string) => {
    setDraftSection((section as PaperSection) || 'A');
    setShowCreatorHub(true);
  };

  const handleAddSubQuestion = (parentPQ: PaperQuestion) => {
    const parentQ = getQuestion(parentPQ.questionId);
    setSelectedPQId(null);
    setDraftType(parentQ?.questionType || 'mcq');
    setDraftContent('');
    setDraftOptions(parentQ?.questionType === 'mcq' ? ['', '', '', ''] : []);
    setDraftSection(parentPQ.section);
    setDraftMarks(parentPQ.marks || 1);
    setDraftDifficulty(parentQ?.difficulty || 'medium');
    setDraftTypeHeader('');
    setEditingQuestionId(null);
    setShowCreatorHub(false);
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

  const handleAddOption = () => {
    setDraftOptions(prev => [...prev, '']);
  };

  const handleRemoveOption = (index: number) => {
    setDraftOptions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectBlockType = (type: QuestionType) => {
    setDraftType(type);
    setDraftContent('');
    setDraftOptions(['', '', '', '']);
    setDraftSection(prev => prev || (selectedPQId ? (paperQuestionsList.find(pq => pq.id === selectedPQId)?.section || 'A') : 'A'));
    setDraftMarks(selectedPQId ? (paperQuestionsList.find(pq => pq.id === selectedPQId)?.marks || 1) : 1);
    setDraftDifficulty('medium');
    setDraftTypeHeader('');
    setSelectedPQId(null);
    setShowCreatorHub(false);
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

  const handleEditQuestion = (pqId?: string) => {
    const targetId = pqId || selectedPQId;
    const pq = paperQuestionsList.find(pq => pq.id === targetId);
    if (!pq) return;
    const q = questions.find(q => q.id === pq.questionId);
    if (!q) return;
    setEditingQuestionId(q.id);
    setDraftType(q.questionType);
    setDraftContent(q.content);
    const opts = q.options || [];
    setDraftOptions(opts.length > 0 ? [...opts] : ['', '', '', '']);
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



  const totalMarks = useMemo(() => {
    return paperQuestionsList.reduce((sum, pq) => sum + pq.marks, 0);
  }, [paperQuestionsList]);

  const suggestedQuestions = useMemo(() => {
    // Deduplicate questions by content so the bank doesn't show identical clones
    const uniqueQuestions = [];
    const seenContent = new Set();

    for (const q of questions) {
      const normalized = stripHtml(q.content).replace(/\s+/g, '').toLowerCase();
      if (!seenContent.has(normalized)) {
        seenContent.add(normalized);
        uniqueQuestions.push(q);
      }
    }

    const searchTerms = suggestedSearch.toLowerCase().trim().split(/\s+/).filter(Boolean);

    return uniqueQuestions
      .filter(q => {
        if (searchTerms.length === 0) return true;
        const plainText = stripHtml(q.content).toLowerCase();
        // Question matches if it contains ALL search terms
        return searchTerms.every(term => plainText.includes(term));
      })
      .slice(0, 30);
  }, [questions, suggestedSearch]);

  const handleAddSuggested = async (questionId: string) => {
    if (!id) return;
    const q = questions.find(q => q.id === questionId);
    if (!q) return;
    setSaving(true);
    try {
      // Create a fresh clone so we bypass the unique (paper_id, question_id) database constraint,
      // allowing the user to add the same question multiple times to the same paper.
      await createAndAddQuestion(
        id,
        q.content,
        q.questionType,
        q.options,
        draftSection || 'A',
        1,
        undefined,
        q.subjectId,
        q.classId,
        q.difficulty,
        q.explanation,
        q.imageUrl,
        q.typeHeader || undefined,
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
        if (itemPQ.section !== pq.section) {
          break;
        }
        questionNumber++;
      }

      const secIdx = showSectionHeader ? distinctSections.indexOf(showSectionHeader) : -1;
      const sectionNumber = secIdx !== -1 ? secIdx + 1 : 1;
      const sectionMarks = showSectionHeader ? (sectionTotalMarks[showSectionHeader] || 0) : 0;
      const canMoveSectionUp = secIdx > 0;
      const canMoveSectionDown = secIdx !== -1 && secIdx < distinctSections.length - 1;

      return (
        <SortableQuestion
          key={pq.id}
          paperQuestion={pq}
          question={q}
          isSelected={selectedPQId === pq.id}
          questionNumber={questionNumber}
          showSectionHeader={showSectionHeader}
          sectionNumber={sectionNumber}
          sectionMarks={sectionMarks}
          canMoveSectionUp={canMoveSectionUp}
          canMoveSectionDown={canMoveSectionDown}
          onMoveSectionUp={(sec) => handleMoveSection(sec, 'up')}
          onMoveSectionDown={(sec) => handleMoveSection(sec, 'down')}
          onAddQuestionToSection={handleAddQuestionToSection}
          showTypeHeader={showTypeHeader}
          canMoveUp={globalIndex > 0}
          canMoveDown={globalIndex < paperQuestionsList.length - 1}
          onMoveUp={() => handleMoveQuestion(pq.id, 'up')}
          onMoveDown={() => handleMoveQuestion(pq.id, 'down')}
          onAddSubQuestion={() => handleAddSubQuestion(pq)}
          onSelect={() => { setSelectedPQId(pq.id); setDraftType(null); }}
          onRemove={() => handleRemovePQ(pq.id, pq.questionId)}
          onEdit={() => handleEditQuestion(pq.id)}
        />
      );
    });
  };

  const renderPaperHeader = () => (
    <div className="paper-header" style={{ position: 'relative', paddingBottom: 10, marginBottom: 4 }}>
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
        enableResizing={false}
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

      <h1 className="paper-school-name">{user?.schoolName || 'Institution Name'}</h1>
      <h2 className="paper-exam-title">{paper.title}</h2>
      <div className="paper-info">
        <span>Course: {getCourse(paper.courseId)?.name || '-'}</span>
        <span>Subject: {getSubject(paper.subjectId)?.name || '-'}</span>
        <span>Class: {getClass(paper.classId)?.name || '-'}</span>
        {paper.date && <span>Date: {new Date(paper.date).toLocaleDateString()}</span>}
        {paper.duration && <span>Duration: {paper.duration} min</span>}
        <span>Total Marks: {totalMarks}</span>
      </div>
      {paper.instructions && (
        <div className="paper-instructions">
          <strong>Instructions:</strong>
          <span dangerouslySetInnerHTML={{ __html: paper.instructions }} />
        </div>
      )}
    </div>
  );

  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && !target.classList.contains('logo-print-only') && !target.closest('.rnd-handle')) {
      const qWrapper = target.closest('.rendered-question-item');
      if (qWrapper) {
        const questionId = qWrapper.getAttribute('data-question-id');
        if (questionId) {
          const qOption = target.closest('.q-option');
          const isOption = !!qOption;
          let optionIndex: number | undefined;
          if (isOption) {
            optionIndex = parseInt(qOption.getAttribute('data-option-index') || '0', 10);
          }

          const q = questions.find(qu => qu.id === questionId);
          if (q) {
            const paperContainer = target.closest('.paper-container') as HTMLElement;
            if (!paperContainer) return;

            const containerRect = paperContainer.getBoundingClientRect();
            const imgRect = target.getBoundingClientRect();

            const originalHtml = isOption ? (q.options ? q.options[optionIndex!] : '') : q.content;

            (target as HTMLImageElement).style.opacity = '0';

            setEditingImage({
              src: (target as HTMLImageElement).src,
              questionId,
              isOption,
              optionIndex,
              originalHtml,
              width: imgRect.width,
              height: imgRect.height,
              top: imgRect.top - containerRect.top,
              left: imgRect.left - containerRect.left,
              imgElement: target as HTMLImageElement
            });
            setImageResizeWidth(imgRect.width);
            setCrop(undefined);
            setCompletedCrop(undefined);
          }
        }
      }
    }
  };

  return (
    <div className={`editor-layout ${isPreviewMode ? 'preview-active' : ''}`}>

      {/* TOP TOOLBAR */}
      <div className="editor-top-toolbar">
        <div className="toolbar-left">
          <button className="toolbar-icon-btn" onClick={() => navigate('/')} title="Back to Dashboard">
            <ArrowLeft size={18} />
          </button>
          <div className="toolbar-title-group">
            <h2 className="toolbar-paper-title">{paper.title}</h2>
            <span className="toolbar-paper-meta">
              {getCourse(paper.courseId)?.name || 'No Course'} • {getSubject(paper.subjectId)?.name || 'No Subject'} • {totalMarks} Marks{paper.duration ? ` • ${paper.duration} min` : ''}
            </span>
          </div>
        </div>
        <div className="toolbar-right">
          <button className="toolbar-btn-outlined" onClick={() => setIsPreviewMode(!isPreviewMode)}>
            {isPreviewMode ? <><Pencil size={14} /> Back to Editor</> : <><Eye size={14} /> Student Preview</>}
          </button>
          <button className="toolbar-btn-outlined" onClick={() => setShowPaperSettings(true)}>
            <Settings size={14} /> Paper Settings
          </button>
          <button className="toolbar-btn-accent" onClick={() => setShowCreatorHub(true)}>
            <Plus size={14} /> Add Question
          </button>
          <button className="toolbar-btn-accent" onClick={exportPDF}>
            <Download size={14} /> Export PDF
          </button>
        </div>
      </div>

      {/* CENTER - Clean HTML Paper (WYSIWYG) */}
      <div className="editor-canvas">
        <div className="paper-container" ref={paperRef} id="printable-paper" onClick={handleCanvasClick}>
          {/* Hidden measurement container */}
          <div
            ref={measureRef}
            className="measurement-container"
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
                <p>Click "Add Question" in the toolbar to get started</p>
                <button className="btn btn-primary" onClick={() => setShowCreatorHub(true)} style={{ marginTop: 16 }}>
                  <Plus size={14} style={{ marginRight: 6 }} />
                  Add Question
                </button>
              </div>
            </div>
          ) : (
            <div className="paper-page last-page">
              {renderPaperHeader()}
              {isPreviewMode && (
                <div className="preview-mode-banner">
                  <Eye size={14} /> Student Preview Mode — Admin controls are hidden
                </div>
              )}
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
          )}
          <div className="print-footer">Created using PaperForm</div>
          <div className="print-spacer" />

          {editingImage && (
            <div style={{
              position: 'absolute',
              top: editingImage.top,
              left: editingImage.left,
              zIndex: 1000,
              background: 'rgba(255,255,255,0.9)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              borderRadius: 4,
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8
            }} onClick={(e) => e.stopPropagation()}>
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
              >
                <img
                  ref={imgRef}
                  src={editingImage.src}
                  alt="Crop preview"
                  style={{ width: imageResizeWidth > 0 ? imageResizeWidth : 'auto', height: 'auto', display: 'block', maxWidth: '100%' }}
                />
              </ReactCrop>

              <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'center', alignItems: 'center', padding: '4px 8px' }}>
                <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Width:</span>
                <input
                  type="number"
                  style={{ width: 60, padding: 4, border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}
                  value={Math.round(imageResizeWidth)}
                  onChange={(e) => setImageResizeWidth(Number(e.target.value))}
                />
                <span style={{ fontSize: 12, color: '#666' }}>px</span>

                <button style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center' }} onClick={() => {
                  if (editingImage.imgElement) editingImage.imgElement.style.opacity = '1';
                  setEditingImage(null);
                }} title="Cancel">
                  ✕
                </button>
                <button style={{ background: '#10B981', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }} onClick={async () => {
                  let newSrc = editingImage.src;
                  if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && imgRef.current) {
                    newSrc = await getCroppedImg(imgRef.current, completedCrop);
                  }

                  const parser = new DOMParser();
                  const doc = parser.parseFromString(editingImage.originalHtml, 'text/html');
                  const imgs = doc.querySelectorAll('img');
                  imgs.forEach(img => {
                    if (img.getAttribute('src') === editingImage.src || img.src === editingImage.src) {
                      img.src = newSrc;
                      if (imageResizeWidth > 0) {
                        img.style.width = `${imageResizeWidth}px`;
                      }
                    }
                  });
                  const newHtml = doc.body.innerHTML;

                  if (editingImage.isOption && editingImage.optionIndex !== undefined) {
                    const q = questions.find(q => q.id === editingImage.questionId);
                    if (q) {
                      const newOptions = [...(q.options || [])];
                      newOptions[editingImage.optionIndex] = newHtml;
                      await updateQuestion(q.id, { options: newOptions });
                    }
                  } else {
                    await updateQuestion(editingImage.questionId, { content: newHtml });
                  }

                  if (editingImage.imgElement) editingImage.imgElement.style.opacity = '1';
                  setEditingImage(null);
                  setCrop(undefined);
                  setCompletedCrop(undefined);
                }}>
                  ✓ Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATOR HUB MODAL */}
      {showCreatorHub && (
        <div className="modal-overlay" onClick={() => setShowCreatorHub(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title">Add Question</h2>
              <button className="modal-close-btn" onClick={() => setShowCreatorHub(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-content">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Choose a question type to create, or add from your question bank.
              </p>
              <div className="creator-hub-cards">
                {BLOCK_TYPES.map(({ type, label, icon: Icon, description }) => (
                  <button
                    key={type}
                    className="creator-hub-card"
                    onClick={() => handleSelectBlockType(type)}
                  >
                    <div className="creator-hub-card-icon"><Icon size={20} /></div>
                    <div className="creator-hub-card-info">
                      <span className="creator-hub-card-label">{label}</span>
                      <span className="creator-hub-card-desc">{description}</span>
                    </div>
                    <span className="creator-hub-card-arrow">→</span>
                  </button>
                ))}
              </div>

              {/* Question Bank Section */}
              <div className="creator-hub-bank">
                <h4 className="creator-hub-bank-title">
                  <Search size={14} /> Question Bank
                </h4>
                <div style={{ marginBottom: 12 }}>
                  <input
                    type="text"
                    placeholder="Search your bank..."
                    value={suggestedSearch}
                    onChange={(e) => setSuggestedSearch(e.target.value)}
                    className="creator-hub-search"
                  />
                </div>
                <div className="creator-hub-bank-list">
                  {suggestedQuestions.length === 0 ? (
                    <div className="creator-hub-bank-empty">No questions found</div>
                  ) : (
                    suggestedQuestions.map(q => (
                      <div key={q.id} className="creator-hub-bank-item">
                        <div className="creator-hub-bank-item-info">
                          <span className="creator-hub-bank-item-type">
                            {BLOCK_TYPES.find(b => b.type === q.questionType)?.label || q.questionType}
                          </span>
                          <span className="creator-hub-bank-item-text">
                            {stripHtml(q.content)}
                          </span>
                        </div>
                        <div className="creator-hub-bank-item-actions" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => { handleAddSuggested(q.id); setShowCreatorHub(false); }} title="Add to paper">
                            <Plus size={14} />
                          </button>
                          <button onClick={() => handleDeleteBankQuestion(q.id)} title="Delete from bank" className="danger">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION EDITOR MODAL */}
      {draftType && (
        <div className="modal-overlay" onClick={resetDraft}>
          <div className="modal question-editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="modal-title">
                  {editingQuestionId ? 'Edit Question' : 'Add Question'}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {BLOCK_TYPES.find(b => b.type === draftType)?.label || draftType}
                </p>
              </div>
              <button className="modal-close-btn" onClick={resetDraft}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-content" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label">Section</label>
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
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label">Marks</label>
                  <input
                    type="number"
                    className="property-input"
                    value={draftMarks}
                    onChange={(e) => setDraftMarks(parseInt(e.target.value) || 1)}
                    min={1}
                  />
                </div>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label">Difficulty</label>
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
              </div>
              <div className="property-field">
                <label className="property-label">Question Header Label</label>
                <input
                  type="text"
                  className="property-input"
                  placeholder="e.g., Answer the following:"
                  value={draftTypeHeader}
                  onChange={(e) => setDraftTypeHeader(e.target.value)}
                />
              </div>
              <div className="property-field">
                <label className="property-label">Question Content</label>
                <FullQuill
                  value={draftContent}
                  onChange={(content) => setDraftContent(content)}
                  placeholder="Enter your question..."
                  openMathDialog={openMathDialog}
                  toolbarId="question-toolbar"
                />
              </div>
              {draftType === 'mcq' && (
                <div className="property-field">
                  <label className="property-label">Options</label>
                  {draftOptions.map((opt, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Option {String.fromCharCode(65 + i)}</label>
                        {draftOptions.length > 2 && (
                          <button
                            className="hover-action-btn danger"
                            onClick={() => handleRemoveOption(i)}
                            title={`Remove Option ${String.fromCharCode(65 + i)}`}
                            style={{ padding: '2px 4px' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <FullQuill
                        value={opt}
                        onChange={(val) => {
                          const newOpts = [...draftOptions];
                          newOpts[i] = val;
                          setDraftOptions(newOpts);
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        openMathDialog={openMathDialog}
                        toolbarId={`option-toolbar-${i}`}
                      />
                    </div>
                  ))}
                  <button
                    className="btn btn-secondary"
                    onClick={handleAddOption}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}
                  >
                    <Plus size={14} />
                    Add Option
                  </button>
                </div>
              )}
              {draftType === 'truefalse' && (
                <div className="property-field">
                  <label className="property-label">Answer</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }}>True</button>
                    <button className="btn btn-secondary" style={{ flex: 1 }}>False</button>
                  </div>
                </div>
              )}

            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={resetDraft}>Cancel</button>
              {editingQuestionId ? (
                <button
                  className="btn btn-primary"
                  onClick={handleUpdateQuestion}
                  disabled={saving || !draftContent.trim()}
                >
                  {saving ? 'Updating...' : 'Update Question'}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleAddDraftToPaper}
                  disabled={saving || !draftContent.trim()}
                >
                  {saving ? 'Adding...' : 'Add to Paper'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAPER SETTINGS MODAL */}
      {showPaperSettings && (
        <div className="modal-overlay" onClick={() => setShowPaperSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title">Paper Settings</h2>
              <button className="modal-close-btn" onClick={() => setShowPaperSettings(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-content" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <div className="property-field">
                <label className="property-label">Paper Title</label>
                <input
                  type="text"
                  className="property-input"
                  value={paper.title}
                  onChange={(e) => updateQuestionPaper(paper.id, { title: e.target.value })}
                />
              </div>
              <div className="property-field">
                <label className="property-label">Institution Name</label>
                <input
                  type="text"
                  className="property-input"
                  value={user?.schoolName || ''}
                  onChange={(e) => {
                    if (user) useStore.getState().setUser({ ...user, schoolName: e.target.value });
                  }}
                  placeholder="Enter Institution name..."
                />
              </div>
              <div className="property-field">
                <label className="property-label">Institution Logo</label>
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
                  <label className="property-label">Course</label>
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
                  <label className="property-label">Subject</label>
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
                  <label className="property-label">Class</label>
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
                  <label className="property-label">Date</label>
                  <input
                    type="date"
                    className="property-input"
                    value={paper.date || ''}
                    onChange={(e) => updateQuestionPaper(paper.id, { date: e.target.value })}
                  />
                </div>
              </div>
              <div className="property-field">
                <label className="property-label">Duration (min)</label>
                <input
                  type="number"
                  className="property-input"
                  value={paper.duration || 0}
                  onChange={(e) => updateQuestionPaper(paper.id, { duration: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="property-field">
                <label className="property-label">Instructions</label>
                <FullQuill
                  value={paper.instructions || ''}
                  onChange={(val) => updateQuestionPaper(paper.id, { instructions: val })}
                  placeholder="Enter instructions..."
                  openMathDialog={openMathDialog}
                  toolbarId="instructions-toolbar"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowPaperSettings(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* MathLive Equation Dialog (Rendered last with highest z-index so it always appears above the Question Modal) */}
      {showMathDialog && (
        <div
          className="modal-overlay math-dialog-overlay"
          style={{
            zIndex: 10000,
            ...(mathKeyboardVisible ? { alignItems: 'flex-start', paddingTop: '8vh' } : {})
          }}
          onClick={() => {
            if (window.mathVirtualKeyboard) window.mathVirtualKeyboard.hide();
            setShowMathDialog(false);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, zIndex: 10001 }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title">Insert Math Formula</h2>
              <button
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.mathVirtualKeyboard) {
                    if (window.mathVirtualKeyboard.visible) {
                      window.mathVirtualKeyboard.hide();
                    } else {
                      window.mathVirtualKeyboard.show();
                    }
                  }
                }}
                title="Toggle Virtual Keyboard"
              >
                <Keyboard size={14} /> {mathKeyboardVisible ? 'Hide Keyboard' : 'Keyboard'}
              </button>
            </div>
            <div className="modal-content">
              <div className="property-field">
                <label className="property-label">Visual Editor (MathLive)</label>
                <math-field
                  ref={mathFieldRef}
                  math-virtual-keyboard-policy="manual"
                  style={{
                    fontSize: '24px',
                    padding: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    width: '100%',
                    backgroundColor: 'white',
                    color: 'black',
                    minHeight: '80px'
                  }}
                />
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                  Click inside the field to type or use the virtual keyboard. You can also paste LaTeX.
                </p>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => {
                if (window.mathVirtualKeyboard) window.mathVirtualKeyboard.hide();
                setShowMathDialog(false);
              }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                console.log('Insert Formula button clicked', {
                  callback: !!mathDialogCallbackRef.current,
                  mathFieldRef: !!mathFieldRef.current,
                  value: mathFieldRef.current?.value
                });
                if (mathDialogCallbackRef.current && mathFieldRef.current) {
                  mathDialogCallbackRef.current(mathFieldRef.current.value);
                }
                if (window.mathVirtualKeyboard) window.mathVirtualKeyboard.hide();
                setShowMathDialog(false);
              }}>Insert Formula</button>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <div className="toast-notification">
          <Check size={18} />
          {toastMessage}
        </div>
      )}

    </div>
  );
}
