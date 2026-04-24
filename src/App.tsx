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
  const fetchPapers = useStore((s) => s.fetchPapers);
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
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userData) {
          setUser({
            id: session.user.id,
            fullName: userData.full_name || session.user.email?.split('@')[0] || '',
            schoolName: userData.school_name || '',
            email: session.user.email || '',
            createdAt: userData.created_at ? new Date(userData.created_at).getTime() : Date.now(),
            updatedAt: userData.updated_at ? new Date(userData.updated_at).getTime() : Date.now(),
          });
          await fetchPapers();
        } else {
          setUser({
            id: session.user.id,
            fullName: session.user.email?.split('@')[0] || '',
            schoolName: '',
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
  }, [setUser, fetchPapers]);

  useEffect(() => {
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        setUser({
          id: session.user.id,
          fullName: userData?.full_name || session.user.email?.split('@')[0] || '',
          schoolName: userData?.school_name || '',
          email: session.user.email || '',
          createdAt: userData?.created_at ? new Date(userData.created_at).getTime() : Date.now(),
          updatedAt: userData?.updated_at ? new Date(userData.updated_at).getTime() : Date.now(),
        });
        fetchPapers();
      } else if (event === 'SIGNED_OUT') {
        setUser({ id: '', fullName: '', schoolName: '', email: '', createdAt: 0, updatedAt: 0 });
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [initAuth, setUser, fetchPapers]);

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