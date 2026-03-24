import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSocket } from '../App';
import { workspaces as workspacesApi, projects as projectsApi } from '../context/api';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function Workspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const [workspace, setWorkspace] = useState(null);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', color: COLORS[0] });
  const [newMember, setNewMember] = useState({ email: '', role: 'member' });

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (socket) {
      socket.emit('join:workspace', id);
      socket.on('task:created', loadData);
      socket.on('task:updated', loadData);
      return () => {
        socket.off('task:created');
        socket.off('task:updated');
      };
    }
  }, [socket, id]);

  const loadData = async () => {
    try {
      const wsData = await workspacesApi.getAll();
      const ws = wsData.data.find(w => w.id === id);
      setWorkspace(ws);
      
      const projectsData = await projectsApi.getAll(id);
      setProjects(projectsData.data);
      
      const membersData = await workspacesApi.getMembers(id);
      setMembers(membersData.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!newProject.name.trim()) return;
    try {
      const { data } = await projectsApi.create(id, newProject);
      setProjects([...projects, data]);
      setShowCreateModal(false);
      setNewProject({ name: '', description: '', color: COLORS[0] });
      navigate(`/project/${data.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const addMember = async () => {
    if (!newMember.email.trim()) return;
    try {
      await workspacesApi.addMember(id, newMember);
      loadData();
      setShowAddMemberModal(false);
      setNewMember({ email: '', role: 'member' });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteProject = async (projectId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this project?')) return;
    try {
      await projectsApi.delete(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (err) {
      console.error(err);
    }
  };

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
          <div style={{ fontSize: '48px', animation: 'pulse 1.5s infinite' }}>📁</div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: '#0f172a',
        color: '#f8fafc'
      }}>
        Workspace not found
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/" style={{ color: '#64748b', fontSize: '24px', textDecoration: 'none' }}>←</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}>📁</div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#f8fafc' }}>{workspace.name}</h1>
              <p style={{ fontSize: '12px', color: '#64748b' }}>Workspace</p>
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => setShowAddMemberModal(true)}
            className="btn btn-secondary btn-sm"
          >
            + Add Member
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-sm"
          >
            + New Project
          </button>
        </div>
      </header>

      {/* Members Bar */}
      <div style={{
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        padding: '12px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ color: '#64748b', fontSize: '13px' }}>Members:</span>
        {members.map((member) => (
          <div 
            key={member.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              background: '#0f172a',
              borderRadius: '20px',
              fontSize: '13px',
              color: '#94a3b8'
            }}
          >
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: '600',
              color: '#f8fafc'
            }}>
              {member.name.charAt(0).toUpperCase()}
            </div>
            {member.name}
            {member.role === 'owner' && (
              <span style={{ color: '#6366f1', fontSize: '10px' }}>👑</span>
            )}
          </div>
        ))}
      </div>

      {/* Projects Grid */}
      <main style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#f8fafc', marginBottom: '24px' }}>
          Projects
        </h2>

        {projects.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/project/${project.id}`}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '16px',
                  padding: '24px',
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = project.color;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = `0 20px 40px -12px ${project.color}30`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#334155';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <button
                  onClick={(e) => deleteProject(project.id, e)}
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    background: 'transparent',
                    border: 'none',
                    color: '#475569',
                    fontSize: '18px',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title="Delete project"
                >
                  🗑️
                </button>

                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: project.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  marginBottom: '16px',
                  boxShadow: `0 8px 20px -8px ${project.color}`
                }}>
                  📋
                </div>

                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#f8fafc',
                  marginBottom: '8px'
                }}>
                  {project.name}
                </h3>

                {project.description && (
                  <p style={{
                    fontSize: '14px',
                    color: '#64748b',
                    marginBottom: '16px',
                    lineHeight: '1.5'
                  }}>
                    {project.description}
                  </p>
                )}

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#475569',
                  fontSize: '13px'
                }}>
                  <span>→</span>
                  <span>Open project</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            background: '#1e293b',
            borderRadius: '16px',
            border: '2px dashed #334155'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎯</div>
            <h3 style={{ fontSize: '20px', color: '#f8fafc', marginBottom: '8px' }}>
              No projects yet
            </h3>
            <p style={{ color: '#64748b', marginBottom: '24px' }}>
              Create your first project to start managing tasks!
            </p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              + Create Project
            </button>
          </div>
        )}
      </main>

      {/* Create Project Modal */}
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
            borderRadius: '20px',
            padding: '32px',
            width: '100%',
            maxWidth: '480px',
            border: '1px solid #334155'
          }}>
            <h3 style={{ fontSize: '22px', fontWeight: '600', color: '#f8fafc', marginBottom: '24px' }}>
              Create New Project
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '14px' }}>
                Project Name
              </label>
              <input
                type="text"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                placeholder="My Awesome Project"
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '14px' }}>
                Description (optional)
              </label>
              <textarea
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                placeholder="What is this project about?"
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '12px', color: '#94a3b8', fontSize: '14px' }}>
                Color
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewProject({ ...newProject, color })}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: color,
                      border: newProject.color === color ? '3px solid white' : '3px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                onClick={createProject}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
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
            borderRadius: '20px',
            padding: '32px',
            width: '100%',
            maxWidth: '400px',
            border: '1px solid #334155'
          }}>
            <h3 style={{ fontSize: '22px', fontWeight: '600', color: '#f8fafc', marginBottom: '24px' }}>
              Add Team Member
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '14px' }}>
                Email Address
              </label>
              <input
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                placeholder="colleague@example.com"
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '14px' }}>
                Role
              </label>
              <select
                value={newMember.role}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowAddMemberModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                onClick={addMember}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Workspace;