import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}

export interface Document {
  id: string;
  title: string;
  content: string; // HTML string or Rich Text representation
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SharedDocument {
  id: string;
  documentId: string;
  userId: string;
  permission: 'edit';
}

interface DatabaseSchema {
  users: User[];
  documents: Document[];
  sharedDocuments: SharedDocument[];
}

const DB_FILE = path.join(process.cwd(), 'db.json');

// Helper to hash password using Node built-in crypto
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Generate secure random ID
export function generateId(): string {
  return crypto.randomUUID();
}

// Default seeded users
const SEEDED_USERS: User[] = [
  {
    id: 'user-alice-id',
    name: 'Alice Smith',
    email: 'alice@example.com',
    passwordHash: hashPassword('password123'),
  },
  {
    id: 'user-bob-id',
    name: 'Bob Jones',
    email: 'bob@example.com',
    passwordHash: hashPassword('password123'),
  },
  {
    id: 'user-siddhant-id',
    name: 'Siddhant Singh',
    email: 'siddhant@example.com',
    passwordHash: hashPassword('password123'),
  },
  {
    id: 'user-reviewer-id',
    name: 'Reviewer Account',
    email: 'reviewer@example.com',
    passwordHash: hashPassword('password123'),
  }
];

class Database {
  private data: DatabaseSchema = {
    users: [],
    documents: [],
    sharedDocuments: [],
  };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(fileContent);
        // Ensure seeded users exist even if some are deleted
        this.ensureSeededUsers();
      } else {
        this.data = {
          users: SEEDED_USERS,
          documents: [],
          sharedDocuments: [],
        };
        this.save();
      }
    } catch (error) {
      console.error('Error loading database, resetting to default:', error);
      this.data = {
        users: SEEDED_USERS,
        documents: [],
        sharedDocuments: [],
      };
      this.save();
    }
  }

  private ensureSeededUsers() {
    let modified = false;
    for (const seed of SEEDED_USERS) {
      if (!this.data.users.some(u => u.email === seed.email)) {
        this.data.users.push(seed);
        modified = true;
      }
    }
    if (modified) {
      this.save();
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  // User Operations
  getUsers(): User[] {
    this.load();
    return this.data.users;
  }

  getUserById(id: string): User | undefined {
    this.load();
    return this.data.users.find(u => u.id === id);
  }

  getUserByEmail(email: string): User | undefined {
    this.load();
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  // Document Operations
  getDocuments(): Document[] {
    this.load();
    return this.data.documents;
  }

  getDocumentsByOwner(ownerId: string): Document[] {
    this.load();
    return this.data.documents.filter(d => d.ownerId === ownerId);
  }

  getDocumentById(id: string): Document | undefined {
    this.load();
    return this.data.documents.find(d => d.id === id);
  }

  createDocument(title: string, content: string, ownerId: string): Document {
    this.load();
    const now = new Date().toISOString();
    const doc: Document = {
      id: generateId(),
      title,
      content,
      ownerId,
      createdAt: now,
      updatedAt: now,
    };
    this.data.documents.push(doc);
    this.save();
    return doc;
  }

  updateDocument(id: string, updates: Partial<Pick<Document, 'title' | 'content'>>): Document | undefined {
    this.load();
    const doc = this.data.documents.find(d => d.id === id);
    if (!doc) return undefined;

    if (updates.title !== undefined) {
      doc.title = updates.title;
    }
    if (updates.content !== undefined) {
      doc.content = updates.content;
    }
    doc.updatedAt = new Date().toISOString();
    this.save();
    return doc;
  }

  deleteDocument(id: string): boolean {
    this.load();
    const index = this.data.documents.findIndex(d => d.id === id);
    if (index === -1) return false;

    this.data.documents.splice(index, 1);
    // Also remove any shares for this document
    this.data.sharedDocuments = this.data.sharedDocuments.filter(s => s.documentId !== id);
    this.save();
    return true;
  }

  // Sharing Operations
  getSharedWithUsers(documentId: string): { user: Pick<User, 'id' | 'name' | 'email'>; permission: 'edit' }[] {
    this.load();
    const shares = this.data.sharedDocuments.filter(s => s.documentId === documentId);
    return shares.map(share => {
      const user = this.getUserById(share.userId);
      return {
        user: user ? { id: user.id, name: user.name, email: user.email } : { id: share.userId, name: 'Unknown User', email: '' },
        permission: share.permission
      };
    });
  }

  getSharedDocumentsForUser(userId: string): Document[] {
    this.load();
    const docIds = this.data.sharedDocuments
      .filter(s => s.userId === userId)
      .map(s => s.documentId);
    return this.data.documents.filter(d => docIds.includes(d.id));
  }

  shareDocument(documentId: string, email: string, permission: 'edit'): { success: boolean; message: string } {
    this.load();
    const doc = this.getDocumentById(documentId);
    if (!doc) {
      return { success: false, message: 'Document not found' };
    }

    const targetUser = this.getUserByEmail(email);
    if (!targetUser) {
      return { success: false, message: 'User not found with this email' };
    }

    if (targetUser.id === doc.ownerId) {
      return { success: false, message: 'Cannot share document with yourself' };
    }

    // Check if already shared
    const existingShare = this.data.sharedDocuments.find(
      s => s.documentId === documentId && s.userId === targetUser.id
    );
    if (existingShare) {
      return { success: false, message: 'Document is already shared with this user' };
    }

    const share: SharedDocument = {
      id: generateId(),
      documentId,
      userId: targetUser.id,
      permission,
    };
    this.data.sharedDocuments.push(share);
    this.save();
    return { success: true, message: 'Shared successfully' };
  }

  revokeShare(documentId: string, userId: string): boolean {
    this.load();
    const index = this.data.sharedDocuments.findIndex(
      s => s.documentId === documentId && s.userId === userId
    );
    if (index === -1) return false;

    this.data.sharedDocuments.splice(index, 1);
    this.save();
    return true;
  }

  hasAccess(documentId: string, userId: string): { read: boolean; edit: boolean } {
    this.load();
    const doc = this.getDocumentById(documentId);
    if (!doc) return { read: false, edit: false };

    // Owner has full access
    if (doc.ownerId === userId) {
      return { read: true, edit: true };
    }

    // Check shared document list
    const share = this.data.sharedDocuments.find(
      s => s.documentId === documentId && s.userId === userId
    );
    if (share) {
      return { read: true, edit: share.permission === 'edit' };
    }

    return { read: false, edit: false };
  }
}

export const db = new Database();
