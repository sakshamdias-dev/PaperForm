import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store';
import { supabase } from './supabase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';

function App() {
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const logout = useStore((s) => s.logout);
  const fetchQuestionPapers = useStore((s) => s.fetchQuestionPapers);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Function to handle user session and profile
    const handleSession = async (session: any) => {
      if (session?.user) {
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, school_name, created_at, updated_at')
            .eq('id', session.user.id)
            .maybeSingle();

          if (mounted) {
            setUser({
              id: session.user.id,
              fullName: profileData?.full_name || session.user.email?.split('@')[0] || 'User',
              schoolName: profileData?.school_name || '',
              email: session.user.email || '',
              createdAt: profileData?.created_at ? new Date(profileData.created_at).getTime() : Date.now(),
              updatedAt: profileData?.updated_at ? new Date(profileData.updated_at).getTime() : Date.now(),
            });
            await fetchQuestionPapers().catch(() => {});
          }
        } catch (err) {
          console.error('Profile fetch error:', err);
        }
      } else {
        if (mounted) logout();
      }
      
      if (mounted) setLoading(false);
    };

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) handleSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        handleSession(session);
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          logout();
          setLoading(false);
        }
      }
    });

    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [setUser, logout, fetchQuestionPapers]);

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
        <Route path="/login" element={user?.id ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={user?.id ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/editor/:id" element={user?.id ? <Editor /> : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;