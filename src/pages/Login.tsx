import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { supabase } from '../supabase';

export default function Login() {
  const navigate = useNavigate();
  const setUser = useStore((s) => s.setUser);
  const [name, setName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: name.trim(),
              school_name: schoolName.trim(),
            },
          },
        });

        if (signUpError) throw signUpError;
        // Navigation and state update will be handled by App.tsx's onAuthStateChange
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) throw signInError;
        // Navigation and state update will be handled by App.tsx's onAuthStateChange
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      setLoading(false); // Only stop loading if there's an error. On success, App.tsx will unmount this component.
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <FileText />
          </div>
          <h1 className="login-title">PaperForm</h1>
          <p className="login-subtitle">
            {isSignUp ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>
        
        {error && (
          <div style={{ 
            padding: '12px 16px', 
            background: '#FEE2E2', 
            color: '#DC2626', 
            borderRadius: '8px', 
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {isSignUp && (
            <>
              <div className="property-field">
                <label className="property-label">Your Name</label>
                <input
                  type="text"
                  className="property-input"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={isSignUp}
                />
              </div>
              <div className="property-field">
                <label className="property-label">School Name (Optional)</label>
                <input
                  type="text"
                  className="property-input"
                  placeholder="Enter your school name"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="property-field">
            <label className="property-label">Email</label>
            <input
              type="email"
              className="property-input"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="property-field">
            <label className="property-label">Password</label>
            <input
              type="password"
              className="property-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            style={{ color: 'var(--accent)', fontWeight: 500 }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}