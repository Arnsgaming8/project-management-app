import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { auth, workspaces, projects, columns, tasks } from './context/api';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Workspace from './pages/Workspace';
import Project from './pages/Project';

const AuthContext = createContext(null);
const SocketContext = createContext(null);

export const useAuth = () => useContext(AuthContext);
export const useSocket = () => useContext(SocketContext);

const SOCKET_URL = 'https://server-production-3677.up.railway.app';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      const newSocket = io(SOCKET_URL);
      setSocket(newSocket);
      newSocket.on('connect', () => console.log('Socket connected'));
    }
    
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await auth.login({ email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await auth.register({ name, email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    if (socket) socket.disconnect();
    setSocket(null);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: '#0f172a',
        color: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '48px', 
            marginBottom: '20px',
            animation: 'pulse 1.5s infinite'
          }}>⚡</div>
          <div style={{ fontSize: '18px' }}>Loading TaskFlow Pro...</div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      <SocketContext.Provider value={socket}>
        <Router>
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
            <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
            <Route path="/workspace/:id" element={user ? <Workspace /> : <Navigate to="/login" />} />
            <Route path="/project/:id" element={user ? <Project /> : <Navigate to="/login" />} />
          </Routes>
        </Router>
      </SocketContext.Provider>
    </AuthContext.Provider>
  );
}

export default App;