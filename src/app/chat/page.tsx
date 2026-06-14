'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Send, 
  LogOut, 
  User, 
  Settings2, 
  FileText, 
  ExternalLink,
  ChevronRight,
  Info,
  Sliders,
  Sparkles,
  Menu,
  Loader2
} from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  latency?: number;
  tokenUsage?: number;
  retrievedChunks?: any[];
  createdAt?: string;
}

export default function ChatPage() {
  const router = useRouter();
  
  // App states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // RAG config states
  const [useHybrid, setUseHybrid] = useState(true);
  const [topK, setTopK] = useState(5);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.20);
  
  // UI toggles
  const [showConfig, setShowConfig] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeSourceModal, setActiveSourceModal] = useState<any[] | null>(null);
  
  // Ref for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Load current user profile
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setCurrentUser(data.user);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  // Load user conversations
  const loadConversations = async (selectFirst = false) => {
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('Load conversations failed:', res.status, errData);
        if (res.status === 401) {
          router.push('/login');
        }
        return;
      }
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations);
        
        // Auto-select the first conversation if requested and available
        if (selectFirst && data.conversations.length > 0 && !activeConvId) {
          setActiveConvId(data.conversations[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    loadConversations(true);
  }, []);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/conversations/${activeConvId}`);
        const data = await res.json();
        if (res.ok && data.conversation) {
          setMessages(data.conversation.messages || []);
        }
      } catch (err) {
        console.error('Failed to load message history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadMessages();
  }, [activeConvId]);

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Create new conversation
  const handleCreateConversation = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' }),
      });
      const data = await res.json();
      console.log('Create conversation response:', res.status, data);
      if (!res.ok) {
        alert(`Failed to create conversation: ${data.error || res.statusText}`);
        if (res.status === 401) {
          router.push('/login');
        }
        return;
      }
      if (data.conversation) {
        setConversations(prev => [data.conversation, ...prev]);
        setActiveConvId(data.conversation.id);
        setInputText('');
      }
    } catch (err) {
      console.error('Failed to create conversation:', err);
      alert(`Failed to create conversation: ${(err as Error).message}`);
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat history?')) return;

    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConvId === id) {
          setActiveConvId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Start renaming conversation
  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
  };

  // Save renamed title
  const saveRename = async (id: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!editingTitle.trim()) return;

    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      if (res.ok) {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, title: editingTitle.trim() } : c));
        setEditingConvId(null);
      }
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Send Message and handle SSE Stream
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;

    let targetConvId = activeConvId;
    const currentInput = inputText.trim();
    setInputText('');

    // A. If there is no active conversation, create one first
    if (!targetConvId) {
      try {
        const titleText = currentInput.length > 25 ? `${currentInput.substring(0, 25)}...` : currentInput;
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: titleText }),
        });
        const data = await res.json();
        if (res.ok && data.conversation) {
          targetConvId = data.conversation.id;
          setActiveConvId(targetConvId);
          setConversations(prev => [data.conversation, ...prev]);
        } else {
          throw new Error('Failed to bootstrap chat');
        }
      } catch (err) {
        alert('Could not start conversation, please try again.');
        return;
      }
    }

    // B. Append User message locally
    const userMsg: Message = { role: 'user', content: currentInput };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);

    // C. Initialize empty Assistant message in states to load stream chunks
    const placeholderAssistantMsg: Message = { role: 'assistant', content: '', retrievedChunks: [] };
    setMessages(prev => [...prev, placeholderAssistantMsg]);

    try {
      // D. Call Chat SSE endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: targetConvId,
          message: currentInput,
          useHybrid,
          topK,
          similarityThreshold
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Server returned error or empty response stream.');
      }

      // E. Consume the SSE Stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // SSE boundaries are split by double newlines (\n\n)
        const events = buffer.split('\n\n');
        // Save the last element (could be a partial event chunk)
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          if (!rawEvent.trim()) continue;

          // Parse event headers
          const lines = rawEvent.split('\n');
          let eventType = '';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.replace('event: ', '').trim();
            } else if (line.startsWith('data: ')) {
              eventData = line.replace('data: ', '').trim();
            }
          }

          if (eventType && eventData) {
            try {
              const parsedVal = JSON.parse(eventData);

              // E1. Display citations/sources used
              if (eventType === 'sources') {
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    last.retrievedChunks = parsedVal;
                  }
                  return updated;
                });
              } 
              // E2. Append text streaming tokens
              else if (eventType === 'text') {
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    last.content += parsedVal;
                  }
                  return updated;
                });
              }
              // E3. Handle completed event
              else if (eventType === 'done') {
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    last.latency = parsedVal.latency;
                    last.tokenUsage = parsedVal.tokens;
                  }
                  return updated;
                });
                // Reload conversations list to update order & timestamps
                loadConversations();
              }
              // E4. Handle error
              else if (eventType === 'error') {
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    last.content = `[ERROR]: ${parsedVal}`;
                  }
                  return updated;
                });
              }
            } catch (err) {
              console.error('Failed to parse SSE event payload:', err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Chat routing stream error:', err);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') {
          last.content = `Could not connect to the assistant: ${(err as Error).message}`;
        }
        return updated;
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      
      {/* 1. Sidebar Panel */}
      <aside className={`bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-300 z-20 shrink-0 ${
        sidebarOpen ? 'w-80' : 'w-0 -translate-x-full lg:w-0'
      } absolute inset-y-0 left-0 lg:relative`}>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/10">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="font-bold text-md tracking-tight">
              Support<span className="text-indigo-400">Sphere</span>
            </span>
          </Link>
          <button 
            onClick={handleCreateConversation}
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/10 transition cursor-pointer"
            title="Start new conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Conversation Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search chat history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1 scrollbar-thin">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => {
              const isActive = activeConvId === conv.id;
              const isEditing = editingConvId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    if (!isEditing) {
                      setActiveConvId(conv.id);
                      // Close drawer on mobile
                      if (window.innerWidth < 1024) setSidebarOpen(false);
                    }
                  }}
                  className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer text-sm ${
                    isActive 
                      ? 'bg-zinc-800/80 border border-zinc-700/50 text-indigo-300' 
                      : 'hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-zinc-600'}`} />
                  
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 w-full pr-12">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveRename(conv.id, e)}
                        autoFocus
                        className="bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-100 focus:outline-none w-full"
                      />
                      <button onClick={(e) => saveRename(conv.id, e)} className="p-0.5 rounded text-emerald-400 hover:bg-zinc-800">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingConvId(null); }} className="p-0.5 rounded text-red-400 hover:bg-zinc-800">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="truncate pr-16 font-medium text-xs">{conv.title}</span>
                  )}

                  {/* Actions (visible on hover) */}
                  {!isEditing && (
                    <div className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                      <button
                        onClick={(e) => startRename(conv, e)}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                        title="Rename conversation"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-xs text-zinc-600">
              No conversations found.
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/40">
          {currentUser && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 border border-zinc-700 shadow-inner">
                  <User className="w-4 h-4" />
                </div>
                <div className="truncate flex-1">
                  <p className="text-xs font-semibold text-zinc-200 truncate">{currentUser.name || 'Customer Support User'}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{currentUser.email}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                {currentUser.role === 'ADMIN' && (
                  <Link 
                    href="/admin" 
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/50 rounded-lg py-1.5 px-2.5 text-xs text-center font-medium transition cursor-pointer"
                  >
                    Admin Panel
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-1 bg-red-950/20 hover:bg-red-900/20 text-red-400 border border-red-900/20 rounded-lg py-1.5 px-2.5 text-xs font-medium transition cursor-pointer flex-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Background shadow for mobile sidebar drawer */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 bg-black/50 z-10 lg:hidden"
        ></div>
      )}

      {/* 2. Main Chat Panel */}
      <main className="flex-1 flex flex-col overflow-hidden h-full">
        
        {/* Chat Header */}
        <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-sm text-zinc-100 truncate max-w-xs sm:max-w-md">
                {activeConvId 
                  ? conversations.find(c => c.id === activeConvId)?.title || 'Active Conversation'
                  : 'Start a new conversation'
                }
              </h1>
              <p className="text-[10px] text-zinc-500">
                Grounded Knowledge Base Chatbot
              </p>
            </div>
          </div>

          {/* Config options dropdown toggler */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                showConfig 
                  ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">RAG Engine Settings</span>
            </button>
          </div>
        </header>

        {/* Dynamic configuration overlay panel */}
        {showConfig && (
          <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 animate-fadeIn shrink-0">
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Parameter 1: Search Strategy */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Search Method
                </label>
                <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1.5 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setUseHybrid(true)}
                    className={`py-1.5 rounded-md text-xs font-medium text-center transition cursor-pointer ${
                      useHybrid 
                        ? 'bg-indigo-600 text-white' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Hybrid (Vector + FTS)
                  </button>
                  <button
                    onClick={() => setUseHybrid(false)}
                    className={`py-1.5 rounded-md text-xs font-medium text-center transition cursor-pointer ${
                      !useHybrid 
                        ? 'bg-indigo-600 text-white' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Vector-Only
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-zinc-500 leading-normal">
                  Hybrid combines semantic vector embeddings with English full-text search (RRF algorithm).
                </p>
              </div>

              {/* Parameter 2: Top-K Document Chunks */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    Top-K Retrieved Chunks
                  </label>
                  <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">{topK} chunks</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-indigo-500 border border-zinc-800"
                />
                <p className="mt-2 text-[10px] text-zinc-500 leading-normal">
                  Sets the number of matching document chunks added to the chatbot&apos;s background context.
                </p>
              </div>

              {/* Parameter 3: Similarity Score Threshold */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    Cosine Similarity Cutoff
                  </label>
                  <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">{similarityThreshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.95"
                  step="0.05"
                  value={similarityThreshold}
                  onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-indigo-500 border border-zinc-800"
                />
                <p className="mt-2 text-[10px] text-zinc-500 leading-normal">
                  Minimum matching score. Higher values require tighter document matching.
                </p>
              </div>

            </div>
          </div>
        )}

        {/* Message Panel */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-zinc-950 scrollbar-thin">
          {!activeConvId ? (
            // Empty State
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto p-6 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/15">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-zinc-100 tracking-tight">Customer Support Knowledge Bot</h2>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Start a chat session. The bot automatically references company manuals, URLs, guides, and policies to answer questions accurately.
                </p>
              </div>
              <button
                onClick={handleCreateConversation}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl py-3 px-6 text-sm transition shadow-lg shadow-indigo-500/15 hover:shadow-indigo-500/25 flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Start Chatting
              </button>
            </div>
          ) : loadingHistory ? (
            // Loader State
            <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-xs font-semibold">Loading chat records...</p>
            </div>
          ) : (
            // Message List
            <div className="max-w-4xl mx-auto space-y-6 pb-24">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const hasSources = msg.retrievedChunks && msg.retrievedChunks.length > 0;
                
                return (
                  <div 
                    key={index}
                    className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Bot avatar */}
                    {!isUser && (
                      <div className="w-9 h-9 rounded-xl bg-indigo-950 border border-indigo-900/50 flex items-center justify-center text-indigo-400 shrink-0 shadow-md">
                        <MessageSquare className="w-4.5 h-4.5" />
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-md ${
                      isUser 
                        ? 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-tr-none' 
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-none space-y-3'
                    }`}>
                      
                      {/* Message Content */}
                      <div className="text-sm leading-relaxed prose prose-invert max-w-none">
                        {isUser ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          // Markdown render for assistant replies
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content || 'Generating response...'}
                          </ReactMarkdown>
                        )}
                      </div>

                      {/* Assistant Observability and Citations block */}
                      {!isUser && (
                        <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-[10px] text-zinc-500">
                          
                          {/* Latency and Token logging details */}
                          <div className="flex gap-2">
                            {msg.latency && <span>Latency: <strong className="text-zinc-400">{(msg.latency / 1000).toFixed(2)}s</strong></span>}
                            {msg.tokenUsage && <span>Tokens: <strong className="text-zinc-400">{msg.tokenUsage}</strong></span>}
                          </div>

                          {/* Source Citations */}
                          {hasSources && (
                            <button
                              onClick={() => setActiveSourceModal(msg.retrievedChunks || [])}
                              className="inline-flex items-center gap-1 hover:text-indigo-400 transition cursor-pointer font-bold bg-indigo-950/20 px-2 py-1 border border-indigo-900/20 rounded-md"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              View {msg.retrievedChunks?.length} Sources Used
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Streaming placeholder message / typing indicator */}
              {isGenerating && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-4 justify-start">
                  <div className="w-9 h-9 rounded-xl bg-indigo-950 border border-indigo-900/50 flex items-center justify-center text-indigo-400 shrink-0">
                    <MessageSquare className="w-4.5 h-4.5 animate-pulse" />
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-none p-4 shadow-md flex items-center gap-1.5 py-4 px-6 max-w-[100px]">
                    <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce"></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-zinc-900/40 border-t border-zinc-800/80 shrink-0">
          <div className="max-w-4xl mx-auto">
            {activeConvId ? (
              <form onSubmit={handleSendMessage} className="relative flex items-center">
                <input
                  type="text"
                  required
                  disabled={isGenerating}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask a question about manuals, policies, or product docs..."
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl pl-4 pr-14 py-3 text-sm text-zinc-100 placeholder-zinc-550 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isGenerating || !inputText.trim()}
                  className="absolute right-2.5 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-40 flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <p className="text-center py-2 text-xs text-zinc-500">
                Please select or create a conversation thread to begin querying.
              </p>
            )}
          </div>
        </div>

      </main>

      {/* 3. Citations Modal Overlay */}
      {activeSourceModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl animate-scaleIn">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-md text-zinc-100">Grounded Search References</h3>
              </div>
              <button 
                onClick={() => setActiveSourceModal(null)}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable reference list) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              {activeSourceModal.map((source, index) => {
                const docName = source.metadata?.name || 'Document';
                const docSource = source.metadata?.source || '';
                const isUrl = docSource.startsWith('http');
                
                return (
                  <div key={index} className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Source {index + 1}
                        </span>
                        <h4 className="text-xs font-semibold text-zinc-200">{docName}</h4>
                      </div>
                      
                      {isUrl && (
                        <a 
                          href={docSource} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-indigo-400 transition"
                        >
                          Visit Link
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="text-xs text-zinc-400 bg-zinc-900/50 p-3 rounded-lg border border-zinc-850/50 leading-relaxed font-mono whitespace-pre-wrap select-text">
                      {source.content}
                    </div>

                    {source.score !== undefined && (
                      <div className="text-[9px] text-zinc-500 flex items-center gap-3">
                        {source.score !== null && (
                          <span>Similarity Score: <strong>{(source.score * 100).toFixed(1)}%</strong></span>
                        )}
                        {source.rrfScore !== undefined && (
                          <span>RRF Ranking Score: <strong>{source.rrfScore.toFixed(4)}</strong></span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setActiveSourceModal(null)}
                className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-300 font-semibold rounded-xl py-2 px-5 text-xs transition cursor-pointer"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
