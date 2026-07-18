import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Upload, Share2, Trash2, LogOut, Search, 
  Bold, Italic, Underline, Heading1, Heading2, List, ListOrdered, 
  Save, Check, AlertCircle, RefreshCw, Users, FileDown, Clock,
  ChevronRight, AlignLeft, UserPlus, X, HelpCircle, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Interfaces for State Management
interface UserProfile {
  id: string;
  name: string;
  email: string;
}

interface Document {
  id: string;
  title: string;
  content: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  ownerName?: string;
  ownerEmail?: string;
  userPermission?: 'owner' | 'edit';
}

interface ShareAccess {
  user: {
    id: string;
    name: string;
    email: string;
  };
  permission: 'edit';
}

interface DocumentAccessInfo {
  owner: {
    name: string;
    email: string;
  };
  sharedWith: ShareAccess[];
}

export default function App() {
  // --- AUTHENTICATION STATE ---
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('doc_editor_token'));
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // --- SEEDED ACCOUNTS ---
  const seededAccounts = [
    { name: 'Alice Smith', email: 'alice@example.com', desc: 'Project Owner' },
    { name: 'Bob Jones', email: 'bob@example.com', desc: 'Lead Reviewer' },
    { name: 'Siddhant Singh', email: 'siddhant@example.com', desc: 'Developer Persona' },
    { name: 'Reviewer Account', email: 'reviewer@example.com', desc: 'External Evaluator' }
  ];

  // --- WORKSPACE & DOCUMENTS STATE ---
  const [myDocuments, setMyDocuments] = useState<Document[]>([]);
  const [sharedDocuments, setSharedDocuments] = useState<Document[]>([]);
  const [activeDocument, setActiveDocument] = useState<Document | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [editorTitle, setEditorTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  // --- USER LOOKUP LIST (For sharing) ---
  const [allSystemUsers, setAllSystemUsers] = useState<UserProfile[]>([]);

  // --- MODALS STATE ---
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareDocId, setShareDocId] = useState<string | null>(null);
  const [docAccessInfo, setDocAccessInfo] = useState<DocumentAccessInfo | null>(null);
  const [shareEmailInput, setShareEmailInput] = useState('');
  const [sharePermissionInput, setSharePermissionInput] = useState<'edit'>('edit');
  const [shareModalError, setShareModalError] = useState<string | null>(null);
  const [shareModalSuccess, setShareModalSuccess] = useState<string | null>(null);
  const [isSharingActionLoading, setIsSharingActionLoading] = useState(false);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- GENERAL NOTIFICATION ---
  const [globalNotification, setGlobalNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Editor DOM reference
  const editorRef = useRef<HTMLDivElement | null>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- STARTUP LOGIC ---
  useEffect(() => {
    if (token) {
      loadUserProfile();
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      loadWorkspace();
      loadSystemUsers();
    }
  }, [user]);

  // --- NOTIFICATION DISPLAY BANNER TIMER ---
  const showNotification = (type: 'success' | 'error', message: string) => {
    setGlobalNotification({ type, message });
    setTimeout(() => {
      setGlobalNotification(null);
    }, 4500);
  };

  // --- AUTH OPERATIONS ---
  const loadUserProfile = async () => {
    try {
      const res = await fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        // Token expired or invalid
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to authenticate user token:', err);
      handleLogout();
    }
  };

  const loadSystemUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const users = await res.json();
        setAllSystemUsers(users);
      }
    } catch (err) {
      console.error('Could not load lookup users:', err);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setAuthError('Please fill in both email and password.');
      return;
    }

    setAuthError(null);
    setIsAuthenticating(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('doc_editor_token', data.token);
      setToken(data.token);
      setUser(data.user);
      showNotification('success', `Welcome back, ${data.user.name}!`);
      setLoginEmail('');
      setLoginPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (err) {
        console.error('Logout request failed:', err);
      }
    }
    localStorage.removeItem('doc_editor_token');
    setToken(null);
    setUser(null);
    setActiveDocument(null);
    setMyDocuments([]);
    setSharedDocuments([]);
  };

  const quickSelectAccount = (email: string) => {
    setLoginEmail(email);
    setLoginPassword('password123');
    setAuthError(null);
  };

  // --- WORKSPACE & DOCUMENTS CRUD ---
  const loadWorkspace = async () => {
    if (!token) return;
    setWorkspaceLoading(true);
    try {
      // Fetch owned documents
      const ownedRes = await fetch('/api/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Fetch shared documents
      const sharedRes = await fetch('/api/documents/shared', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (ownedRes.ok && sharedRes.ok) {
        const ownedData = await ownedRes.json();
        const sharedData = await sharedRes.json();
        setMyDocuments(ownedData);
        setSharedDocuments(sharedData);
      }
    } catch (err) {
      console.error('Error loading documents workspace:', err);
      showNotification('error', 'Failed to retrieve documents list.');
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const selectDocument = async (docId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const doc = await res.json();
        setActiveDocument(doc);
        setEditorTitle(doc.title);
        setEditorContent(doc.content);
        setSaveStatus('saved');
        
        // Update DOM editable directly
        if (editorRef.current) {
          editorRef.current.innerHTML = doc.content;
        }

        // Set last saved string
        const saveDate = new Date(doc.updatedAt);
        setLastSavedTime(saveDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else {
        const err = await res.json();
        showNotification('error', err.error || 'Failed to open document');
      }
    } catch (err) {
      showNotification('error', 'Network error opening document');
    }
  };

  const createNewDocument = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: 'Untitled Document',
          content: '<h2>Start writing here...</h2><p>Select text to format.</p>'
        })
      });

      if (res.ok) {
        const newDoc = await res.json();
        showNotification('success', 'Document created successfully');
        await loadWorkspace();
        selectDocument(newDoc.id);
      } else {
        showNotification('error', 'Could not create new document');
      }
    } catch (err) {
      showNotification('error', 'Network error creating document');
    }
  };

  const handleRenameDocument = async (docId: string, newTitle: string) => {
    if (!token || !newTitle.trim()) return;
    if (newTitle.length > 100) {
      showNotification('error', 'Title must be 100 characters or less');
      return;
    }

    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitle })
      });

      if (res.ok) {
        const updated = await res.json();
        if (activeDocument?.id === docId) {
          setActiveDocument(prev => prev ? { ...prev, title: updated.title } : null);
          setEditorTitle(updated.title);
        }
        await loadWorkspace();
        showNotification('success', 'Document renamed');
      } else {
        const data = await res.json();
        showNotification('error', data.error || 'Failed to rename document');
      }
    } catch (err) {
      showNotification('error', 'Network error renaming document');
    }
  };

  const handleDeleteDocument = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening
    if (!token) return;
    
    if (!confirm('Are you absolutely sure you want to delete this document? This action is permanent and will revoke access for all shared users.')) {
      return;
    }

    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        showNotification('success', 'Document deleted successfully');
        if (activeDocument?.id === docId) {
          setActiveDocument(null);
          setEditorContent('');
          setEditorTitle('');
        }
        loadWorkspace();
      } else {
        const data = await res.json();
        showNotification('error', data.error || 'Failed to delete document');
      }
    } catch (err) {
      showNotification('error', 'Network error deleting document');
    }
  };

  // --- SAVE OPERATION (AUTOSAVE AND MANUAL SAVE) ---
  const saveDocumentContent = async (isAutosave: boolean = false) => {
    if (!activeDocument || !token) return;

    if (!isAutosave) {
      setIsSaving(true);
    }
    setSaveStatus('saving');

    try {
      const currentContent = editorRef.current ? editorRef.current.innerHTML : editorContent;

      const res = await fetch(`/api/documents/${activeDocument.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: editorTitle,
          content: currentContent
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setSaveStatus('saved');
        const now = new Date();
        setLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        
        // Update local items silently in workspace without doing full loadWorkspace network hit
        setMyDocuments(prev => prev.map(d => d.id === updated.id ? updated : d));
        setSharedDocuments(prev => prev.map(d => d.id === updated.id ? updated : d));
        
        if (!isAutosave) {
          showNotification('success', 'Document saved successfully');
        }
      } else {
        setSaveStatus('unsaved');
        if (!isAutosave) {
          showNotification('error', 'Failed to save document changes');
        }
      }
    } catch (err) {
      setSaveStatus('unsaved');
      if (!isAutosave) {
        showNotification('error', 'Connection lost. Changes not saved.');
      }
    } finally {
      if (!isAutosave) {
        setIsSaving(false);
      }
    }
  };

  // Trigger autosave with 3 seconds debounce on input changes
  const handleEditorInput = () => {
    setSaveStatus('unsaved');
    
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      saveDocumentContent(true);
    }, 2500);
  };

  // Handle immediate manual save
  const handleManualSave = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    saveDocumentContent(false);
  };

  // Clean up timer on active document swap or component destroy
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [activeDocument]);

  // --- RICH TEXT FORMATTING TOOLBAR EXECUTION ---
  const formatText = (command: string, value: string = '') => {
    // Focus back on editor sheet first
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
    handleEditorInput();
  };

  // --- ACCESS & SHARING OPERATIONS ---
  const openShareModal = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening doc
    setShareDocId(docId);
    setShareEmailInput('');
    setShareModalError(null);
    setShareModalSuccess(null);
    setIsShareModalOpen(true);
    loadDocAccessInfo(docId);
  };

  const loadDocAccessInfo = async (docId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/documents/${docId}/access`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const info = await res.json();
        setDocAccessInfo(info);
      } else {
        setShareModalError('Could not load sharing details');
      }
    } catch (err) {
      setShareModalError('Network error loading access info');
    }
  };

  const handleShareDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !shareDocId || !shareEmailInput.trim()) return;

    setIsSharingActionLoading(true);
    setShareModalError(null);
    setShareModalSuccess(null);

    try {
      const res = await fetch(`/api/documents/${shareDocId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: shareEmailInput.trim(),
          permission: sharePermissionInput
        })
      });

      const data = await res.json();
      if (res.ok) {
        setShareModalSuccess(`Successfully shared with ${shareEmailInput}`);
        setShareEmailInput('');
        loadDocAccessInfo(shareDocId);
        loadWorkspace();
      } else {
        setShareModalError(data.error || 'Failed to share document');
      }
    } catch (err) {
      setShareModalError('Network error sharing document');
    } finally {
      setIsSharingActionLoading(false);
    }
  };

  const handleRevokeShare = async (targetUserId: string) => {
    if (!token || !shareDocId) return;
    if (!confirm('Are you sure you want to revoke this user\'s access to the document?')) return;

    try {
      const res = await fetch(`/api/documents/${shareDocId}/share/${targetUserId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setShareModalSuccess('Access revoked successfully');
        loadDocAccessInfo(shareDocId);
        loadWorkspace();
      } else {
        const data = await res.json();
        setShareModalError(data.error || 'Failed to revoke access');
      }
    } catch (err) {
      setShareModalError('Network error revoking access');
    }
  };

  // --- FILE IMPORT WORKFLOW ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (file: File) => {
    setUploadError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'txt' && ext !== 'md') {
      setUploadError('Invalid file format. Only .txt and .md files are supported.');
      setUploadFile(null);
      return;
    }

    if (file.size === 0) {
      setUploadError('File is empty.');
      setUploadFile(null);
      return;
    }

    setUploadFile(file);
  };

  const handleImportFile = async () => {
    if (!token || !uploadFile) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileContent = e.target?.result as string;
        
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              fileName: uploadFile.name,
              fileContent: fileContent
            })
          });

          const data = await res.json();
          if (res.ok) {
            showNotification('success', `Successfully imported ${uploadFile.name}!`);
            setIsUploadModalOpen(false);
            setUploadFile(null);
            await loadWorkspace();
            selectDocument(data.id);
          } else {
            setUploadError(data.error || 'Failed to import file contents.');
          }
        } catch (err) {
          setUploadError('Network error uploading file.');
        } finally {
          setIsUploading(false);
        }
      };

      reader.readAsText(uploadFile);
    } catch (err) {
      setUploadError('Failed to read the file.');
      setIsUploading(false);
    }
  };

  return (
    <div id="app_container" className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* GLOBAL TOAST BANNER */}
      <AnimatePresence>
        {globalNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            id="toast_notification"
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm max-w-md w-full md:w-auto font-medium ${
              globalNotification.type === 'success' 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                : 'bg-rose-50 border-rose-100 text-rose-800'
            }`}
          >
            {globalNotification.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <p className="flex-1">{globalNotification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {!user ? (
        // ==========================================
        // LOGIN PAGE VIEW (AUTHENTICATION)
        // ==========================================
        <div id="login_screen" className="flex-1 flex flex-col md:flex-row min-h-screen items-stretch bg-[#fafbfd]">
          {/* Aesthetic Brand Hero Sidebar */}
          <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 bg-indigo-950 p-12 text-indigo-100 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.2),transparent)]" />
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-[80px]" />

            <div className="flex items-center gap-2.5 relative z-10">
              <div className="bg-indigo-500/10 border border-indigo-500/30 p-2 rounded-xl text-indigo-300">
                <FileText className="w-5.5 h-5.5 animate-pulse" />
              </div>
              <span className="font-semibold text-lg tracking-wide font-mono text-white">ShareDoc.io</span>
            </div>

            <div className="relative z-10 space-y-4">
              <h1 className="text-3xl font-bold tracking-tight text-white leading-tight">
                Collaborative Document Workspace
              </h1>
              <p className="text-sm text-indigo-200/80 leading-relaxed">
                Create elegant rich-text documents, organize file structures, import text configurations, and share seamlessly with peers in a real-time developer preview.
              </p>
            </div>

            <div className="relative z-10 pt-8 border-t border-indigo-900 flex justify-between text-xs text-indigo-300 font-mono">
              <span>PRD Specs Verified</span>
              <span>v1.0 (PostgreSQL Core)</span>
            </div>
          </div>

          {/* Core Access Panel */}
          <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12">
            <div className="w-full max-w-md space-y-8">
              {/* Login Title */}
              <div className="text-center md:text-left">
                <div className="flex items-center gap-2.5 justify-center md:justify-start lg:hidden mb-6">
                  <div className="bg-indigo-600/10 border border-indigo-500/20 p-2 rounded-xl text-indigo-600">
                    <FileText className="w-5.5 h-5.5" />
                  </div>
                  <span className="font-bold text-lg text-slate-900 font-mono">ShareDoc.io</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Access Your Workspace</h2>
                <p className="text-sm text-slate-500 mt-1.5">Sign in to edit, compile, and distribute collaborative papers.</p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                {authError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3 py-2.5 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Password</label>
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm py-2.5 rounded-xl transition shadow-sm hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAuthenticating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    'Enter Workspace'
                  )}
                </button>
              </form>

              {/* Seeded credentials quick-select list */}
              <div className="space-y-3 pt-6 border-t border-slate-150">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <HelpCircle className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Seeded Accounts for Testing</span>
                </div>
                <p className="text-[11px] text-slate-400">Click any account below to instantly pre-fill credentials for quick evaluation:</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {seededAccounts.map((acc, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => quickSelectAccount(acc.email)}
                      className={`text-left p-2.5 border rounded-xl transition text-xs flex flex-col justify-between ${
                        loginEmail === acc.email 
                          ? 'border-indigo-500 bg-indigo-50/40 text-indigo-950 shadow-sm' 
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-semibold">{acc.name}</span>
                        {loginEmail === acc.email && <UserCheck className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 font-mono break-all">{acc.email}</span>
                      <span className="text-[9px] bg-slate-100 text-slate-500 font-medium px-1.5 py-0.5 rounded mt-1.5 self-start">{acc.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ==========================================
        // WORKSPACE DASHBOARD VIEW (LOGGED IN)
        // ==========================================
        <div id="workspace_screen" className="flex-1 flex flex-col">
          {/* Main Top Header */}
          <header id="workspace_header" className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-40 flex items-center justify-between">
            {/* Logo Group */}
            <div 
              onClick={() => setActiveDocument(null)}
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 active:opacity-95 transition"
              title="Return to Home Dashboard"
            >
              <div className="bg-indigo-600 text-white p-2 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-base leading-tight">Collaborative Document Editor</h1>
                <p className="text-[11px] text-slate-500">Reviewer Interactive Sandbox Panel</p>
              </div>
            </div>

            {/* Profile actions */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2.5 text-right">
                <div>
                  <p className="text-xs font-semibold text-slate-800">{user.name}</p>
                  <p className="text-[10px] font-mono text-slate-400">{user.email}</p>
                </div>
                <div className="w-8.5 h-8.5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm border border-indigo-200">
                  {user.name.charAt(0)}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 border border-slate-200 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 transition"
                title="Logout from workspace"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </header>

          {/* Main Grid: Sidebar + Editor Pane */}
          <div className="flex-1 flex flex-col lg:flex-row items-stretch">
            
            {/* LEFT SIDEBAR PANEL: Documents Navigator */}
            <aside id="sidebar_navigator" className="w-full lg:w-[320px] shrink-0 bg-[#f8fafc] border-b lg:border-b-0 lg:border-r border-slate-200 p-5 flex flex-col gap-6">
              
              {/* Primary Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={createNewDocument}
                  className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold px-3 py-3 rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm hover:shadow"
                >
                  <Plus className="w-4 h-4" />
                  New Doc
                </button>
                
                <button
                  onClick={() => {
                    setUploadError(null);
                    setUploadFile(null);
                    setIsUploadModalOpen(true);
                  }}
                  className="bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/20 text-slate-700 hover:text-indigo-700 text-xs font-semibold px-3 py-3 rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <Upload className="w-4 h-4" />
                  Import File
                </button>
              </div>

              {/* Navigation Categories Container */}
              <div className="flex-1 flex flex-col gap-6 overflow-y-auto max-h-[300px] lg:max-h-[calc(100vh-250px)]">
                
                {/* CATEGORY 1: OWNED DOCUMENTS */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <span>Owned Documents</span>
                    <span className="bg-slate-200/85 text-slate-600 font-mono text-[10px] px-1.5 py-0.5 rounded-full">{myDocuments.length}</span>
                  </div>

                  {myDocuments.length === 0 ? (
                    <div className="text-center py-6 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <FileText className="w-6 h-6 text-slate-300 mx-auto" />
                      <p className="text-[11px] text-slate-400 mt-2 font-medium">No documents yet.</p>
                      <button 
                        onClick={createNewDocument} 
                        className="text-[10px] text-indigo-600 hover:underline font-semibold mt-1"
                      >
                        Create your first draft
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {myDocuments.map((doc) => {
                        const isActive = activeDocument?.id === doc.id;
                        return (
                          <div
                            key={doc.id}
                            onClick={() => selectDocument(doc.id)}
                            className={`group w-full text-left p-3 rounded-xl transition border cursor-pointer flex items-center justify-between ${
                              isActive 
                                ? 'bg-indigo-50 border-indigo-150 text-indigo-950 shadow-sm' 
                                : 'bg-white border-slate-100 hover:border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <FileText className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-semibold truncate leading-normal pr-1">{doc.title}</h4>
                                <span className="text-[9px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(doc.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>

                            {/* Hover Quick Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 pl-1">
                              <button
                                onClick={(e) => openShareModal(doc.id, e)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Share access"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteDocument(doc.id, e)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Delete document"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* CATEGORY 2: SHARED DOCUMENTS */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <span>Shared with Me</span>
                    <span className="bg-slate-200/85 text-slate-600 font-mono text-[10px] px-1.5 py-0.5 rounded-full">{sharedDocuments.length}</span>
                  </div>

                  {sharedDocuments.length === 0 ? (
                    <div className="text-center py-6 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <Users className="w-6 h-6 text-slate-300 mx-auto" />
                      <p className="text-[11px] text-slate-400 mt-2 font-medium">No shared documents yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {sharedDocuments.map((doc) => {
                        const isActive = activeDocument?.id === doc.id;
                        return (
                          <div
                            key={doc.id}
                            onClick={() => selectDocument(doc.id)}
                            className={`group w-full text-left p-3 rounded-xl transition border cursor-pointer flex items-center justify-between ${
                              isActive 
                                ? 'bg-indigo-50 border-indigo-150 text-indigo-950 shadow-sm' 
                                : 'bg-white border-slate-100 hover:border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <FileDown className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-indigo-400'}`} />
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-semibold truncate leading-normal pr-1">{doc.title}</h4>
                                <div className="flex items-center flex-wrap gap-1 mt-1">
                                  <span className="text-[9px] bg-slate-100 text-slate-500 font-semibold px-1 py-0.5 rounded">
                                    By {doc.ownerName || 'Someone'}
                                  </span>
                                  <span className="text-[9px] bg-emerald-50 text-emerald-600 font-semibold px-1 py-0.5 rounded">
                                    {doc.userPermission || 'edit'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </aside>

            {/* RIGHT SIDE AREA: Document Editor Screen */}
            <main id="editor_workspace" className="flex-1 bg-slate-50 flex flex-col min-w-0 relative">
              
              {!activeDocument ? (
                // EMPTY STATE: No active document loaded
                <div id="editor_empty_state" className="flex-1 flex flex-col justify-center items-center p-8 text-center bg-slate-50">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center gap-4"
                  >
                    <div className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl">
                      <FileText className="w-10 h-10" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">No active document loaded</h3>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        Select an existing document from the left sidebar or create a new workspace sheet to begin drafting with full rich text styling.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                      <button
                        onClick={createNewDocument}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create New Draft
                      </button>
                      <button
                        onClick={() => {
                          setUploadError(null);
                          setUploadFile(null);
                          setIsUploadModalOpen(true);
                        }}
                        className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Import Text/MD File
                      </button>
                    </div>
                  </motion.div>
                </div>
              ) : (
                // ACTIVE EDITOR VIEW
                <div id="editor_interactive_panel" className="flex-1 flex flex-col">
                  
                  {/* Editor Header Bar */}
                  <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    
                    {/* Title Input field & Saved Indicator */}
                    <div className="flex-1 min-w-0 flex items-center gap-3 w-full md:w-auto">
                      <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          value={editorTitle}
                          onChange={(e) => {
                            setEditorTitle(e.target.value);
                            handleEditorInput();
                          }}
                          className="w-full font-bold text-slate-850 text-base md:text-lg focus:outline-none border-b border-transparent focus:border-indigo-400 placeholder-slate-400 tracking-tight"
                          placeholder="Untitled Document"
                        />
                        <div className="flex items-center gap-2 mt-1">
                          {/* Saved Indicators */}
                          {saveStatus === 'saved' ? (
                            <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                              Saved
                            </span>
                          ) : saveStatus === 'saving' ? (
                            <span className="text-[10px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              Autosaving...
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                              Unsaved Changes
                            </span>
                          )}

                          {/* Last Saved timestamp */}
                          {lastSavedTime && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Last saved {lastSavedTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Editor actions bar */}
                    <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                      {activeDocument.userPermission === 'owner' && (
                        <button
                          onClick={(e) => openShareModal(activeDocument.id, e)}
                          className="bg-white border border-slate-200 hover:border-indigo-150 hover:bg-indigo-50/10 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition"
                        >
                          <Users className="w-4 h-4 text-slate-400" />
                          <span>Share Access</span>
                        </button>
                      )}

                      <button
                        onClick={handleManualSave}
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition shadow-sm"
                      >
                        {isSaving ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>Save Now</span>
                      </button>
                    </div>
                  </div>

                  {/* Rich Text Toolbar Options */}
                  <div id="editor_toolbar" className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center gap-1 z-35">
                    
                    {/* Standard Commands */}
                    <button
                      onClick={() => formatText('bold')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition hover:text-slate-900"
                      title="Bold text"
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => formatText('italic')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition hover:text-slate-900"
                      title="Italic text"
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => formatText('underline')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition hover:text-slate-900"
                      title="Underline text"
                    >
                      <Underline className="w-4 h-4" />
                    </button>

                    <div className="h-4 w-px bg-slate-300 mx-1.5" />

                    {/* Heading Formats */}
                    <button
                      onClick={() => formatText('formatBlock', '<h1>')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition hover:text-slate-900 flex items-center gap-0.5"
                      title="Header 1"
                    >
                      <Heading1 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => formatText('formatBlock', '<h2>')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition hover:text-slate-900 flex items-center gap-0.5"
                      title="Header 2"
                    >
                      <Heading2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => formatText('formatBlock', '<p>')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition hover:text-slate-900"
                      title="Paragraph text"
                    >
                      <AlignLeft className="w-4 h-4" />
                    </button>

                    <div className="h-4 w-px bg-slate-300 mx-1.5" />

                    {/* Lists */}
                    <button
                      onClick={() => formatText('insertUnorderedList')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition hover:text-slate-900"
                      title="Unordered bullet list"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => formatText('insertOrderedList')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition hover:text-slate-900"
                      title="Ordered numeric list"
                    >
                      <ListOrdered className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Primary Editor Sheet Workspace */}
                  <div className="flex-1 overflow-y-auto p-6 md:p-10 flex justify-center bg-slate-100">
                    <div className="w-full max-w-3xl min-h-[500px] md:min-h-[700px] bg-white border border-slate-200 rounded-2xl shadow-sm p-8 md:p-12 relative flex flex-col">
                      <div
                        ref={editorRef}
                        contentEditable
                        onInput={handleEditorInput}
                        className="flex-1 outline-none prose prose-slate max-w-none text-slate-800 min-h-full font-serif text-sm md:text-base leading-relaxed break-words"
                        style={{ minHeight: '100%' }}
                      />
                    </div>
                  </div>

                </div>
              )}

            </main>
          </div>
        </div>
      )}

      {/* FOOTER METADATA STATUS */}
      <footer id="footer_bar" className="bg-white border-t border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-3">
        <p className="font-medium">© 2026 Collaborative Document Editor • Built for Review Evaluation</p>
        <div className="flex items-center gap-4">
          <span className="font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Node-Express CJS Proxy Active</span>
          <span className="font-mono bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded">SQLite/JSON DB Synced</span>
        </div>
      </footer>

      {/* ==========================================
          MODAL 1: DOCUMENT SHARING MODAL
          ========================================== */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div id="share_modal_overlay" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4.5 h-4.5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 text-sm">Document Sharing Access</h3>
                </div>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-5">
                {/* Status Notice Messages */}
                {shareModalError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3 py-2.5 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{shareModalError}</span>
                  </div>
                )}
                {shareModalSuccess && (
                  <div className="bg-emerald-50 border border-emerald-150 text-emerald-700 text-xs px-3 py-2.5 rounded-xl flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                    <span>{shareModalSuccess}</span>
                  </div>
                )}

                {/* Invite other user block */}
                <form onSubmit={handleShareDocument} className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Invite peers to edit:</label>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* User Select Box populated with other seeded credentials */}
                    <div className="flex-1 relative">
                      <select
                        required
                        value={shareEmailInput}
                        onChange={(e) => setShareEmailInput(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 rounded-xl px-3 py-2 text-xs appearance-none transition"
                      >
                        <option value="">-- Choose Peer --</option>
                        {allSystemUsers.map(u => (
                          <option key={u.id} value={u.email}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                    </div>

                    <button
                      type="submit"
                      disabled={isSharingActionLoading || !shareEmailInput}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-4 rounded-xl transition flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Grant Access
                    </button>
                  </div>
                </form>

                {/* Current access listing */}
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Currently holds access:</span>
                  
                  {docAccessInfo ? (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto">
                      {/* Owner record */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-semibold text-slate-800">{docAccessInfo.owner.name} (You)</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{docAccessInfo.owner.email}</p>
                        </div>
                        <span className="bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">
                          Owner
                        </span>
                      </div>

                      {/* Shared users record */}
                      {docAccessInfo.sharedWith.length === 0 ? (
                        <p className="text-center py-4 text-xs text-slate-400 font-medium italic">This document is private and not shared with anyone.</p>
                      ) : (
                        docAccessInfo.sharedWith.map((share) => (
                          <div key={share.user.id} className="p-3 bg-white rounded-xl border border-slate-150 flex justify-between items-center text-xs">
                            <div>
                              <p className="font-semibold text-slate-800">{share.user.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{share.user.email}</p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded text-[9px] uppercase">
                                {share.permission}
                              </span>
                              <button
                                onClick={() => handleRevokeShare(share.user.id)}
                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition"
                                title="Revoke access"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <RefreshCw className="w-5 h-5 text-slate-300 animate-spin mx-auto" />
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-150 flex justify-end">
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs py-2 px-4 rounded-xl transition"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL 2: FILE IMPORT / UPLOAD MODAL
          ========================================== */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div id="upload_modal_overlay" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2">
                  <Upload className="w-4.5 h-4.5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 text-sm">Import Document File</h3>
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="p-6 flex-1 space-y-4">
                {uploadError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3 py-2.5 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Drag-and-Drop Area */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleFileDrop}
                  onClick={() => document.getElementById('file_input')?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/10 cursor-pointer rounded-2xl p-8 text-center transition flex flex-col items-center gap-3"
                >
                  <input
                    type="file"
                    id="file_input"
                    accept=".txt,.md"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="bg-slate-50 text-slate-400 p-3.5 rounded-full border border-slate-100">
                    <Upload className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Drag & Drop or Click to Select</p>
                    <p className="text-[10px] text-slate-400 mt-1">Supported file formats: .txt, .md</p>
                  </div>
                </div>

                {/* Selected File Card Details */}
                {uploadFile && (
                  <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{uploadFile.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{(uploadFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setUploadFile(null)}
                      className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-150 flex justify-end gap-2">
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs py-2 px-4 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportFile}
                  disabled={isUploading || !uploadFile}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-4 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isUploading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Import Draft
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
