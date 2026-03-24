const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// In-memory database
const db = {
  users: [],
  workspaces: [],
  workspaceMembers: [],
  projects: [],
  columns: [],
  tasks: [],
  taskAssignees: [],
  comments: []
};

const JWT_SECRET = 'taskflow-secret-key-2024';

// Helper functions
const findById = (collection, id) => collection.find(item => item.id === id);
const findByField = (collection, field, value) => collection.filter(item => item[field] === value);

// Auth Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ============ AUTH ROUTES ============

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (findByField(db.users, 'email', email).length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      name,
      avatar: null,
      created_at: new Date().toISOString()
    };
    
    db.users.push(user);
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = findByField(db.users, 'email', email)[0];
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = findById(db.users, req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email, name: user.name, avatar: user.avatar });
});

// ============ WORKSPACE ROUTES ============

app.get('/api/workspaces', authenticate, (req, res) => {
  const userWorkspaces = findByField(db.workspaceMembers, 'user_id', req.userId);
  const workspaces = userWorkspaces.map(uw => findById(db.workspaces, uw.workspace_id)).filter(Boolean);
  res.json(workspaces);
});

app.post('/api/workspaces', authenticate, (req, res) => {
  const { name } = req.body;
  const workspace = {
    id: uuidv4(),
    name,
    owner_id: req.userId,
    created_at: new Date().toISOString()
  };
  
  db.workspaces.push(workspace);
  db.workspaceMembers.push({
    workspace_id: workspace.id,
    user_id: req.userId,
    role: 'owner'
  });
  
  res.json(workspace);
});

app.get('/api/workspaces/:id/members', authenticate, (req, res) => {
  const members = findByField(db.workspaceMembers, 'workspace_id', req.params.id).map(wm => {
    const user = findById(db.users, wm.user_id);
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: wm.role
    };
  }).filter(Boolean);
  res.json(members);
});

app.post('/api/workspaces/:id/members', authenticate, (req, res) => {
  const { email, role } = req.body;
  const user = findByField(db.users, 'email', email)[0];
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const existingMember = db.workspaceMembers.find(
    wm => wm.workspace_id === req.params.id && wm.user_id === user.id
  );
  
  if (!existingMember) {
    db.workspaceMembers.push({
      workspace_id: req.params.id,
      user_id: user.id,
      role: role || 'member'
    });
  }
  
  res.json({ success: true });
});

app.get('/api/workspaces/:workspaceId/analytics', authenticate, (req, res) => {
  const projects = findByField(db.projects, 'workspace_id', req.params.workspaceId);
  const projectIds = projects.map(p => p.id);
  
  const projectColumns = db.columns.filter(c => projectIds.includes(c.project_id));
  const columnIds = projectColumns.map(c => c.id);
  
  const allTasks = db.tasks.filter(t => columnIds.includes(t.column_id));
  
  const tasksByPriority = [
    { priority: 'high', count: allTasks.filter(t => t.priority === 'high').length },
    { priority: 'medium', count: allTasks.filter(t => t.priority === 'medium').length },
    { priority: 'low', count: allTasks.filter(t => t.priority === 'low').length }
  ];
  
  const tasksByStatus = projectColumns.map(col => ({
    status: col.name,
    count: db.tasks.filter(t => t.column_id === col.id).length
  }));
  
  const recentTasks = allTasks
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10)
    .map(task => {
      const col = findById(db.columns, task.column_id);
      const proj = col ? findById(db.projects, col.project_id) : null;
      return {
        ...task,
        column_name: col?.name || '',
        project_name: proj?.name || ''
      };
    });
  
  res.json({
    totalProjects: projects.length,
    totalTasks: allTasks.length,
    tasksByPriority,
    tasksByStatus,
    recentTasks
  });
});

// ============ PROJECT ROUTES ============

app.get('/api/workspaces/:workspaceId/projects', authenticate, (req, res) => {
  const projects = findByField(db.projects, 'workspace_id', req.params.workspaceId);
  res.json(projects);
});

