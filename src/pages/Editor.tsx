import { useState, useMemo, useEffect } from 'react';
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
import {
  Plus,
  Trash2,
  GripVertical,
  Download,
  ChevronDown,
  List,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { useStore } from '../store';
import type { Question, PaperQuestion, QuestionType, PaperSection } from '../types';
import { jsPDF } from 'jspdf';

interface QuestionBankItemProps {
  question: Question;
  isSelected: boolean;
  onSelect: () => void;
}

function QuestionBankItem({ question, isSelected, onSelect }: QuestionBankItemProps) {
  return (
    <div
      className={`question-bank-item ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="question-bank-item-content">
        <span className="question-type-badge">{question.questionType}</span>
        <p>{question.content.slice(0, 100)}{question.content.length > 100 ? '...' : ''}</p>
      </div>
    </div>
  );
}

interface PaperQuestionItemProps {
  paperQuestion: PaperQuestion;
  question: Question | undefined;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function SortablePaperQuestion({ paperQuestion, question, isSelected, onSelect, onRemove }: PaperQuestionItemProps) {
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

  if (!question) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`paper-question-wrapper ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="drag-handle" {...attributes} {...listeners}>
        <GripVertical size={16} />
      </div>
      <div className="paper-question-content">
        <span className="paper-question-section">Section {paperQuestion.section}</span>
        <span className="paper-question-marks">{paperQuestion.marks} marks</span>
        <p>{question.content.slice(0, 80)}{question.content.length > 80 ? '...' : ''}</p>
        <span className="question-type-badge small">{question.questionType}</span>
      </div>
      <div className="paper-question-actions">
        <button className="block-action-btn danger" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <Trash2 size={14} />
        </button>
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
    addQuestionToPaper,
    updatePaperQuestion,
    removeQuestionFromPaper,
    reorderPaperQuestions,
  } = useStore();

  const paper = questionPapers.find(qp => qp.id === id);
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [selectedPQId, setSelectedPQId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [bankFilterSubject, setBankFilterSubject] = useState('');
  const [bankFilterType, setBankFilterType] = useState<QuestionType | ''>('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (id) {
      fetchPaperQuestions(id);
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

  const handleAddQuestion = (questionId: string) => {
    if (id) {
      addQuestionToPaper(id, questionId, 'A', 1);
      showToastMessage('Question added to paper!');
    }
  };

  const handleUpdatePQ = (pqId: string, section: PaperSection, marks: number) => {
    updatePaperQuestion(pqId, { section, marks });
    showToastMessage('Question updated!');
  };

  const handleRemovePQ = (_pqId: string, questionId: string) => {
    if (id) {
      removeQuestionFromPaper(id, questionId);
      showToastMessage('Question removed');
    }
  };

  const getQuestion = (questionId: string) => questions.find(q => q.id === questionId);
  const getCourse = (id?: string) => courses.find(c => c.id === id);
  const getSubject = (id?: string) => subjects.find(s => s.id === id);
  const getClass = (id?: string) => classes.find(c => c.id === id);

  const filteredQuestions = useMemo(() => {
    return questions
      .filter(q => !bankSearch || q.content.toLowerCase().includes(bankSearch.toLowerCase()))
      .filter(q => !bankFilterSubject || q.subjectId === bankFilterSubject)
      .filter(q => !bankFilterType || q.questionType === bankFilterType);
  }, [questions, bankSearch, bankFilterSubject, bankFilterType]);

  const selectedPQ = useMemo(() => {
    return paperQuestionsList.find(pq => pq.id === selectedPQId);
  }, [paperQuestionsList, selectedPQId]);

  const selectedQuestion = useMemo(() => {
    if (!selectedPQ) return null;
    return questions.find(q => q.id === selectedPQ?.questionId);
  }, [selectedPQ, questions]);

  const totalMarks = useMemo(() => {
    return paperQuestionsList.reduce((sum, pq) => sum + pq.marks, 0);
  }, [paperQuestionsList]);

  const groupedBySection = useMemo(() => {
    const groups: Record<PaperSection, PaperQuestion[]> = { A: [], B: [], C: [], D: [] };
    paperQuestionsList.forEach(pq => {
      groups[pq.section].push(pq);
    });
    return groups;
  }, [paperQuestionsList]);

  const exportPDF = () => {
    if (!paper) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Question Paper', pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(16);
    doc.text(paper.title, pageWidth / 2, y, { align: 'center' });
    y += 8;

    if (paper.qpCode) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Code: ${paper.qpCode}`, pageWidth / 2, y, { align: 'center' });
      y += 6;
    }

    doc.setFontSize(11);
    const details: string[] = [];
    if (getCourse(paper.courseId)?.name) details.push(`Course: ${getCourse(paper.courseId)?.name}`);
    if (getSubject(paper.subjectId)?.name) details.push(`Subject: ${getSubject(paper.subjectId)?.name}`);
    if (getClass(paper.classId)?.name) details.push(`Class: ${getClass(paper.classId)?.name}`);
    if (paper.date) details.push(`Date: ${new Date(paper.date).toLocaleDateString()}`);
    if (paper.duration) details.push(`Duration: ${paper.duration} min`);
    details.push(`Max Marks: ${paper.maxMarks || totalMarks}`);
    doc.text(details.join('  |  '), pageWidth / 2, y, { align: 'center' });
    y += 8;

    if (paper.instructions) {
      y += 4;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      const instLines = doc.splitTextToSize(`Instructions: ${paper.instructions}`, contentWidth);
      doc.text(instLines, margin, y, { align: 'left' });
      y += instLines.length * 4 + 6;
    }

    y += 6;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    const sections: PaperSection[] = ['A', 'B', 'C', 'D'];
    let qNum = 1;

    sections.forEach(section => {
      const sectionQuestions = groupedBySection[section];
      if (sectionQuestions.length === 0) return;

      y += 4;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Section ${section}`, margin, y);
      y += 7;

      sectionQuestions.forEach(pq => {
        const q = getQuestion(pq.questionId);
        if (!q) return;

        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${qNum}.`, margin, y);
        const qStart = margin + 10;

        if (q.questionType === 'mcq') {
          const lines = doc.splitTextToSize(q.content, contentWidth - 10);
          doc.setFont('helvetica', 'normal');
          doc.text(lines, qStart, y);
          y += lines.length * 5 + 3;
          doc.setFontSize(10);
          (q.options || []).forEach((opt, i) => {
            const optLines = doc.splitTextToSize(`${String.fromCharCode(65 + i)}. ${opt}`, contentWidth - 25);
            doc.text(optLines, qStart + 5, y);
            y += optLines.length * 4 + 1;
          });
        } else {
          const lines = doc.splitTextToSize(`${q.content} (${pq.marks} marks)`, contentWidth - 10);
          doc.setFont('helvetica', 'normal');
          doc.text(lines, qStart, y);
          y += lines.length * 5 + 3;
        }
        qNum++;
      });
    });

    doc.save(`${paper.title.replace(/\s+/g, '_')}.pdf`);
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
          <div className="block-palette-section">
            <h3 className="block-palette-title">Actions</h3>
            <div className="block-items">
              <button className="block-item" onClick={() => setShowQuestionBank(true)}>
                <div className="block-item-icon mcq"><List size={16} /></div>
                <span>Add from Bank</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="editor-canvas">
        <div className="paper-container">
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
              <p>Add questions from the Question Bank</p>
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
                  {(['A', 'B', 'C', 'D'] as PaperSection[]).map(section => {
                    const sectionQs = groupedBySection[section];
                    if (sectionQs.length === 0) return null;
                    return (
                      <div key={section} className="paper-section">
                        <div className="section-divider">
                          <span>Section {section}</span>
                        </div>
                        {sectionQs.map(pq => (
                          <SortablePaperQuestion
                            key={pq.id}
                            paperQuestion={pq}
                            question={getQuestion(pq.questionId)}
                            isSelected={selectedPQId === pq.id}
                            onSelect={() => setSelectedPQId(pq.id)}
                            onRemove={() => handleRemovePQ(pq.id, pq.questionId)}
                          />
                        ))}
                      </div>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </div>

      <div className="property-panel">
        <div className="property-panel-header">
          <h2 className="property-panel-title">
            {selectedPQ ? 'Edit Question' : 'Properties'}
          </h2>
        </div>
        <div className="property-panel-content">
          {selectedPQ && selectedQuestion ? (
            <>
              <div className="property-field">
                <label className="property-label editor-label">Question Type</label>
                <div className="question-type-badge">{selectedQuestion.questionType}</div>
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
                <div className="question-content-preview">{selectedQuestion.content}</div>
              </div>
              {selectedQuestion.questionType === 'mcq' && selectedQuestion.options && selectedQuestion.options.length > 0 && (
                <div className="property-field">
                  <label className="property-label editor-label">Options</label>
                  <div className="options-list">
                    {selectedQuestion.options.map((opt, i) => (
                      <div key={i} className="option-preview">
                        <span>{String.fromCharCode(65 + i)}. {opt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="no-selection">
              <div className="no-selection-icon">
                <ChevronDown size={24} />
              </div>
              <h3>No question selected</h3>
              <p>Click on a question in the paper to edit</p>
            </div>
          )}
        </div>
      </div>

      <div className="editor-toolbar">
        <button className="toolbar-btn" onClick={() => setShowQuestionBank(true)}>
          <List size={18} />
          Question Bank
        </button>
        <button className="toolbar-btn primary" onClick={() => exportPDF()}>
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

      {/* Question Bank Modal */}
      {showQuestionBank && (
        <div className="modal-overlay" onClick={() => setShowQuestionBank(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h2 className="modal-title">Question Bank</h2>
            </div>
            <div className="modal-content">
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <input
                  type="text"
                  className="property-input"
                  placeholder="Search questions..."
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  style={{ flex: 1 }}
                />
                <select
                  className="property-input"
                  value={bankFilterSubject}
                  onChange={(e) => setBankFilterSubject(e.target.value)}
                >
                  <option value="">All Subjects</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select
                  className="property-input"
                  value={bankFilterType}
                  onChange={(e) => setBankFilterType(e.target.value as QuestionType | '')}
                >
                  <option value="">All Types</option>
                  <option value="mcq">MCQ</option>
                  <option value="short">Short</option>
                  <option value="long">Long</option>
                  <option value="fillblank">Fill Blank</option>
                </select>
              </div>

              <div className="question-bank-list">
                {filteredQuestions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                    <p>No questions found</p>
                  </div>
                ) : (
                  filteredQuestions.map(q => (
                    <QuestionBankItem
                      key={q.id}
                      question={q}
                      isSelected={false}
                      onSelect={() => handleAddQuestion(q.id)}
                    />
                  ))
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowQuestionBank(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}