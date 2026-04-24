import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Trash2, Copy, Edit, FolderOpen, LogOut, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { SUBJECTS, GRADES } from '../types';
import type { Subject, Grade } from '../types';
import { supabase } from '../supabase';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, fetchPapers, createPaper, deletePaper, duplicatePaper, setUser, papers } = useStore();
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<Subject | ''>('');
  const [gradeFilter, setGradeFilter] = useState<Grade | ''>('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState<Subject>('Mathematics');
  const [newGrade, setNewGrade] = useState<Grade>('9th Grade');
  const [newInstructions, setNewInstructions] = useState('');
  const [newDuration, setNewDuration] = useState(60);
  const [newCourse, setNewCourse] = useState('K12');
  const [newExamDate, setNewExamDate] = useState('');
  const [newMaxMarks, setNewMaxMarks] = useState(100);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  const filteredPapers = useMemo(() => {
    return papers
      .filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
      .filter((p) => !subjectFilter || p.subject === subjectFilter)
      .filter((p) => !gradeFilter || p.grade === gradeFilter)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [papers, search, subjectFilter, gradeFilter]);

  const handleCreatePaper = async () => {
    if (newTitle.trim()) {
      setCreating(true);
      const id = await createPaper(newTitle.trim(), newSubject, newGrade, newInstructions, newDuration, newCourse, newExamDate, newMaxMarks);
      setShowNewModal(false);
      setNewTitle('');
      setNewInstructions('');
      setNewDuration(60);
      setNewCourse('K12');
      setNewExamDate('');
      setNewMaxMarks(100);
      setCreating(false);
      navigate(`/editor/${id}`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser({ id: '', fullName: '', schoolName: '', email: '', createdAt: 0, updatedAt: 0 });
    navigate('/login');
  };

  const handleDuplicate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    duplicatePaper(id);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deletePaper(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <FileText size={22} />
            </div>
            <span className="logo-text">PaperForm</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <button className="new-paper-btn" onClick={() => setShowNewModal(true)} style={{ marginBottom: 16 }}>
            <Plus size={20} />
            <span>New Paper</span>
          </button>
          <div className="nav-item active">
            <FolderOpen size={20} />
            <span>My Papers</span>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="nav-item" onClick={handleLogout} style={{ cursor: 'pointer' }}>
            <LogOut size={20} />
            <span>Sign Out</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="dashboard">
          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">My Papers</h1>
              <p className="dashboard-subtitle">Welcome back, {user?.fullName}</p>
            </div>
            <div className="filters">
              <input
                type="text"
                className="search-input"
                placeholder="Search papers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value as Subject | '')}>
                <option value="">All Subjects</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value as Grade | '')}>
                <option value="">All Grades</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {filteredPapers.length === 0 ? (
            <div className="empty-paper">
              <div className="empty-paper-icon">
                <FileText size={28} />
              </div>
              <h3>No papers yet</h3>
              <p>Create your first exam paper to get started</p>
            </div>
          ) : (
            <div className="paper-grid">
              {filteredPapers.map((paper) => (
                <div
                  key={paper.id}
                  className="paper-card"
                  onClick={() => navigate(`/editor/${paper.id}`)}
                >
                  <div className="paper-preview">
                    <div className="paper-preview-inner">
                      <div className="paper-preview-header">{paper.schoolName}</div>
                      <div>{paper.title}</div>
                    </div>
                  </div>
                  <div className="paper-card-content">
                    <h3 className="paper-title">{paper.title}</h3>
                    <div className="paper-meta">
                      <span className="paper-tag">{paper.subject}</span>
                      <span className="paper-tag">{paper.grade}</span>
                    </div>
                    <p className="paper-date">Last edited {formatDate(paper.updatedAt)}</p>
                    <div className="paper-actions">
                      <button
                        className="paper-action-btn primary"
                        onClick={(e) => { e.stopPropagation(); navigate(`/editor/${paper.id}`); }}
                      >
                        <Edit size={14} />
                        Edit
                      </button>
                      <button
                        className="paper-action-btn secondary"
                        onClick={(e) => handleDuplicate(e, paper.id)}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        className="paper-action-btn danger"
                        onClick={(e) => handleDelete(e, paper.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Paper</h2>
            </div>
            <div className="modal-content" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="property-field">
                <label className="property-label">Paper Title</label>
                <input
                  type="text"
                  className="property-input"
                  placeholder="e.g., Mid-Term Examination"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="property-field">
                <label className="property-label">Instructions</label>
                <textarea
                  className="property-textarea"
                  placeholder="General instructions for the exam..."
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  style={{ minHeight: 60 }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="property-field">
                  <label className="property-label">Duration (minutes)</label>
                  <input
                    type="number"
                    className="property-input"
                    value={newDuration}
                    onChange={(e) => setNewDuration(parseInt(e.target.value) || 60)}
                    min={1}
                  />
                </div>
                <div className="property-field">
                  <label className="property-label">Course</label>
                  <input
                    type="text"
                    className="property-input"
                    placeholder="e.g., K12"
                    value={newCourse}
                    onChange={(e) => setNewCourse(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="property-field">
                  <label className="property-label">Date</label>
                  <input
                    type="date"
                    className="property-input"
                    value={newExamDate}
                    onChange={(e) => setNewExamDate(e.target.value)}
                  />
                </div>
                <div className="property-field">
                  <label className="property-label">Max Marks</label>
                  <input
                    type="number"
                    className="property-input"
                    value={newMaxMarks}
                    onChange={(e) => setNewMaxMarks(parseInt(e.target.value) || 100)}
                    min={1}
                  />
                </div>
              </div>
              <div className="property-field">
                <label className="property-label">Subject</label>
                <select
                  className="property-input"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value as Subject)}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="property-field">
                <label className="property-label">Grade</label>
                <select
                  className="property-input"
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value as Grade)}
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowNewModal(false)} disabled={creating}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreatePaper} disabled={creating}>
                {creating ? <Loader2 className="animate-spin" size={18} /> : 'Create Paper'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Paper</h2>
            </div>
            <div className="modal-content">
              <p>Are you sure you want to delete this paper? This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}