app.post('/api/workspaces/:workspaceId/projects', authenticate, (req, res) => {
  const { name, description, color } = req.body;
  const project = {
    id: uuidv4(),
    workspace_id: req.params.workspaceId,
    name,
    description: description || '',
    color: color || '#6366f1',
    created_at: new Date().toISOString()
  };
  
  db.projects.push(project);
  
  // Create default columns
  const defaultColumns = ['To Do', 'In Progress', 'Done'];
  defaultColumns.forEach((colName, index) => {
    db.columns.push({
      id: uuidv4(),
      project_id: project.id,
      name: colName,
      position: index
    });
  });
  
  res.json(project);
});

app.delete('/api/projects/:id', authenticate, (req, res) => {
  const projectIndex = db.projects.findIndex(p => p.id === req.params.id);
  if (projectIndex > -1) {
    db.projects.splice(projectIndex, 1);
    
    // Delete related columns and tasks
    const projectColumns = db.columns.filter(c => c.project_id === req.params.id);
    projectColumns.forEach(col => {
      const colTasks = db.tasks.filter(t => t.column_id === col.id);
      colTasks.forEach(task => {
        const taskIndex = db.tasks.findIndex(t => t.id === task.id);
        if (taskIndex > -1) db.tasks.splice(taskIndex, 1);
      });
      const colIndex = db.columns.findIndex(c => c.id === col.id);
      if (colIndex > -1) db.columns.splice(colIndex, 1);
    });
  }
  res.json({ success: true });
});

// ============ COLUMN ROUTES ============

app.get('/api/projects/:projectId/columns', authenticate, (req, res) => {
  const columns = findByField(db.columns, 'project_id', req.params.projectId)
    .sort((a, b) => a.position - b.position);
  res.json(columns);
});

app.post('/api/projects/:projectId/columns', authenticate, (req, res) => {
  const { name } = req.body;
  const projectColumns = findByField(db.columns, 'project_id', req.params.projectId);
  const maxPosition = projectColumns.length > 0 
    ? Math.max(...projectColumns.map(c => c.position)) 
    : -1;
  
  const column = {
    id: uuidv4(),
    project_id: req.params.projectId,
    name,
    position: maxPosition + 1
  };
  
  db.columns.push(column);
  res.json(column);
});

app.put('/api/columns/:id', authenticate, (req, res) => {
  const { name, position } = req.body;
  const column = findById(db.columns, req.params.id);
  
  if (column) {
    column.name = name || column.name;
    column.position = position !== undefined ? position : column.position;
  }
  
  res.json({ success: true });
});

app.delete('/api/columns/:id', authenticate, (req, res) => {
  const columnIndex = db.columns.findIndex(c => c.id === req.params.id);
  if (columnIndex > -1) {
    // Delete tasks in this column
    const columnTasks = db.tasks.filter(t => t.column_id === req.params.id);
    columnTasks.forEach(task => {
      const taskIndex = db.tasks.findIndex(t => t.id === task.id);
      if (taskIndex > -1) db.tasks.splice(taskIndex, 1);
    });
    db.columns.splice(columnIndex, 1);
  }
  res.json({ success: true });
});

// ============ TASK ROUTES ============

app.get('/api/columns/:columnId/tasks', authenticate, (req, res) => {
  const tasks = findByField(db.tasks, 'column_id', req.params.columnId)
    .sort((a, b) => a.position - b.position);
  
  const tasksWithAssignees = tasks.map(task => ({
    ...task,
    assignees: db.taskAssignees
      .filter(ta => ta.task_id === task.id)
      .map(ta => {
        const user = findById(db.users, ta.user_id);
        return user ? { id: user.id, name: user.name, email: user.email } : null;
      }).filter(Boolean)
  }));
  
  res.json(tasksWithAssignees);
});

