'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FileText, 
  Upload, 
  Trash2, 
  RefreshCw, 
  MessageSquare, 
  HelpCircle, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  LogOut, 
  User, 
  ArrowLeft,
  Loader2,
  FileCheck,
  Plus,
  Sliders,
  Globe,
  Eye,
  X
} from 'lucide-react';

interface MetricStats {
  totalDocuments: number;
  totalChunks: number;
  totalConversations: number;
  totalMessages: number;
  completedDocuments: number;
  failedDocuments: number;
  processingDocuments: number;
}

interface DocumentItem {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'TXT' | 'MD' | 'URL';
  sourceUrl: string | null;
  status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  chunkCount: number;
  error: string | null;
  createdAt: string;
}

interface ConversationItem {
  id: string;
  title: string;
  userEmail: string;
  userName: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface FAQItem {
  text: string;
  count: number;
}

export default function AdminDashboard() {
  const router = useRouter();

  // Data states
  const [metrics, setMetrics] = useState<MetricStats | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [frequentQuestions, setFrequentQuestions] = useState<FAQItem[]>([]);
  
  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Form upload states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState('');
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'documents' | 'conversations' | 'faqs'>('documents');
  const [selectedChatHistory, setSelectedChatHistory] = useState<any[] | null>(null);
  const [inspectChatTitle, setInspectChatTitle] = useState('');

  // Load Admin Data
  const loadAdminData = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push('/chat'); // Redirect customer roles to customer page
          return;
        }
        throw new Error('Failed to load admin stats');
      }
      const data = await res.json();
      setMetrics(data.metrics);
      setDocuments(data.documents);
      setConversations(data.conversations);
      setFrequentQuestions(data.frequentQuestions);
    } catch (err) {
      console.error(err);
      setErrorMsg('Could not fetch data. Verify database connectivity.');
    } finally {
      setLoading(false);
    }
  };

  // Load User profile
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        if (data.user.role !== 'ADMIN') {
          router.push('/chat'); // Redirect customer roles
        } else {
          setCurrentUser(data.user);
          loadAdminData();
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // File select handler
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
      setUploadUrl(''); // Clear URL if file selected
    }
  };

  // Document Upload Submit handler
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile && !uploadUrl) {
      setErrorMsg('Please select a file or enter a website URL to index.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData();
    if (uploadFile) {
      formData.append('file', uploadFile);
    } else {
      formData.append('url', uploadUrl);
    }
    formData.append('chunkSize', chunkSize.toString());
    formData.append('chunkOverlap', chunkOverlap.toString());

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process document upload.');
      }

      setSuccessMsg(`Document successfully uploaded and parsed into ${data.document?.chunkCount || 0} chunks.`);
      setUploadFile(null);
      setUploadUrl('');
      // Reset input fields in HTML
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Refresh metrics list
      loadAdminData();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  // Delete Document handler
  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document? All associated vector embeddings will be destroyed.')) return;
    
    setActionLoadingId(id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete document');
      }
      setSuccessMsg('Document successfully purged.');
      loadAdminData();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Re-index Document handler
  const handleReindexDoc = async (id: string) => {
    setActionLoadingId(id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: id, chunkSize, chunkOverlap }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to re-index document');
      }
      setSuccessMsg('URL successfully re-scraped and vector chunks updated.');
      loadAdminData();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Inspect chat transcript handler
  const inspectChat = async (id: string, title: string) => {
    setInspectChatTitle(title);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (res.ok && data.conversation) {
        setSelectedChatHistory(data.conversation.messages || []);
      } else {
        alert('Could not retrieve conversation logs.');
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching conversation transcripts.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center gap-3 text-zinc-500 font-sans">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-sm font-semibold">Accessing Admin Control Room...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      
      {/* Admin Header */}
      <header className="h-16 border-b border-zinc-850 bg-zinc-900 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link 
            href="/chat" 
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-indigo-400 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Chat
          </Link>
          <div className="h-4 w-[1px] bg-zinc-800"></div>
          <div>
            <h1 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
              SupportSphere Admin Control
            </h1>
            <p className="text-[10px] text-zinc-500">
              Manage knowledge base resources, document chunk settings, and inspect system performance.
            </p>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-zinc-350">{currentUser.name || 'Admin'}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* Main Admin Dashboard */}
      <main className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto space-y-6">
        
        {/* Alerts Center */}
        {errorMsg && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl p-4 animate-fadeIn">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl p-4 animate-fadeIn">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. Metrics Grid */}
        {metrics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Indexed Files</p>
                <h3 className="text-xl font-extrabold text-zinc-150">{metrics.totalDocuments}</h3>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-violet-500/10 text-violet-400 rounded-lg">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Vector Chunks</p>
                <h3 className="text-xl font-extrabold text-zinc-150">{metrics.totalChunks}</h3>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Total Chats</p>
                <h3 className="text-xl font-extrabold text-zinc-150">{metrics.totalConversations}</h3>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-pink-500/10 text-pink-400 rounded-lg">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Failed / Processing</p>
                <h3 className="text-xl font-extrabold text-zinc-150">
                  <span className="text-red-400">{metrics.failedDocuments}</span>
                  <span className="text-zinc-650 mx-1">/</span>
                  <span className="text-amber-400 animate-pulse">{metrics.processingDocuments}</span>
                </h3>
              </div>
            </div>

          </div>
        )}

        {/* 2. Upload and indexing config section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Uploader Card */}
          <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-md font-bold text-zinc-100 flex items-center gap-2">
                <Upload className="w-4.5 h-4.5 text-indigo-400" />
                Upload Knowledge Resource
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Index PDF, DOCX, TXT, or markdown files, or scrape static website URLs.
              </p>
            </div>

            <form onSubmit={handleUpload} className="space-y-5">
              
              {/* Option A: File upload */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                  Select File Source
                </label>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-center cursor-pointer hover:border-zinc-700 transition relative">
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    disabled={uploading}
                    onChange={onFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:opacity-0"
                  />
                  <div className="flex flex-col items-center gap-2 text-zinc-500">
                    <FileCheck className="w-8 h-8 text-indigo-500" />
                    <span className="text-xs font-medium text-zinc-350 truncate max-w-full">
                      {uploadFile ? uploadFile.name : 'Click to select (.pdf, .docx, .txt, .md)'}
                    </span>
                    <span className="text-[10px] text-zinc-600">Max size limit: 10MB</span>
                  </div>
                </div>
              </div>

              {/* Separator or */}
              <div className="flex items-center text-zinc-700 text-xs">
                <div className="flex-1 h-[1px] bg-zinc-850"></div>
                <span className="px-3 uppercase font-bold tracking-widest text-[10px]">or</span>
                <div className="flex-1 h-[1px] bg-zinc-850"></div>
              </div>

              {/* Option B: Scrape URL */}
              <div>
                <label htmlFor="url-input" className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                  Scrape Website URL
                </label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-500" />
                  <input
                    id="url-input"
                    type="text"
                    placeholder="https://docs.company.com/faqs"
                    disabled={uploading}
                    value={uploadUrl}
                    onChange={(e) => {
                      setUploadUrl(e.target.value);
                      if (e.target.value) setUploadFile(null); // Clear file if URL entered
                    }}
                    className="w-full bg-zinc-950 border border-zinc-805 rounded-xl pl-10 pr-4 py-3 text-xs text-zinc-250 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              {/* Configurations: Chunk size sliders */}
              <div className="space-y-4 pt-2 border-t border-zinc-850">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-zinc-400">Chunk Size (chars)</span>
                  <span className="text-indigo-400 font-bold">{chunkSize}</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="3000"
                  step="100"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-950 rounded appearance-none cursor-pointer accent-indigo-500"
                />

                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-zinc-400">Chunk Overlap</span>
                  <span className="text-indigo-400 font-bold">{chunkOverlap}</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="1000"
                  step="20"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-950 rounded appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={uploading || (!uploadFile && !uploadUrl)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl py-3 text-xs shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    Extracting & Indexing...
                  </>
                ) : (
                  <>
                    <Plus className="w-4.5 h-4.5" />
                    Submit to Vector DB
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Registry & logs Tabs Area */}
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-850 rounded-2xl flex flex-col shadow-sm overflow-hidden min-h-[480px]">
            
            {/* Tabs list */}
            <div className="border-b border-zinc-850 bg-zinc-900 px-6 flex">
              <button
                onClick={() => setActiveTab('documents')}
                className={`py-4 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${
                  activeTab === 'documents'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-zinc-450 hover:text-zinc-200'
                }`}
              >
                Document Inventory
              </button>
              <button
                onClick={() => setActiveTab('conversations')}
                className={`py-4 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${
                  activeTab === 'conversations'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-zinc-450 hover:text-zinc-200'
                }`}
              >
                Conversation Logs
              </button>
              <button
                onClick={() => setActiveTab('faqs')}
                className={`py-4 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${
                  activeTab === 'faqs'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-zinc-450 hover:text-zinc-200'
                }`}
              >
                FAQ Analytics
              </button>
            </div>

            {/* Tab 1: Documents list */}
            {activeTab === 'documents' && (
              <div className="flex-1 overflow-x-auto p-4">
                {documents.length > 0 ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-850 text-zinc-500 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Resource Name</th>
                        <th className="py-2.5 px-3 text-center">Type</th>
                        <th className="py-2.5 px-3 text-center">Chunks</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => {
                        const isUrl = doc.type === 'URL';
                        const isProcessing = doc.status === 'PROCESSING';
                        const isActionLoading = actionLoadingId === doc.id;

                        return (
                          <tr key={doc.id} className="border-b border-zinc-850/50 hover:bg-zinc-950/20 text-zinc-300">
                            <td className="py-3.5 px-3 font-medium max-w-xs truncate" title={doc.name}>
                              {doc.name}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <span className="bg-zinc-800 border border-zinc-700/60 rounded px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 uppercase">
                                {doc.type}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center font-bold text-zinc-200">
                              {doc.chunkCount}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-bold ${
                                doc.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                doc.status === 'FAILED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                              }`}>
                                {doc.status === 'COMPLETED' && <CheckCircle className="w-2.5 h-2.5" />}
                                {doc.status === 'FAILED' && <AlertCircle className="w-2.5 h-2.5" />}
                                {doc.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right flex items-center justify-end gap-1.5">
                              {isUrl && (
                                <button
                                  onClick={() => handleReindexDoc(doc.id)}
                                  disabled={isProcessing || isActionLoading}
                                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer disabled:opacity-45"
                                  title="Re-scrape and index URL"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${isActionLoading ? 'animate-spin' : ''}`} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteDoc(doc.id)}
                                disabled={isProcessing || isActionLoading}
                                className="p-1.5 rounded-lg bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-900/20 transition cursor-pointer disabled:opacity-45"
                                title="Purge document"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-zinc-550 py-20">
                    <FileText className="w-12 h-12 text-zinc-700 mb-2" />
                    <p className="text-sm font-semibold">No documents indexed yet.</p>
                    <p className="text-xs">Use the uploader on the left to add materials.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Conversations monitoring */}
            {activeTab === 'conversations' && (
              <div className="flex-1 overflow-x-auto p-4">
                {conversations.length > 0 ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-850 text-zinc-500 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Chat Name</th>
                        <th className="py-2.5 px-3">User Email</th>
                        <th className="py-2.5 px-3 text-center">Messages</th>
                        <th className="py-2.5 px-3 text-center">Created At</th>
                        <th className="py-2.5 px-3 text-right">Transcript</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversations.map((c) => (
                        <tr key={c.id} className="border-b border-zinc-850/50 hover:bg-zinc-950/20 text-zinc-300">
                          <td className="py-3.5 px-3 font-medium max-w-xs truncate" title={c.title}>
                            {c.title}
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-zinc-400">
                            {c.userEmail}
                          </td>
                          <td className="py-3.5 px-3 text-center text-indigo-300 font-bold">
                            {c.messageCount}
                          </td>
                          <td className="py-3.5 px-3 text-center text-zinc-500 text-[10px]">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <button
                              onClick={() => inspectChat(c.id, c.title)}
                              className="inline-flex items-center gap-1 py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-indigo-600 hover:text-white text-zinc-300 text-xs transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-zinc-555 py-20">
                    <MessageSquare className="w-12 h-12 text-zinc-700 mb-2" />
                    <p className="text-sm font-semibold">No user conversations yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Frequently asked questions */}
            {activeTab === 'faqs' && (
              <div className="flex-1 p-6 space-y-4">
                <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-xl">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-indigo-400" />
                    Most Frequent Queries
                  </h3>
                  {frequentQuestions.length > 0 ? (
                    <div className="space-y-2.5">
                      {frequentQuestions.map((faq, index) => (
                        <div key={index} className="flex justify-between items-center py-2 px-3 bg-zinc-900 border border-zinc-850 rounded-lg text-xs">
                          <span className="font-semibold text-zinc-200 truncate pr-6">{faq.text}</span>
                          <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full shrink-0">
                            {faq.count} asks
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-650 py-4 text-center">No user queries indexed yet.</p>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

      </main>

      {/* 3. Conversation Audit / Transcript Modal Drawer */}
      {selectedChatHistory && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl animate-scaleIn">
            
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm text-zinc-100">Audit Chat: {inspectChatTitle}</h3>
              </div>
              <button 
                onClick={() => setSelectedChatHistory(null)}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Transcript Messages List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-950 scrollbar-thin">
              {selectedChatHistory.length > 0 ? (
                selectedChatHistory.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div key={index} className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] font-bold text-zinc-500 px-1 uppercase tracking-wider">
                        {isUser ? 'Customer' : 'Bot AI'}
                      </span>
                      <div className={`p-3 rounded-xl max-w-[85%] text-xs shadow-inner ${
                        isUser 
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-tl-none space-y-2'
                      }`}>
                        <p className="whitespace-pre-wrap select-text leading-relaxed">{msg.content}</p>
                        
                        {!isUser && msg.latency && (
                          <div className="text-[9px] text-zinc-550 pt-1.5 border-t border-zinc-800/80 flex items-center gap-3">
                            <span>Latency: <strong>{(msg.latency / 1000).toFixed(2)}s</strong></span>
                            {msg.tokenUsage && <span>Tokens: <strong>{msg.tokenUsage}</strong></span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-xs text-zinc-600 py-10">No messages in this chat thread.</p>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setSelectedChatHistory(null)}
                className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-350 font-bold rounded-xl py-2 px-5 text-xs transition cursor-pointer"
              >
                Close Transcript
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
