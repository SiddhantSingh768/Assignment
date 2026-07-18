import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { db, hashPassword } from './server/db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// In-Memory Active Sessions (token -> userId)
const activeSessions = new Map<string, string>();

// Simple Token Middleware to Authenticate Requests
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.substring(7);
  const userId = activeSessions.get(token);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  const user = db.getUserById(userId);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: User not found' });
  }

  // Attach user to request object
  (req as any).user = user;
  (req as any).token = token;
  next();
}

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// POST /api/login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.getUserByEmail(email);
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Generate session token
  const token = `token_${crypto.randomBytes(32).toString('hex')}`;
  activeSessions.set(token, user.id);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

// POST /api/logout
app.post('/api/logout', authenticate, (req, res) => {
  const token = (req as any).token;
  activeSessions.delete(token);
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/me
app.get('/api/me', authenticate, (req, res) => {
  const user = (req as any).user;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
  });
});

// GET /api/users (for searching users to share with)
app.get('/api/users', authenticate, (req, res) => {
  const currentUser = (req as any).user;
  // Return all users except current logged in user
  const allUsers = db.getUsers()
    .filter(u => u.id !== currentUser.id)
    .map(u => ({ id: u.id, name: u.name, email: u.email }));
  res.json(allUsers);
});

// ==========================================
// DOCUMENT ENDPOINTS
// ==========================================

// GET /api/documents
app.get('/api/documents', authenticate, (req, res) => {
  const user = (req as any).user;
  const docs = db.getDocumentsByOwner(user.id);
  res.json(docs);
});

// POST /api/documents
app.post('/api/documents', authenticate, (req, res) => {
  const user = (req as any).user;
  const { title, content } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (title.length > 100) {
    return res.status(400).json({ error: 'Title must be 100 characters or less' });
  }

  const doc = db.createDocument(title, content || '', user.id);
  res.status(201).json(doc);
});

// GET /api/documents/shared
app.get('/api/documents/shared', authenticate, (req, res) => {
  const user = (req as any).user;
  const docs = db.getSharedDocumentsForUser(user.id);
  
  // Attach owner details to each shared doc
  const sharedDocsWithOwner = docs.map(doc => {
    const owner = db.getUserById(doc.ownerId);
    return {
      ...doc,
      ownerName: owner ? owner.name : 'Unknown Owner',
      ownerEmail: owner ? owner.email : '',
    };
  });
  
  res.json(sharedDocsWithOwner);
});

// GET /api/documents/:id
app.get('/api/documents/:id', authenticate, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  const doc = db.getDocumentById(id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const access = db.hasAccess(id, user.id);
  if (!access.read) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const owner = db.getUserById(doc.ownerId);

  res.json({
    ...doc,
    ownerName: owner ? owner.name : 'Unknown Owner',
    ownerEmail: owner ? owner.email : '',
    userPermission: doc.ownerId === user.id ? 'owner' : 'edit',
  });
});

// PUT /api/documents/:id
app.put('/api/documents/:id', authenticate, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { title, content } = req.body;

  const doc = db.getDocumentById(id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const access = db.hasAccess(id, user.id);
  if (!access.edit) {
    return res.status(403).json({ error: 'Permission denied: Edit access required' });
  }

  if (title !== undefined) {
    if (!title.trim()) {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }
    if (title.length > 100) {
      return res.status(400).json({ error: 'Title must be 100 characters or less' });
    }
  }

  const updatedDoc = db.updateDocument(id, { title, content });
  res.json(updatedDoc);
});

// PATCH /api/documents/:id/title (Rename document)
app.patch('/api/documents/:id/title', authenticate, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { title } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (title.length > 100) {
    return res.status(400).json({ error: 'Title must be 100 characters or less' });
  }

  const doc = db.getDocumentById(id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const access = db.hasAccess(id, user.id);
  if (!access.edit) {
    return res.status(403).json({ error: 'Permission denied: Edit access required' });
  }

  const updatedDoc = db.updateDocument(id, { title });
  res.json(updatedDoc);
});

