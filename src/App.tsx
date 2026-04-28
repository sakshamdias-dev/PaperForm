import { useEffect, useState, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store';
import { supabase } from './supabase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';

function App() {
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const fetchQuestionPapers = useStore((s) => s.fetchQuestionPapers);
  const [loading, setLoading] = useState(true);
  const authInitialized = useRef(false);

  const initAuth = useCallback(async () => {
    if (authInitialized.current) {
      setLoading(false);
      return;
    }
    authInitialized.current = true;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileData) {
          setUser({
            id: session.user.id,
            fullName: profileData.full_name || session.user.email?.split('@')[0] || '',
            email: session.user.email || '',
            createdAt: profileData.created_at ? new Date(profileData.created_at).getTime() : Date.now(),
            updatedAt: profileData.updated_at ? new Date(profileData.updated_at).getTime() : Date.now(),
          });
          await fetchQuestionPapers();
        } else {
          setUser({
            id: session.user.id,
            fullName: session.user.email?.split('@')[0] || '',
            email: session.user.email || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    } catch (err) {
      console.error('Auth init error:', err);
    } finally {
      setLoading(false);
    }
  }, [setUser, fetchQuestionPapers]);

  useEffect(() => {
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        setUser({
          id: session.user.id,
          fullName: profileData?.full_name || session.user.email?.split('@')[0] || '',
          email: session.user.email || '',
          createdAt: profileData?.created_at ? new Date(profileData.created_at).getTime() : Date.now(),
          updatedAt: profileData?.updated_at ? new Date(profileData.updated_at).getTime() : Date.now(),
        });
        fetchQuestionPapers();
      } else if (event === 'SIGNED_OUT') {
        setUser({ id: '', fullName: '', email: '', createdAt: 0, updatedAt: 0 });
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [initAuth, setUser, fetchQuestionPapers]);

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1A0F2E 0%, #2E1A47 100%)' 
      }}>
        <div style={{ 
          width: 40, 
          height: 40, 
          border: '3px solid rgba(255,255,255,0.2)', 
          borderTopColor: '#F5A623',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user?.id ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={user?.id ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/editor/:id" element={user?.id ? <Editor /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;