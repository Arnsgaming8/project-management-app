import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useSocket } from '../App';
import { workspaces as workspacesApi } from '../context/api';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';

function Dashboard() {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('task:created', () => loadData());
      socket.on('task:updated', () => loadData());
      socket.on('task:deleted', () => loadData());
      return () => {
        socket.off('task:created');
        socket.off('task:updated');
        socket.off('task:deleted');
      };
    }
  }, [socket]);

  const loadData = async () => {
    try {
      const wsData = await workspacesApi.getAll();
      setWorkspaces(wsData.data);
      
      if (wsData.data.length > 0) {
        const analyticsData = await workspacesApi.getAnalytics(wsData.data[0].id);
        setAnalytics(analyticsData.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    try {
      const { data } = await workspacesApi.create({ name: newWorkspaceName });
      setWorkspaces([...workspaces, data]);
      setShowCreateModal(false);
      setNewWorkspaceName('');
      navigate(`/workspace/${data.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: '#0f172a'
      }}>
        <div style={{ textAlign: 'center', color: '#f8fafc' }}>
          <div style={{ fontSize: '48px', animation: 'pulse 1.5s infinite' }}>⚡</div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a' }}>
      {/* Header */}
      <header style={{
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '28px' }}>⚡</div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#f8fafc' }}>TaskFlow Pro</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '600',
              fontSize: '14px'
            }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>{user?.name}</span>
          </div>
          <button onClick={logout} className="btn btn-ghost btn-sm">
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Welcome Section */}
        <div className="fade-in" style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#f8fafc', marginBottom: '8px' }}>
            Welcome back, {user?.name?.split(' ')[0]}! 👋
          </h2>
          <p style={{ color: '#64748b', fontSize: '16px' }}>
            Here's what's happening across your workspaces.
          </p>
        </div>

        {/* Stats Cards */}
        {analytics && (
          <div className="fade-in" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '40px'
          }}>
            <div className="card" style={{ 
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              border: 'none'
            }}>
              <div style={{ fontSize: '32px', fontWeight: '700' }}>{analytics.totalProjects}</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>Total Projects</div>
            </div>
            
            <div className="card" style={{ 
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none'
            }}>
              <div style={{ fontSize: '32px', fontWeight: '700' }}>{analytics.totalTasks}</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>Total Tasks</div>
            </div>
            
            <div className="card" style={{ 
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none'
            }}>
              <div style={{ fontSize: '32px', fontWeight: '700' }}>
                {analytics.tasksByPriority?.find(p => p.priority === 'high')?.count || 0}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>High Priority</div>
            </div>
            
            <div className="card" style={{ 
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              border: 'none'
            }}>
              <div style={{ fontSize: '32px', fontWeight: '700' }}>
                {workspaces.length}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>Workspaces</div>
            </div>
          </div>
        )}

        {/* Charts and Workspaces */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
          {/* Priority Chart */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#f8fafc', marginBottom: '20px' }}>
              Tasks by Priority
            </h3>
            {analytics?.tasksByPriority?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={analytics.tasksByPriority}
                    dataKey="count"
                    nameKey="priority"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ priority, count }) => `${priority}: ${count}`}
                  >
                    {analytics.tasksByPriority.map((entry, index) => (
                      <Cell key={entry.priority} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                height: '200px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#64748b'
              }}>
                No tasks yet
              </div>
            )}
          </div>

          {/* Status Chart */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#f8fafc', marginBottom: '20px' }}>
              Tasks by Status
            </h3>
            {analytics?.tasksByStatus?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics.tasksByStatus}>
                  <XAxis dataKey="status" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      background: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                height: '200px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#64748b'
              }}>
                No tasks yet
              </div>
            )}
          </div>
        </div>

        {/* Workspaces Section */}
        <div className="card">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#f8fafc' }}>
              Your Workspaces
            </h3>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary btn-sm"
            >
              + New Workspace
            </button>
          </div>

          {workspaces.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px'
            }}>
              {workspaces.map((ws) => (
                <Link 
                  key={ws.id}
                  to={`/workspace/${ws.id}`}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '20px',
                    transition: 'all 0.2s',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#6366f1';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#334155';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    marginBottom: '16px'
                  }}>
                    📁
                  </div>
                  <h4 style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#f8fafc',
                    marginBottom: '4px'
                  }}>
                    {ws.name}
                  </h4>
                  <p style={{ 
                    fontSize: '13px', 
                    color: '#64748b'
                  }}>
                    Created {formatDistanceToNow(new Date(ws.created_at), { addSuffix: true })}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏢</div>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>No workspaces yet</p>
              <p style={{ fontSize: '14px' }}>Create your first workspace to get started!</p>
            </div>
          )}
        </div>

        {/* Recent Tasks */}
        {analytics?.recentTasks?.length > 0 && (
          <div className="card" style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#f8fafc', marginBottom: '20px' }}>
              Recent Tasks
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {analytics.recentTasks.map((task) => (
                <div 
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: '#0f172a',
                    borderRadius: '8px',
                    border: '1px solid #334155'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`badge badge-${task.priority}`}>
                      {task.priority}
                    </span>
                    <span style={{ color: '#f8fafc', fontSize: '14px' }}>{task.title}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ color: '#64748b', fontSize: '13px' }}>
                      {task.project_name}
                    </span>
                    <span style={{ color: '#475569', fontSize: '12px' }}>
                      {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="fade-in" style={{
            background: '#1e293b',
            borderRadius: '16px',
            padding: '32px',
            width: '100%',
            maxWidth: '420px',
            border: '1px solid #334155'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#f8fafc', marginBottom: '24px' }}>
              Create New Workspace
            </h3>
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="Workspace name"
              autoFocus
              style={{ marginBottom: '20px' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                onClick={createWorkspace}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;