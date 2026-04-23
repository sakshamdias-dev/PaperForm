import { useState, useMemo, useCallback } from 'react';
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
  Layers,
  List,
  AlignLeft,
  BookOpen,
  ArrowLeft,
  FileText,
  Check,
} from 'lucide-react';
import { useStore } from '../store';
import { store } from '../store';
import type {
  AnyBlock,
  BlockType,
  SectionBlock,
  MCQBlock,
  ShortBlock,
  LongBlock,
  FillBlankBlock,
  Question,
  Paper,
} from '../types';
import { jsPDF } from 'jspdf';

interface BlockProps {
  block: AnyBlock;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  questionNumber: number;
}

function SortableBlock({ block, isSelected, onSelect, onDelete, questionNumber }: BlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const renderContent = () => {
    switch (block.type) {
      case 'section': {
        const sb = block as SectionBlock;
        return (
          <div className="block-display section">
            <div className="section-header">
              <span className="section-title">{sb.title}</span>
            </div>
            {sb.instruction && <p className="section-instruction">{sb.instruction}</p>}
          </div>
        );
      }
      case 'mcq': {
        const mb = block as MCQBlock;
        return (
          <div className="block-display">
            <p className="question-text">
              <span className="question-number">{questionNumber}.</span>
              {mb.question}
            </p>
            <div className="mcq-options">
              {mb.options.map((opt, i) => (
                <div key={i} className={`mcq-option ${mb.correctAnswer === i ? 'correct' : ''}`}>
                  <span className="mcq-option-letter">{String.fromCharCode(65 + i)}</span>
                  <span>{opt}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }
      case 'short': {
        const sb = block as ShortBlock;
        return (
          <div className="block-display">
            <p className="question-text">
              <span className="question-number">{questionNumber}.</span>
              {sb.question}
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>({sb.marks} marks)</span>
            </p>
          </div>
        );
      }
      case 'long': {
        const lb = block as LongBlock;
        return (
          <div className="block-display">
            <p className="question-text">
              <span className="question-number">{questionNumber}.</span>
              {lb.question}
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>({lb.marks} marks)</span>
            </p>
          </div>
        );
      }
      case 'fillblank': {
        const fb = block as FillBlankBlock;
        const parts = fb.text.split('[');
        return (
          <div className="block-display">
            <p className="question-text">
              <span className="question-number">{questionNumber}.</span>
              <span className="fill-blank-text">
                {parts.map((part, i) => {
                  if (i === 0) return part;
                  const [text] = part.split(']');
                  return (
                    <span key={i}>
                      <span className="fill-blank-placeholder" />
                      {part.replace(text + ']', '')}
                    </span>
                  );
                })}
              </span>
            </p>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`block-wrapper ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      {block.type !== 'section' && (
        <div className="drag-handle" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </div>
      )}
      {renderContent()}
      <div className="block-actions">
        <button
          className="block-action-btn danger"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
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
    papers,
    addBlock,
    updateBlock,
    deleteBlock,
    reorderBlocks,
    saveQuestionToBank,
  } = useStore();

  const paper = papers.find((p) => p.id === id);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<'student' | 'teacher'>('student');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Helper functions to handle async updates in onChange handlers
  const handleUpdateBlock = <T extends AnyBlock>(paperId: string, blockId: string, updates: Partial<T>) => {
    updateBlock(paperId, blockId, updates).catch(err => {
      console.error('Failed to update block:', err);
      showToastMessage('Failed to save changes');
    });
  };

  const handleDeleteBlock = (paperId: string, blockId: string) => {
    deleteBlock(paperId, blockId).catch(err => {
      console.error('Failed to delete block:', err);
      showToastMessage('Failed to delete block');
    });
  };

  const blocksPerPage = 5;
  const questionBlocks = paper?.blocks.filter(b => b.type !== 'section') || [];
  const totalPages = Math.ceil(questionBlocks.length / blocksPerPage) || 1;

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && paper) {
      const oldIndex = paper.blocks.findIndex((b) => b.id === active.id);
      const newIndex = paper.blocks.findIndex((b) => b.id === over.id);
      const newBlocks = arrayMove(paper.blocks, oldIndex, newIndex);
      await reorderBlocks(paper.id, newBlocks);
    }
  };

  const handleAddBlock = async (type: BlockType) => {
    if (paper) {
      if (type === 'section') {
        const sections = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const existingSections = paper.blocks.filter(b => b.type === 'section').length;
        const nextLetter = sections[existingSections] || 'A';
        
        await addBlock(paper.id, 'section');
        
        const updatedPaper = store.getState().papers.find((p: Paper) => p.id === paper.id);
        if (updatedPaper) {
          const newBlock = updatedPaper.blocks[updatedPaper.blocks.length - 1];
          if (newBlock && newBlock.type === 'section') {
            await updateBlock(paper.id, newBlock.id, { title: `Section ${nextLetter}` });
          }
        }
      } else {
        await addBlock(paper.id, type);
      }
    }
  };

  const handleSaveQuestion = async () => {
    if (!paper || !selectedBlockId) return;
    const block = paper.blocks.find((b) => b.id === selectedBlockId);
    if (!block || block.type === 'section') return;

    let questionData: Omit<Question, 'id' | 'createdAt'>;
    if (block.type === 'mcq') {
      const mb = block as MCQBlock;
      questionData = {
        type: 'mcq',
        question: mb.question,
        options: mb.options,
        correctAnswer: mb.correctAnswer,
        marks: mb.marks,
        subject: paper.subject,
      };
    } else if (block.type === 'short') {
      const sb = block as ShortBlock;
      questionData = { type: 'short', question: sb.question, marks: sb.marks, subject: paper.subject };
    } else if (block.type === 'long') {
      const lb = block as LongBlock;
      questionData = { type: 'long', question: lb.question, marks: lb.marks, subject: paper.subject };
    } else {
      const fb = block as FillBlankBlock;
      questionData = { type: 'fillblank', question: fb.text, marks: fb.marks, subject: paper.subject };
    }
    await saveQuestionToBank(questionData);
    showToastMessage('Question saved to Question Bank!');
  };

  const selectedBlock = useMemo(() => {
    if (!paper || !selectedBlockId) return null;
    return paper.blocks.find((b) => b.id === selectedBlockId);
  }, [paper, selectedBlockId]);

  const getBlockNumbers = useCallback(() => {
    if (!paper) return new Map<string, { q: number; s: string }>();
    const map = new Map<string, { q: number; s: string }>();
    let qn = 1;
    let sn = 0;
    const sections = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    paper.blocks.forEach((b) => {
      if (b.type === 'section') {
        sn++;
        map.set(b.id, { q: 0, s: sections[sn - 1] });
      } else {
        map.set(b.id, { q: qn++, s: sections[Math.max(0, sn - 1)] });
      }
    });
    return map;
  }, [paper]);

  const blockNumbers = getBlockNumbers();

  const exportPDF = () => {
    if (!paper) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(paper.schoolName, pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(16);
    doc.text(paper.title, pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Subject: ${paper.subject}  |  Grade: ${paper.grade}`, pageWidth / 2, y, { align: 'center' });
    y += 15;

    if (exportMode === 'teacher') {
      doc.setFontSize(10);
      doc.setTextColor(180, 120, 0);
      doc.text('TEACHER\'S COPY', pageWidth / 2, y, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      y += 8;
    }

    paper.blocks.forEach((block) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      if (block.type === 'section') {
        const sb = block as SectionBlock;
        y += 5;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(sb.title, margin, y);
        y += 7;
        if (sb.instruction) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'italic');
          doc.text(sb.instruction, margin, y);
          y += 6;
        }
      } else {
        const nums = blockNumbers.get(block.id);
        const qNum = nums?.q || 1;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${qNum}.`, margin, y);
        const qStart = margin + 10;

        if (block.type === 'mcq') {
          const mb = block as MCQBlock;
          const lines = doc.splitTextToSize(mb.question, contentWidth - 10);
          doc.setFont('helvetica', 'normal');
          doc.text(lines, qStart, y);
          y += lines.length * 5 + 4;
          doc.setFontSize(10);
          mb.options.forEach((opt, i) => {
            const prefix = exportMode === 'teacher' && mb.correctAnswer === i ? '[✓] ' : '   ';
            const optLines = doc.splitTextToSize(prefix + String.fromCharCode(65 + i) + '. ' + opt, contentWidth - 25);
            doc.text(optLines, qStart + 5, y);
            y += optLines.length * 4 + 2;
          });
        } else if (block.type === 'short') {
          const sb = block as ShortBlock;
          const lines = doc.splitTextToSize(sb.question + ` (${sb.marks} marks)`, contentWidth - 10);
          doc.setFont('helvetica', 'normal');
          doc.text(lines, qStart, y);
          y += lines.length * 5 + 4;
        } else if (block.type === 'long') {
          const lb = block as LongBlock;
          const lines = doc.splitTextToSize(lb.question + ` (${lb.marks} marks)`, contentWidth - 10);
          doc.setFont('helvetica', 'normal');
          doc.text(lines, qStart, y);
          y += lines.length * 5 + 4;
        } else if (block.type === 'fillblank') {
          const fb = block as FillBlankBlock;
          const textWithBlanks = fb.text.replace(/\[blank\]/g, '____________');
          const lines = doc.splitTextToSize(textWithBlanks + ` (${fb.marks} marks)`, contentWidth - 10);
          doc.setFont('helvetica', 'normal');
          doc.text(lines, qStart, y);
          y += lines.length * 5 + 4;
        }
      }
    });

    doc.save(`${paper.title.replace(/\s+/g, '_')}_${exportMode}.pdf`);
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
          <p className="editor-sidebar-subtitle">{paper.subject} • {paper.grade}</p>
        </div>

        <div className="block-palette">
          <div className="block-palette-section">
            <h3 className="block-palette-title">Add Blocks</h3>
            <div className="block-items">
              <button className="block-item" onClick={() => handleAddBlock('section')}>
                <div className="block-item-icon section"><Layers size={16} /></div>
                <span>Section</span>
              </button>
              <button className="block-item" onClick={() => handleAddBlock('mcq')}>
                <div className="block-item-icon mcq"><List size={16} /></div>
                <span>MCQ Question</span>
              </button>
              <button className="block-item" onClick={() => handleAddBlock('short')}>
                <div className="block-item-icon short"><AlignLeft size={16} /></div>
                <span>Short Answer</span>
              </button>
              <button className="block-item" onClick={() => handleAddBlock('long')}>
                <div className="block-item-icon long"><AlignLeft size={16} /></div>
                <span>Long Answer</span>
              </button>
              <button className="block-item" onClick={() => handleAddBlock('fillblank')}>
                <div className="block-item-icon fillblank"><BookOpen size={16} /></div>
                <span>Fill in the Blank</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="editor-canvas">
        <div className="paper-container">
          <div className="paper-header">
            <h1 className="paper-school-name">{paper.schoolName}</h1>
            <h2 className="paper-exam-title">{paper.title}</h2>
            <div className="paper-info">
              <span>Subject: {paper.subject}</span>
              <span>Grade: {paper.grade}</span>
            </div>
          </div>

          {paper.blocks.length === 0 ? (
            <div className="empty-paper">
              <div className="empty-paper-icon">
                <Plus size={28} />
              </div>
              <h3>Start building your paper</h3>
              <p>Add blocks from the left panel to create your exam</p>
            </div>
          ) : (
            <div className="paper-blocks">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={paper.blocks.filter(b => b.type !== 'section').map(b => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {paper.blocks.map((block) => {
                    const nums = blockNumbers.get(block.id);
                    return (
                      <SortableBlock
                        key={block.id}
                        block={block}
                        isSelected={selectedBlockId === block.id}
                        onSelect={() => setSelectedBlockId(block.id)}
                        onDelete={() => handleDeleteBlock(paper.id, block.id)}
                        questionNumber={nums?.q || 1}
                      />
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
            {selectedBlock ? 'Edit Block' : 'Properties'}
          </h2>
        </div>
        <div className="property-panel-content">
          {selectedBlock ? (
            <>
              {selectedBlock.type === 'section' && (
                <>
                  <div className="property-field">
                    <label className="property-label">Section Title</label>
                    <input
                      type="text"
                      className="property-input"
                      value={(selectedBlock as SectionBlock).title}
                      onChange={(e) => handleUpdateBlock(paper.id, selectedBlock.id, { title: e.target.value })}
                      placeholder="e.g., Section A: Grammar"
                    />
                  </div>
                  <div className="property-field">
                    <label className="property-label">Instructions (optional)</label>
                    <textarea
                      className="property-textarea"
                      value={(selectedBlock as SectionBlock).instruction}
                      onChange={(e) => handleUpdateBlock(paper.id, selectedBlock.id, { instruction: e.target.value })}
                      placeholder="Instructions for this section"
                    />
                  </div>
                </>
              )}

              {selectedBlock.type === 'mcq' && (
                <>
                  <div className="property-field">
                    <label className="property-label">Question</label>
                    <textarea
                      className="property-textarea"
                      value={(selectedBlock as MCQBlock).question}
                      onChange={(e) => handleUpdateBlock(paper.id, selectedBlock.id, { question: e.target.value })}
                    />
                  </div>
                  <div className="property-field">
                    <label className="property-label">Options</label>
                    <div className="property-options">
                      {((selectedBlock as MCQBlock).options || []).map((opt, i) => (
                        <div key={i} className="option-row">
                          <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                          <input
                            type="text"
                            className="option-input"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...(selectedBlock as MCQBlock).options];
                              newOpts[i] = e.target.value;
                              handleUpdateBlock(paper.id, selectedBlock.id, { options: newOpts });
                            }}
                          />
                          <button
                            className={`correct-toggle ${(selectedBlock as MCQBlock).correctAnswer === i ? 'active' : ''}`}
                            onClick={() => handleUpdateBlock(paper.id, selectedBlock.id, { correctAnswer: i })}
                          >
                            ✓
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="property-field">
                    <label className="property-label">Marks</label>
                    <input
                      type="number"
                      className="property-input"
                      value={(selectedBlock as MCQBlock).marks}
                      onChange={(e) => handleUpdateBlock(paper.id, selectedBlock.id, { marks: parseInt(e.target.value) || 1 })}
                      min={1}
                    />
                  </div>
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleSaveQuestion}>
                    Save to Question Bank
                  </button>
                </>
              )}

              {selectedBlock.type === 'short' && (
                <>
                  <div className="property-field">
                    <label className="property-label">Question</label>
                    <textarea
                      className="property-textarea"
                      value={(selectedBlock as ShortBlock).question}
                      onChange={(e) => handleUpdateBlock(paper.id, selectedBlock.id, { question: e.target.value })}
                    />
                  </div>
                  <div className="property-field">
                    <label className="property-label">Response Lines</label>
                    <input
                      type="number"
                      className="property-input"
                      value={(selectedBlock as ShortBlock).lines}
                      onChange={(e) => handleUpdateBlock(paper.id, selectedBlock.id, { lines: parseInt(e.target.value) || 3 })}
                      min={1}
                      max={10}
                    />
                  </div>
                  <div className="property-field">
                    <label className="property-label">Marks</label>
                    <input
                      type="number"
                      className="property-input"
                      value={(selectedBlock as ShortBlock).marks}
                      onChange={(e) => handleUpdateBlock(paper.id, selectedBlock.id, { marks: parseInt(e.target.value) || 2 })}
                      min={1}
                    />
                  </div>
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleSaveQuestion}>
                    Save to Question Bank
                  </button>
                </>
              )}

              {selectedBlock.type === 'long' && (
                <>
                  <div className="property-field">
                    <label className="property-label">Question</label>
                    <textarea
                      className="property-textarea"
                      value={(selectedBlock as LongBlock).question}
                      onChange={(e) => handleUpdateBlock(paper.id, selectedBlock.id, { question: e.target.value })}
                    />
                  </div>
                  <div className="property-field">
                    <label className="property-label">Marks</label>
                    <input
                      type="number"
                      className="property-input"
                      value={(selectedBlock as LongBlock).marks}
                      onChange={(e) => handleUpdateBlock(paper.id, selectedBlock.id, { marks: parseInt(e.target.value) || 5 })}
                      min={1}
                    />
                  </div>
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleSaveQuestion}>
                    Save to Question Bank
                  </button>
                </>
              )}

              {selectedBlock.type === 'fillblank' && (
                <>
                  <div className="property-field">
                    <label className="property-label">Question Text</label>
                    <textarea
                      className="property-textarea"
                      value={(selectedBlock as FillBlankBlock).text}
                      onChange={(e) => handleUpdateBlock(paper.id, selectedBlock.id, { text: e.target.value })}
                      placeholder="Use [blank] to indicate blank spaces"
                    />
                  </div>
                  <div className="property-field">
                    <label className="property-label">Answers (comma-separated)</label>
                    <input
                      type="text"
                      className="property-input"
                      value={(selectedBlock as FillBlankBlock).answers}
                      onChange={(e) => updateBlock(paper.id, selectedBlock.id, { answers: e.target.value })}
                      placeholder="answer1, answer2, answer3"
                    />
                  </div>
                  <div className="property-field">
                    <label className="property-label">Marks</label>
                    <input
                      type="number"
                      className="property-input"
                      value={(selectedBlock as FillBlankBlock).marks}
                      onChange={(e) => handleUpdateBlock(paper.id, selectedBlock.id, { marks: parseInt(e.target.value) || 1 })}
                      min={1}
                    />
                  </div>
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleSaveQuestion}>
                    Save to Question Bank
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="no-selection">
              <div className="no-selection-icon">
                <ChevronDown size={24} />
              </div>
              <h3>No block selected</h3>
              <p>Click on a block in the paper to edit its properties</p>
            </div>
          )}
        </div>
      </div>

      <div className="editor-toolbar">
        <button className="toolbar-btn" onClick={() => setPreviewMode(!previewMode)}>
          <FileText size={18} />
          {previewMode ? 'Edit Mode' : 'Preview'}
        </button>
        <button className="toolbar-btn primary" onClick={() => setShowExportModal(true)}>
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

      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Export PDF</h2>
            </div>
            <div className="modal-content">
              <p>Choose export format:</p>
              <div className="export-options">
                <div
                  className={`export-option ${exportMode === 'student' ? 'selected' : ''}`}
                  onClick={() => setExportMode('student')}
                >
                  <div className="export-option-radio" />
                  <div className="export-option-content">
                    <h4>Student Version</h4>
                    <p>Clean exam paper without answers</p>
                  </div>
                </div>
                <div
                  className={`export-option ${exportMode === 'teacher' ? 'selected' : ''}`}
                  onClick={() => setExportMode('teacher')}
                >
                  <div className="export-option-radio" />
                  <div className="export-option-content">
                    <h4>Teacher's Version</h4>
                    <p>Includes correct answers highlighted</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => { exportPDF(); setShowExportModal(false); }}>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {previewMode && (
        <div className="preview-modal-overlay" onClick={() => setPreviewMode(false)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <h3>Preview - {paper?.title}</h3>
              <div className="preview-nav">
                <button
                  className="preview-nav-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronDown size={16} style={{ transform: 'rotate(90deg)' }} />
                </button>
                <span className="preview-page-info">Page {currentPage} of {totalPages}</span>
                <button
                  className="preview-nav-btn"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} />
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => setPreviewMode(false)}
                  style={{ marginLeft: 12, padding: '6px 16px' }}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="preview-content">
              <div className="preview-page">
                <div className="preview-paper-header">
                  <div className="preview-school-name">{paper?.schoolName}</div>
                  <div className="preview-exam-title">{paper?.title}</div>
                  <div className="preview-paper-info">
                    Subject: {paper?.subject} | Grade: {paper?.grade}
                  </div>
                </div>
                {questionBlocks.slice((currentPage - 1) * blocksPerPage, currentPage * blocksPerPage).map((block) => {
                  const globalIdx = questionBlocks.indexOf(block);
                  const questionNum = globalIdx + 1;
                  
                  if (block.type === 'mcq') {
                    const mb = block as MCQBlock;
                    return (
                      <div key={block.id} style={{ marginBottom: 16 }}>
                        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 12, lineHeight: 1.6 }}>
                          <strong>{questionNum}.</strong> {mb.question}
                        </p>
                        <div style={{ marginLeft: 16, marginTop: 8 }}>
                          {mb.options.map((opt, i) => (
                            <div key={i} style={{ fontSize: 11, marginBottom: 4, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{ width: 16 }}>{String.fromCharCode(65 + i)}.</span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  } else if (block.type === 'short') {
                    const sb = block as ShortBlock;
                    return (
                      <div key={block.id} style={{ marginBottom: 16 }}>
                        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 12, lineHeight: 1.6 }}>
                          <strong>{questionNum}.</strong> {sb.question}
                          <span style={{ marginLeft: 8, fontSize: 10, color: '#888' }}>({sb.marks} marks)</span>
                        </p>
                      </div>
                    );
                  } else if (block.type === 'long') {
                    const lb = block as LongBlock;
                    return (
                      <div key={block.id} style={{ marginBottom: 16 }}>
                        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 12, lineHeight: 1.6 }}>
                          <strong>{questionNum}.</strong> {lb.question}
                          <span style={{ marginLeft: 8, fontSize: 10, color: '#888' }}>({lb.marks} marks)</span>
                        </p>
                      </div>
                    );
                  } else if (block.type === 'fillblank') {
                    const fb = block as FillBlankBlock;
                    return (
                      <div key={block.id} style={{ marginBottom: 16 }}>
                        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 12, lineHeight: 1.8 }}>
                          <strong>{questionNum}.</strong> {fb.text}
                        </p>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}