app.post('/api/columns/:columnId/tasks', authenticate, (req, res) => {
  const { title, description, priority, due_date, labels } = req.body;
  const columnTasks = findByField(db.tasks, 'column_id', req.params.columnId);
  const maxPosition = columnTasks.length > 0 
    ? Math.max(...columnTasks.map(t => t.position)) 
    : -1;
  
  const task = {
    id: uuidv4(),
    column_id: req.params.columnId,
    title,
    description: description || '',
    priority: priority || 'medium',
    due_date: due_date || null,
    labels: JSON.stringify(labels || []),
    position: maxPosition + 1,
    created_at: new Date().toISOString()
  };
  
  db.tasks.push(task);
  
  io.emit('task:created', { task, columnId: req.params.columnId });
  
  res.json({ ...task, assignees: [] });
});

app.put('/api/tasks/:id', authenticate, (req, res) => {
  const { title, description, priority, due_date, labels, column_id, position } = req.body;
  const task = findById(db.tasks, req.params.id);
  
  if (!task) return res.status(404).json({ error: 'Task not found' });
  
  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (priority !== undefined) task.priority = priority;
  if (due_date !== undefined) task.due_date = due_date;
  if (labels !== undefined) task.labels = JSON.stringify(labels);
  if (column_id !== undefined) task.column_id = column_id;
  if (position !== undefined) task.position = position;
  
  const assignees = db.taskAssignees
    .filter(ta => ta.task_id === task.id)
    .map(ta => {
      const user = findById(db.users, ta.user_id);
      return user ? { id: user.id, name: user.name, email: user.email } : null;
    }).filter(Boolean);
  
  io.emit('task:updated', { task: { ...task, assignees } });
  
  res.json({ ...task, assignees });
});

app.delete('/api/tasks/:id', authenticate, (req, res) => {
  const taskIndex = db.tasks.findIndex(t => t.id === req.params.id);
  if (taskIndex > -1) {
    db.tasks.splice(taskIndex, 1);
    // Remove assignees
    db.taskAssignees = db.taskAssignees.filter(ta => ta.task_id !== req.params.id);
    io.emit('task:deleted', { taskId: req.params.id });
  }
  res.json({ success: true });
});

app.post('/api/tasks/:id/assignees', authenticate, (req, res) => {
  const { userId } = req.body;
  const existing = db.taskAssignees.find(
    ta => ta.task_id === req.params.id && ta.user_id === userId
  );
  
  if (!existing) {
    db.taskAssignees.push({ task_id: req.params.id, user_id: userId });
  }
  
  res.json({ success: true });
});

app.delete('/api/tasks/:taskId/assignees/:userId', authenticate, (req, res) => {
  const index = db.taskAssignees.findIndex(
    ta => ta.task_id === req.params.taskId && ta.user_id === req.params.userId
  );
  if (index > -1) {
    db.taskAssignees.splice(index, 1);
  }
  res.json({ success: true });
});

// ============ COMMENTS ROUTES ============

app.get('/api/tasks/:taskId/comments', authenticate, (req, res) => {
  const comments = findByField(db.comments, 'task_id', req.params.taskId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(c => {
      const user = findById(db.users, c.user_id);
      return {
        ...c,
        user_name: user?.name || 'Unknown',
        user_email: user?.email || ''
      };
    });
  res.json(comments);
});

app.post('/api/tasks/:taskId/comments', authenticate, (req, res) => {
  const { content } = req.body;
  const comment = {
    id: uuidv4(),
    task_id: req.params.taskId,
    user_id: req.userId,
    content,
    created_at: new Date().toISOString()
  };
  
  db.comments.push(comment);
  
  const user = findById(db.users, req.userId);
  const fullComment = {
    ...comment,
    user_name: user?.name || 'Unknown',
    user_email: user?.email || ''
  };
  
  io.emit('comment:created', { comment: fullComment });
  
  res.json(fullComment);
});

// ============ WEBSOCKET ============

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join:workspace', (workspaceId) => {
    socket.join(`workspace:${workspaceId}`);
  });
  
  socket.on('task:move', (data) => {
    socket.to(`workspace:${data.workspaceId}`).emit('task:moved', data);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});