// DELETE /api/documents/:id
app.delete('/api/documents/:id', authenticate, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  const doc = db.getDocumentById(id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Only the owner can delete the document
  if (doc.ownerId !== user.id) {
    return res.status(403).json({ error: 'Permission denied: Only the owner can delete this document' });
  }

  db.deleteDocument(id);
  res.json({ success: true, message: 'Document deleted successfully' });
});

// ==========================================
// FILE UPLOAD ENDPOINT
// ==========================================

// POST /api/upload
app.post('/api/upload', authenticate, (req, res) => {
  const user = (req as any).user;
  const { fileName, fileContent } = req.body;

  if (!fileName || !fileContent) {
    return res.status(400).json({ error: 'fileName and fileContent are required' });
  }

  const ext = path.extname(fileName).toLowerCase();
  if (ext !== '.txt' && ext !== '.md') {
    return res.status(400).json({ error: 'Invalid file format. Only .txt and .md files are supported.' });
  }

  // Create clean title (strip extension)
  const title = path.basename(fileName, ext);
  if (title.length > 100) {
    return res.status(400).json({ error: 'File title is too long (max 100 chars)' });
  }

  // Convert plain text newline breaks to HTML paragraph format so it shows correctly in Rich text editor
  const formattedContent = fileContent
    .split('\n')
    .map((p: string) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('');

  const doc = db.createDocument(title, formattedContent, user.id);
  res.status(201).json(doc);
});

// ==========================================
// SHARING ENDPOINTS
// ==========================================

// POST /api/documents/:id/share
app.post('/api/documents/:id/share', authenticate, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { email, permission } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const doc = db.getDocumentById(id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Only the owner can share a document
  if (doc.ownerId !== user.id) {
    return res.status(403).json({ error: 'Permission denied: Only the owner can share this document' });
  }

  const shareResult = db.shareDocument(id, email, permission || 'edit');
  if (!shareResult.success) {
    return res.status(400).json({ error: shareResult.message });
  }

  res.json({ success: true, message: shareResult.message });
});

// GET /api/documents/:id/access
app.get('/api/documents/:id/access', authenticate, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  const doc = db.getDocumentById(id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Only owner or shared access users can view access lists
  const access = db.hasAccess(id, user.id);
  if (!access.read) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const shares = db.getSharedWithUsers(id);
  res.json({
    owner: db.getUserById(doc.ownerId) ? {
      name: db.getUserById(doc.ownerId)!.name,
      email: db.getUserById(doc.ownerId)!.email,
    } : { name: 'Unknown', email: '' },
    sharedWith: shares
  });
});

// DELETE /api/documents/:id/share/:userId (Revoke share access)
app.delete('/api/documents/:id/share/:targetUserId', authenticate, (req, res) => {
  const user = (req as any).user;
  const { id, targetUserId } = req.params;

  const doc = db.getDocumentById(id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Only the owner can revoke sharing
  if (doc.ownerId !== user.id) {
    return res.status(403).json({ error: 'Permission denied' });
  }

  const success = db.revokeShare(id, targetUserId);
  if (!success) {
    return res.status(404).json({ error: 'Access record not found for this user' });
  }

  res.json({ success: true, message: 'Access revoked successfully' });
});

// Metadata API
app.get('/api/metadata', (req, res) => {
  res.json({
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    currentTime: new Date().toISOString(),
  });
});

// Integrate Vite dev server or serve static dist
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const MAX_PORT_TRIES = 10;

function startServer(port: number, attempt = 1) {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${port}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE' && attempt < MAX_PORT_TRIES) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is busy. Retrying on ${nextPort}...`);
      startServer(nextPort, attempt + 1);
      return;
    }

    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

startServer(DEFAULT_PORT);
