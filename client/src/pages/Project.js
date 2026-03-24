import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSocket, useAuth } from '../App';
import { projects as projectsApi, columns as columnsApi, tasks as tasksApi, workspaces as workspacesApi } from '../context/api';
import { format } from 'date-fns';

function Project() {
  const { id } = useParams();
  const socket = useSocket();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState({});
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', column_id: null });
  const [newColumnName, setNewColumnName] = useState('');
  const [taskComments, setTaskComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const dragOverRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (socket) {
      socket.on('task:created', (data) => {
        if (data.task) {
          setTasks(prev => ({
            ...prev,
            [data.columnId]: [...(prev[data.columnId] || []), data.task]
          }));
        }
      });
      
      socket.on('task:updated', (data) => {
        if (data.task) {
          loadData();
        }
      });
      
      socket.on('task:deleted', (data) => {
        loadData();
      });
      
      return () => {
        socket.off('task:created');
        socket.off('task:updated');
        socket.off('task:deleted');
      };
    }
  }, [socket]);

  const loadData = async () => {
    try {
      // Get project by ID from workspace
      const allWorkspaces = await workspacesApi.getAll();
      let foundProject = null;
      let workspaceId = null;
      
      for (const ws of allWorkspaces.data) {
        const projectsData = await projectsApi.getAll(ws.id);
        const project = projectsData.data.find(p => p.id === id);
        if (project) {
          foundProject = project;
          workspaceId = ws.id;
          break;
        }
      }
      
      if (!foundProject) {
        setLoading(false);
        return;
      }
      
      setProject(foundProject);
      
      const columnsData = await columnsApi.getAll(id);
      setColumns(columnsData.data);
      
      // Load tasks for each column
      const tasksObj = {};
      for (const col of columnsData.data) {
        const tasksData = await tasksApi.getByColumn(col.id);
        tasksObj[col.id] = tasksData.data;
      }
      setTasks(tasksObj);
      
      if (workspaceId) {
        const membersData = await workspacesApi.getMembers(workspaceId);
        setMembers(membersData.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async () => {
    if (!newTask.title.trim() || !newTask.column_id) return;
    try {
      const { data } = await tasksApi.create(newTask.column_id, newTask);
      setTasks(prev => ({
        ...prev,
        [newTask.column_id]: [...(prev[newTask.column_id] || []), data]
      }));
      setShowTaskModal(false);
      setNewTask({ title: '', description: '', priority: 'medium', column_id: null });
    } catch (err) {
      console.error(err);
    }
  };

  const createColumn = async () => {
    if (!newColumnName.trim()) return;
    try {
      const { data } = await columnsApi.create(id, { name: newColumnName });
      setColumns([...columns, data]);
      setTasks(prev => ({ ...prev, [data.id]: [] }));
      setShowColumnModal(false);
      setNewColumnName('');
    } catch (err) {
      console.error(err);
    }
  };

  const updateTask = async (taskId, updates) => {
    try {
      const { data } = await tasksApi.update(taskId, updates);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTask = async (taskId, columnId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await tasksApi.delete(taskId);
      setTasks(prev => ({
        ...prev,
        [columnId]: prev[columnId].filter(t => t.id !== taskId)
      }));
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragStart = (e, task, columnId) => {
    setDraggedTask({ task, columnId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    dragOverRef.current = columnId;
  };

  const handleDrop = async (e, targetColumnId) => {
    e.preventDefault();
    if (!draggedTask) return;
    
    const { task, columnId: sourceColumnId } = draggedTask;
    
    if (sourceColumnId === targetColumnId) {
      setDraggedTask(null);
      return;
    }
    
    // Optimistic update
    const sourceTasks = [...tasks[sourceColumnId]].filter(t => t.id !== task.id);
    const targetTasks = [...(tasks[targetColumnId] || []), { ...task, column_id: targetColumnId }];
    
    setTasks(prev => ({
      ...prev,
      [sourceColumnId]: sourceTasks,
      [targetColumnId]: targetTasks
    }));
    
    // API call
    try {
      await tasksApi.update(task.id, { 
        ...task, 
        column_id: targetColumnId,
        position: targetTasks.length - 1
      });
      
      if (socket) {
        socket.emit('task:move', { 
          taskId: task.id, 
          fromColumn: sourceColumnId, 
          toColumn: targetColumnId,
          projectId: id 
        });
      }
    } catch (err) {
      console.error(err);
      loadData(); // Reload on error
    }
    
    setDraggedTask(null);
    dragOverRef.current = null;
  };

  const openTaskDetails = async (task) => {
    setSelectedTask(task);
    try {
      const { data } = await tasksApi.getComments(task.id);
      setTaskComments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedTask) return;
    try {
      const { data } = await tasksApi.addComment(selectedTask.id, newComment);
      setTaskComments([data, ...taskComments]);
      setNewComment('');
    } catch (err) {
      console.error(err);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#64748b';
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
          <div style={{ fontSize: '48px', animation: 'pulse 1.5s infinite' }}>📋</div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: '#0f172a',
        color: '#f8fafc'
      }}>
        Project not found
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to={`/workspace/${localStorage.getItem('lastWorkspace') || ''}`} style={{ color: '#64748b', fontSize: '24px', textDecoration: 'none' }}>←</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: project.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}>📋</div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#f8fafc' }}>{project.name}</h1>
              <p style={{ fontSize: '12px', color: '#64748b' }}>Project Board</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => {
              setNewTask({ ...newTask, column_id: columns[0]?.id });
              setShowTaskModal(true);
            }}
            className="btn btn-primary btn-sm"
            disabled={columns.length === 0}
          >
            + Add Task
          </button>
          <button 
            onClick={() => setShowColumnModal(true)}
            className="btn btn-secondary btn-sm"
          >
            + Add Column
          </button>
        </div>
      </header>

      {/* Kanban Board */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '20px',
        padding: '24px 32px',
        overflowX: 'auto',
        alignItems: 'flex-start'
      }}>
        {columns.map((column) => (
          <div
            key={column.id}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDrop={(e) => handleDrop(e, column.id)}
            style={{
              minWidth: '320px',
              maxWidth: '320px',
              background: '#1e293b',
              borderRadius: '16px',
              border: dragOverRef.current === column.id ? '2px dashed #6366f1' : '1px solid #334155',
              transition: 'all 0.2s'
            }}
          >
            {/* Column Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#f8fafc' }}>{column.name}</h3>
                <span style={{
                  background: '#334155',
                  color: '#94a3b8',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '12px'
                }}>
                  {tasks[column.id]?.length || 0}
                </span>
              </div>
              <button
                onClick={() => {
                  setNewTask({ ...newTask, column_id: column.id });
                  setShowTaskModal(true);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: '18px'
                }}
              >
                +
              </button>
            </div>

            {/* Tasks */}
            <div style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxHeight: 'calc(100vh - 250px)',
              overflowY: 'auto'
            }}>
              {tasks[column.id]?.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task, column.id)}
                  onClick={() => openTaskDetails(task)}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: 'grab',
                    transition: 'all 0.2s'
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px'
                  }}>
                    <span 
                      className={`badge badge-${task.priority}`}
                      style={{
                        background: `${getPriorityColor(task.priority)}20`,
                        color: getPriorityColor(task.priority)
                      }}
                    >
                      {task.priority}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTask(task.id, column.id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#475569',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                  
                  <h4 style={{ 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: '#f8fafc',
                    marginBottom: '8px'
                  }}>
                    {task.title}
                  </h4>
                  
                  {task.description && (
                    <p style={{
                      fontSize: '13px',
                      color: '#64748b',
                      marginBottom: '12px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {task.description}
                    </p>
                  )}
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {task.assignees?.slice(0, 3).map((assignee) => (
                        <div
                          key={assignee.id}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#334155',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: '600',
                            color: '#f8fafc'
                          }}
                          title={assignee.name}
                        >
                          {assignee.name.charAt(0)}
                        </div>
                      ))}
                    </div>
                    
                    {task.due_date && (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        📅 {format(new Date(task.due_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              
              {(!tasks[column.id] || tasks[column.id].length === 0) && (
                <div style={{
                  textAlign: 'center',
                  padding: '30px 20px',
                  color: '#475569',
                  fontSize: '13px'
                }}>
                  No tasks yet
                </div>
              )}
            </div>
          </div>
        ))}

        {columns.length === 0 && (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <p>No columns yet. Add one to get started!</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showTaskModal && (
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
              Create New Task
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '14px' }}>
                Title
              </label>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title"
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '14px' }}>
                Description
              </label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Task description..."
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '14px' }}>
                Column
              </label>
              <select
                value={newTask.column_id || ''}
                onChange={(e) => setNewTask({ ...newTask, column_id: e.target.value })}
              >
                <option value="">Select column</option>
                {columns.map(col => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '14px' }}>
                Priority
              </label>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowTaskModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                onClick={createTask}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Column Modal */}
      {showColumnModal && (
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
              Add New Column
            </h3>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '14px' }}>
                Column Name
              </label>
              <input
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="e.g., In Review"
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowColumnModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                onClick={createColumn}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
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
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '1px solid #334155'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '22px', fontWeight: '600', color: '#f8fafc' }}>{selectedTask.title}</h3>
              <button
                onClick={() => setSelectedTask(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <span 
                style={{
                  background: `${getPriorityColor(selectedTask.priority)}20`,
                  color: getPriorityColor(selectedTask.priority),
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '500'
                }}
              >
                {selectedTask.priority}
              </span>
              {selectedTask.due_date && (
                <span style={{
                  background: '#334155',
                  color: '#94a3b8',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '13px'
                }}>
                  📅 {format(new Date(selectedTask.due_date), 'MMM d, yyyy')}
                </span>
              )}
            </div>

            {selectedTask.description && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '14px' }}>
                  Description
                </label>
                <p style={{ color: '#f8fafc', lineHeight: '1.6' }}>{selectedTask.description}</p>
              </div>
            )}

            {/* Comments Section */}
            <div style={{ marginTop: '24px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#f8fafc', marginBottom: '16px' }}>
                Comments ({taskComments.length})
              </h4>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  style={{ flex: 1 }}
                />
                <button onClick={addComment} className="btn btn-primary btn-sm">
                  Send
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {taskComments.map((comment) => (
                  <div
                    key={comment.id}
                    style={{
                      background: '#0f172a',
                      borderRadius: '12px',
                      padding: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#f8fafc'
                      }}>
                        {comment.user_name?.charAt(0) || '?'}
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#f8fafc' }}>
                        {comment.user_name}
                      </span>
                      <span style={{ fontSize: '12px', color: '#475569' }}>
                        {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.5' }}>
                      {comment.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => deleteTask(selectedTask.id, selectedTask.column_id)}
                className="btn btn-danger btn-sm"
              >
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Project;