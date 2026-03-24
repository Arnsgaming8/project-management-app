import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '20px'
    }}>
      <div className="fade-in" style={{
        width: '100%',
        maxWidth: '420px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            fontSize: '56px',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>⚡</div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            marginBottom: '8px',
            background: 'linear-gradient(135deg, #f8fafc, #94a3b8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>TaskFlow Pro</h1>
          <p style={{ color: '#64748b', fontSize: '16px' }}>Welcome back! Sign in to continue.</p>
        </div>

        <div className="card" style={{
          border: '1px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}>
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#94a3b8',
                fontSize: '14px',
                fontWeight: '500'
              }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#94a3b8',
                fontSize: '14px',
                fontWeight: '500'
              }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155'
                }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{
            marginTop: '24px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '14px'
          }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#6366f1', fontWeight: '500' }}>
              Create one
            </Link>
          </div>
        </div>

        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          color: '#475569',
          fontSize: '13px'
        }}>
          © 2024 TaskFlow Pro. All rights reserved.
        </div>
      </div>
    </div>
  );
}

export default Login;