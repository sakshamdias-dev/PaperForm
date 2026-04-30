import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Trash2, Copy, Edit, FolderOpen, LogOut, Loader2, BookOpen, Users, GraduationCap, Search } from 'lucide-react';
import { useStore } from '../store';
import { supabase } from '../supabase';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, questionPapers, courses, subjects, classes, fetchCourses, fetchSubjects, fetchClasses, fetchQuestionPapers, createQuestionPaper, deleteQuestionPaper, duplicateQuestionPaper, createCourse, createSubject, createClass } = useStore();
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // New Paper form state
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newMaxMarks, setNewMaxMarks] = useState(100);
  const [newCourseId, setNewCourseId] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newClassId, setNewClassId] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [newDuration, setNewDuration] = useState(180);
  const [creating, setCreating] = useState(false);
  
  // Settings form state
  const [settingsTab, setSettingsTab] = useState<'courses' | 'subjects' | 'classes'>('courses');
  const [newItemName, setNewItemName] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestionPapers();
    fetchCourses();
    fetchSubjects();
    fetchClasses();
  }, []);

  const filteredPapers = useMemo(() => {
    return questionPapers
      .filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
      .filter((p) => !courseFilter || p.courseId === courseFilter)
      .filter((p) => !subjectFilter || p.subjectId === subjectFilter)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [questionPapers, search, courseFilter, subjectFilter]);

  const handleCreatePaper = async () => {
    if (newTitle.trim()) {
      setCreating(true);
      const id = await createQuestionPaper(
        newTitle.trim(),
        newDate || undefined,
        newMaxMarks,
        newCourseId || undefined,
        newSubjectId || undefined,
        newClassId || undefined,
        newInstructions || undefined,
        newDuration || undefined
      );
      setShowNewModal(false);
      setNewTitle('');
      setNewDate('');
      setNewMaxMarks(100);
      setNewCourseId('');
      setNewSubjectId('');
      setNewClassId('');
      setNewInstructions('');
      setNewDuration(180);
      setCreating(false);
      navigate(`/editor/${id}`);
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    setAddingItem(true);
    
    try {
      if (settingsTab === 'courses') {
        await createCourse(newItemName.trim());
      } else if (settingsTab === 'subjects') {
        await createSubject(newItemName.trim());
      } else if (settingsTab === 'classes') {
        await createClass(newItemName.trim());
      }
      setNewItemName('');
    } finally {
      setAddingItem(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleDuplicate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    duplicateQuestionPaper(id);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteQuestionPaper(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'No date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCourseName = (id?: string) => courses.find(c => c.id === id)?.name || '-';
  const getSubjectName = (id?: string) => subjects.find(s => s.id === id)?.name || '-';
  const getClassName = (id?: string) => classes.find(c => c.id === id)?.name || '-';

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
          <div className="nav-item" onClick={() => setShowSettingsModal(true)}>
            <BookOpen size={20} />
            <span>Paper Details</span>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user?.fullName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.fullName || 'User'}</span>
              <span className="user-email">{user?.email}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Sign Out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="dashboard">
          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">My Question Papers</h1>
              <p className="dashboard-subtitle">Welcome back, {user?.fullName}</p>
            </div>
            <div className="filters">
              <div className="search-wrapper">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search papers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
                <option value="">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {filteredPapers.length === 0 ? (
            <div className="empty-paper">
              <div className="empty-paper-icon">
                <FileText size={28} />
              </div>
              <h3>No question papers yet</h3>
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
                      <div className="paper-preview-header">{getCourseName(paper.courseId)}</div>
                      <div>{paper.title}</div>
                    </div>
                  </div>
                  <div className="paper-card-content">
                    <h3 className="paper-title">{paper.title}</h3>
                    <div className="paper-meta">
                      <span className="paper-tag">{getSubjectName(paper.subjectId)}</span>
                      <span className="paper-tag">{getClassName(paper.classId)}</span>
                    </div>
                    <p className="paper-date">
                      {paper.qpCode} • {formatDate(paper.date)} • {paper.maxMarks || 0} marks
                    </p>
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

      {/* New Paper Modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Question Paper</h2>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="property-field">
                  <label className="property-label">Course</label>
                  <select
                    className="property-input"
                    value={newCourseId}
                    onChange={(e) => setNewCourseId(e.target.value)}
                  >
                    <option value="">Select Course</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="property-field">
                  <label className="property-label">Subject</label>
                  <select
                    className="property-input"
                    value={newSubjectId}
                    onChange={(e) => setNewSubjectId(e.target.value)}
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="property-field">
                  <label className="property-label">Class</label>
                  <select
                    className="property-input"
                    value={newClassId}
                    onChange={(e) => setNewClassId(e.target.value)}
                  >
                    <option value="">Select Class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="property-field">
                  <label className="property-label">Date</label>
                  <input
                    type="date"
                    className="property-input"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
                <div className="property-field">
                  <label className="property-label">Duration (minutes)</label>
                  <input
                    type="number"
                    className="property-input"
                    value={newDuration}
                    onChange={(e) => setNewDuration(parseInt(e.target.value) || 180)}
                    min={1}
                  />
                </div>
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

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2 className="modal-title">Paper Details</h2>
            </div>
            <div className="modal-content">
              <div style={{ display: 'flex', gap: 15, marginBottom: 20 }}>
                <button
                  className={`btn ${settingsTab === 'courses' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSettingsTab('courses')}
                >
                  <GraduationCap size={18} />
                  Courses
                </button>
                <button
                  className={`btn ${settingsTab === 'subjects' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSettingsTab('subjects')}
                >
                  <BookOpen size={18} />
                  Subjects
                </button>
                <button
                  className={`btn ${settingsTab === 'classes' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSettingsTab('classes')}
                >
                  <Users size={18} />
                  Classes
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="property-input"
                    placeholder={`Add new ${settingsTab.slice(0, -1)}...`}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary" onClick={handleAddItem} disabled={addingItem}>
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {settingsTab === 'courses' && courses.map((c) => (
                  <span key={c.id} className="paper-tag" style={{ cursor: 'default' }}>
                    {c.name}
                  </span>
                ))}
                {settingsTab === 'subjects' && subjects.map((s) => (
                  <span key={s.id} className="paper-tag" style={{ cursor: 'default' }}>
                    {s.name}
                  </span>
                ))}
                {settingsTab === 'classes' && classes.map((c) => (
                  <span key={c.id} className="paper-tag" style={{ cursor: 'default' }}>
                    {c.name}
                  </span>
                ))}
                {settingsTab === 'courses' && courses.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No courses yet. Add one above.</p>
                )}
                {settingsTab === 'subjects' && subjects.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No subjects yet. Add one above.</p>
                )}
                {settingsTab === 'classes' && classes.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No classes yet. Add one above.</p>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowSettingsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
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