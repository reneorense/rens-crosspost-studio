import React, { useState, useEffect, useRef } from 'react';
import { 
  Layers, 
  Settings, 
  Link as LinkIcon, 
  Calendar, 
  History, 
  Image as ImageIcon, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  PlusCircle, 
  Wifi, 
  WifiOff, 
  UserCheck, 
  RefreshCw, 
  ExternalLink, 
  Clock, 
  Trash2, 
  Plus, 
  Search, 
  Share2, 
  XCircle, 
  Tv, 
  FileVideo, 
  Info, 
  Lock, 
  Cpu, 
  Check, 
  UserPlus, 
  FileCode,
  Sliders,
  ChevronRight,
  TrendingUp,
  Activity
} from 'lucide-react';
import { ConnectedAccount, Post, PostTarget, ScheduledPost, MediaAsset, PostLog, PlatformConfig } from './types';

export default function App() {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'connect' | 'create' | 'schedule' | 'history' | 'media' | 'settings' | 'guide'>('dashboard');

  // Core records fetched from API
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [posts, setPosts] = useState<(Post & { targets: PostTarget[]; schedule?: ScheduledPost })[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [logs, setLogs] = useState<PostLog[]>([]);
  const [configs, setConfigs] = useState<{ id: string; name: string; envVars: string[]; isConfigured: boolean; missingVars: string[] }[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  
  // Create Post model state
  const [postTitle, setPostTitle] = useState('');
  const [postCaption, setPostCaption] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]); // Array of connectedAccount ID
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [overrideCaption, setOverrideCaption] = useState<Record<string, string>>({}); // { accountId: 'caption' }
  const [privacySetting, setPrivacySetting] = useState<'PUBLIC' | 'FRIENDS' | 'PRIVATE'>('PUBLIC');

  // Popup / Message listener for instant, beautiful OAuth feedback
  useEffect(() => {
    const handleOauthMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'OAUTH_AUTH_SUCCESS') {
        showToast('success', `Success! Connected your official ${event.data.platform} account as "${decodeURIComponent(event.data.name)}".`);
        fetchCoreData();
      }
    };
    window.addEventListener('message', handleOauthMessage);
    return () => {
      window.removeEventListener('message', handleOauthMessage);
    };
  }, []);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'image' | 'video'>('all');

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCoreData();

    // Check url search params for OAuth results from backend redirects
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('oauth');
    const oauthPlatform = params.get('platform');
    const profileName = params.get('name');
    const reason = params.get('reason');

    if (oauthStatus === 'success') {
      showToast('success', `Success! Connected your official ${oauthPlatform} account as "${profileName}".`);
      window.history.replaceState({}, document.title, "/");
    } else if (oauthStatus === 'failed') {
      showToast('error', `OAuth Connection Failed for ${oauthPlatform}: ${reason}`);
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const fetchCoreData = async () => {
    try {
      setLoading(true);
      const [accRes, postsRes, mediaRes, configRes, logsRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/posts'),
        fetch('/api/media'),
        fetch('/api/config'),
        fetch('/api/logs')
      ]);

      if (accRes.ok) setAccounts(await accRes.json());
      if (postsRes.ok) setPosts(await postsRes.json());
      if (mediaRes.ok) setMediaAssets(await mediaRes.json());
      if (configRes.ok) {
        const data = await configRes.json();
        setConfigs(data.platforms);
      }
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (err) {
      console.error('Failed to load API databases data:', err);
      showToast('error', 'Error syncing metadata from live REN\'s CrossPost Studio services.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Connect Accounts
  const handleInitiateOAuth = async (platformId: string) => {
    // 1. Check if configured
    const platformConfig = configs.find(c => c.id === platformId);
    if (!platformConfig?.isConfigured) {
      showToast('error', `Please add environment variable keys (e.g. ${platformConfig?.missingVars?.join(', ')}) first under settings.`);
      return;
    }

    try {
      showToast('info', `Initiating OAuth handshake with ${platformConfig.name}...`);
      // Update the Connect button so it redirects to the real OAuth start route as requested
      window.location.href = `/api/oauth/${platformId}/start`;
    } catch (err: any) {
      showToast('error', `OAuth startup error: ${err.message}`);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Are you sure you want to decouple this social account? Past histories will remain.')) return;
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('success', 'Profile disconnected successfully.');
        fetchCoreData();
      } else {
        throw new Error('Connection removal failed on storage side.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  // Media Library Uploads
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    showToast('info', `Initiating secure upload for "${file.name}"...`);

    try {
      // 1. Get signed upload URL from Netlify function (media API)
      const ticketRes = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-signed-url',
          fileName: file.name,
          fileType: file.type
        })
      });

      if (!ticketRes.ok) {
        const errData = await ticketRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Could not acquire secure signed upload URL.');
      }

      const { signedUrl, publicUrl } = await ticketRes.json();

      // 2. Perform direct raw payload PUT to Supabase Storage
      showToast('info', `Uploading directly to secure storage...`);
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadRes.ok) {
        throw new Error(`Direct storage upload failed with status ${uploadRes.status}`);
      }

      // 3. Save standard asset record in database
      showToast('info', `Registering media asset...`);
      const saveRes = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-asset',
          id: `media_${Date.now()}`,
          fileName: file.name,
          fileType: file.type.startsWith('video') ? 'video' : 'image',
          fileSize: file.size,
          fileUrl: publicUrl,
          mimeType: file.type
        })
      });

      if (saveRes.ok) {
        showToast('success', `File "${file.name}" successfully uploaded and cataloged!`);
        fetchCoreData();
      } else {
        const errData = await saveRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save media reference.');
      }
    } catch (err: any) {
      console.error('Secure direct upload exception:', err);
      showToast('error', `Media upload error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      const res = await fetch(`/api/media/${mediaId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('success', 'Media asset removed.');
        // Deselect if active
        setSelectedMediaIds(prev => prev.filter(id => id !== mediaId));
        fetchCoreData();
      } else {
        throw new Error('Static file disk cleanup failed.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  // Create Post Publication Workflow
  const handleCreatePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlatforms.length === 0) {
      showToast('error', 'Select at least one social media account to publish onto.');
      return;
    }
    if (!postCaption.trim()) {
      showToast('error', 'Please enter some text description or caption.');
      return;
    }

    setSubmitLoading(true);
    showToast('info', 'Executing direct API posting queues...');

    // Parse date/time for scheduling
    let finalScheduleDate = null;
    if (scheduleDate) {
      const timeStr = scheduleTime || '12:00';
      finalScheduleDate = new Date(`${scheduleDate}T${timeStr}:00`).toISOString();
    }

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: postTitle.trim() || 'Direct Studio Post',
          caption: postCaption,
          media_asset_ids: selectedMediaIds,
          platforms: selectedPlatforms,
          scheduleDate: finalScheduleDate,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });

      const result = await res.json();
      if (res.ok) {
        if (finalScheduleDate) {
          showToast('success', `Successful! Post scheduled for queue release on ${scheduleDate}`);
        } else {
          showToast('success', 'Post published successfully across selected platforms!');
        }
        
        // Reset inputs
        setPostTitle('');
        setPostCaption('');
        setSelectedMediaIds([]);
        setSelectedPlatforms([]);
        setScheduleDate('');
        setScheduleTime('');
        setOverrideCaption({});

        // Sync & switch view
        fetchCoreData();
        setActiveTab(finalScheduleDate ? 'schedule' : 'history');
      } else {
        throw new Error(result.error || 'Server posting queue failed.');
      }
    } catch (e: any) {
      showToast('error', `Publish Error: ${e.message}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleRetryPost = async (postId: string) => {
    showToast('info', 'Retrying failed platforms for this post...');
    try {
      const res = await fetch(`/api/posts/${postId}/retry`, { method: 'POST' });
      if (res.ok) {
        showToast('success', 'Retry finished processing successfully.');
        fetchCoreData();
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed retry process.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const handleCancelScheduled = async (schedId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled publishing release?')) return;
    try {
      const res = await fetch(`/api/scheduled/${schedId}/cancel`, { method: 'POST' });
      if (res.ok) {
        showToast('success', 'Schedule publishing canceled.');
        fetchCoreData();
      } else {
        throw new Error('Schedule update was rejected.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const handleDuplicatePost = (post: Post) => {
    setPostTitle(`${post.title} (Copy)`);
    setPostCaption(post.caption);
    setSelectedMediaIds(post.media_asset_ids || []);
    setActiveTab('create');
    showToast('success', 'Copied text and media parameters to the composer!');
  };

  const handleDeletePostRecord = async (postId: string) => {
    if (!confirm('Delete this post history record? This will remove log records from this dashboard.')) return;
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('success', 'Post deleted.');
        fetchCoreData();
      } else {
        throw new Error('Database delete query failed.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  // Helpers
  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook': return 'bg-blue-600 text-white';
      case 'instagram': return 'bg-pink-600 text-white';
      case 'tiktok': return 'bg-neutral-900 border border-neutral-700 text-teal-400';
      case 'x': return 'bg-slate-900 text-slate-100 border border-slate-700';
      case 'linkedin': return 'bg-cyan-700 text-white';
      case 'youtube': return 'bg-red-600 text-white';
      case 'pinterest': return 'bg-rose-700 text-white';
      case 'threads': return 'bg-zinc-800 text-zinc-100';
      default: return 'bg-purple-600 text-white';
    }
  };

  const getPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p === 'youtube') return <Tv className="w-4 h-4" />;
    if (p === 'instagram') return <ImageIcon className="w-4 h-4" />;
    return <Share2 className="w-4 h-4" />;
  };

  // Media requirements validators for safety
  const checkMediaWarnings = () => {
    const warnings: string[] = [];
    if (selectedMediaIds.length === 0) return warnings;

    const selectedFileModels = selectedMediaIds.map(id => mediaAssets.find(a => a.id === id)).filter(Boolean) as MediaAsset[];
    const hasVideo = selectedFileModels.some(a => a.file_type === 'video');
    const hasImg = selectedFileModels.some(a => a.file_type === 'image');

    selectedPlatforms.forEach(accId => {
      const acc = accounts.find(a => a.id === accId);
      if (!acc) return;
      const platform = acc.platform.toLowerCase();

      if (platform === 'youtube' && hasImg && !hasVideo) {
        warnings.push(`YouTube does not support image uploads. Please attach a video asset instead.`);
      }
      if (platform === 'pinterest' && hasVideo) {
        warnings.push(`Pinterest Direct API primarily supports image pins. Video uploading might fail without high-tier business privileges.`);
      }
      if (platform === 'x' && hasVideo) {
        const largeVid = selectedFileModels.find(a => a.file_type === 'video' && a.file_size > 5 * 1024 * 1024);
        if (largeVid) {
          warnings.push(`X (Twitter) direct video uploads are strictly capped. "${largeVid.file_name}" is > 5MB and may fail without premium verification.`);
        }
      }
      if (platform === 'instagram' && selectedMediaIds.length > 1) {
        warnings.push(`Instagram publishing via developer credentials is capped at 1 image/video container. Multiparts may fallback.`);
      }
    });

    return warnings;
  };

  // Filter schedules
  const scheduledPosts = posts.filter(p => p.status === 'scheduled' || p.schedule);
  const activeSchedules = scheduledPosts.filter(p => !p.schedule || p.schedule.status === 'scheduled');

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 font-sans flex flex-col antialiased">
      
      {/* Toast Alert Banner */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#111827] border-l-4 border-emerald-500 text-slate-200 px-5 py-4 rounded-lg shadow-2xl max-w-md animate-bounce">
          {toast.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          ) : toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />
          )}
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      {/* Header Bar */}
      <header className="border-b border-[#111e35] bg-[#090f1cf2] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-[#a855f7] to-[#6366f1] rounded-2xl shadow-xl flex items-center justify-center">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                REN's CrossPost Studio
              </h1>
              <span className="text-[10px] text-slate-400 block tracking-wider font-mono uppercase bg-[#1e293b]/50 px-1.5 py-0.5 rounded border border-slate-700/40 inline-block">
                Personal Multi-Account Hub
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('settings')}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-[#111e35] rounded-xl transition duration-150 relative"
              title="Credentials Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-slate-800"></div>
            <div className="flex items-center gap-2 bg-[#101424] px-3.5 py-1.5 rounded-xl border border-slate-800">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-mono text-slate-300">Local DB Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0 flex flex-col gap-2">
          <div className="bg-[#091020] border border-[#111e35] p-5 rounded-2xl flex flex-col gap-1 shadow-lg">
            
            <p className="text-[11px] font-mono font-semibold tracking-wider text-slate-500 uppercase px-3 pb-3">NAVIGATION</p>
            
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === 'dashboard' 
                  ? 'bg-gradient-to-r from-[#1d293c] to-[#121c2c] text-white border-l-2 border-indigo-500' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-[#111a2e]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sliders className="w-4.5 h-4.5" />
                <span>Dashboard</span>
              </div>
              <span className="text-xs font-mono bg-[#162136] px-2 py-0.5 rounded text-slate-300">{accounts.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('connect')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === 'connect' 
                  ? 'bg-gradient-to-r from-[#1d293c] to-[#121c2c] text-white border-l-2 border-indigo-500' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-[#111a2e]'
              }`}
            >
              <div className="flex items-center gap-3">
                <LinkIcon className="w-4.5 h-4.5" />
                <span>Connect Accounts</span>
              </div>
              <Plus className="w-4 h-4 text-slate-500" />
            </button>

            <button
              onClick={() => {
                setActiveTab('create');
                // Auto pre-populate some accounts if selected was blank
                if (selectedPlatforms.length === 0 && accounts.length > 0) {
                  setSelectedPlatforms([accounts[0].id]);
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === 'create' 
                  ? 'bg-gradient-to-r from-[#1d293c] to-[#121c2c] text-white border-l-2 border-indigo-500' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-[#111a2e]'
              }`}
            >
              <PlusCircle className="w-4.5 h-4.5" />
              <span>Create Post</span>
            </button>

            <button
              onClick={() => setActiveTab('schedule')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === 'schedule' 
                  ? 'bg-gradient-to-r from-[#1d293c] to-[#121c2c] text-white border-l-2 border-indigo-500' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-[#111a2e]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-4.5 h-4.5" />
                <span>Schedule Queue</span>
              </div>
              <span className="text-xs font-mono bg-[#162136] px-2 py-0.5 rounded text-slate-300">{activeSchedules.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === 'history' 
                  ? 'bg-gradient-to-r from-[#1d293c] to-[#121c2c] text-white border-l-2 border-indigo-500' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-[#111a2e]'
              }`}
            >
              <div className="flex items-center gap-3">
                <History className="w-4.5 h-4.5" />
                <span>Post History</span>
              </div>
              <span className="text-xs font-mono bg-[#162136] px-2 py-0.5 rounded text-slate-300">
                {posts.filter(p => p.status === 'posted' || p.status === 'failed').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('media')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === 'media' 
                  ? 'bg-gradient-to-r from-[#1d293c] to-[#121c2c] text-white border-l-2 border-indigo-500' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-[#111a2e]'
              }`}
            >
              <div className="flex items-center gap-3">
                <ImageIcon className="w-4.5 h-4.5" />
                <span>Media Assets</span>
              </div>
              <span className="text-xs font-mono bg-[#162136] px-2 py-0.5 rounded text-slate-300">{mediaAssets.length}</span>
            </button>

            <div className="h-px bg-slate-800/80 my-3"></div>

            <p className="text-[11px] font-mono font-semibold tracking-wider text-slate-500 uppercase px-3 pb-1">DOCUMENTATION</p>

            <button
              onClick={() => setActiveTab('guide')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === 'guide' 
                  ? 'bg-gradient-to-r from-[#1d293c] to-[#121c2c] text-white border-l-2 border-indigo-500' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-[#111a2e]'
              }`}
            >
              <FileCode className="w-4.5 h-4.5 text-indigo-400" />
              <span>Platform Setup Guide</span>
            </button>
          </div>

          {/* Quick Stats sidebar widget */}
          <div className="bg-[#091020] border border-[#111e35] p-5 rounded-2xl shadow-lg mt-3 flex flex-col gap-3">
            <h4 className="text-xs font-bold tracking-wider uppercase text-slate-400">Total Activity</h4>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Published via app</span>
              <span className="font-mono text-sm font-semibold text-white">{accounts.reduce((sum, acc) => sum + (acc.posts_count || 0), 0)}</span>
            </div>
            <div className="w-full bg-[#162136] rounded-full h-1">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1 rounded-full" style={{ width: '70%' }}></div>
            </div>
            <span className="text-[10px] text-slate-500 leading-relaxed leading-normal">
              Direct connection calls bypass middlemen to secure write scopes.
            </span>
          </div>
        </aside>

        {/* Content Panel Area */}
        <main className="flex-1">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 bg-[#091020] border border-[#111e35] rounded-2xl">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
              <p className="text-sm text-slate-400">Syncing with live social studio server database...</p>
            </div>
          )}

          {!loading && (
            <div>

              {/* SECTION: DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="flex flex-col gap-6">
                  
                  {/* Studio Hero Slider */}
                  <div className="bg-gradient-to-r from-[#1a1c2e] via-[#111629] to-[#0d0f19] border border-[#1d243a] p-6 rounded-2xl relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                      <Layers className="w-64 h-64 text-indigo-500" />
                    </div>
                    
                    <div className="max-w-xl">
                      <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-medium mb-3">
                        <UserCheck className="w-4 h-4" /> Single User Admin Panel
                      </div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">Welcome to your REN's CrossPost Studio Workspace</h2>
                      <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                        Authorize accounts directly, format media to specific targets, upload video snippets, and schedule releases. Direct API communication ensures maximum security.
                      </p>
                      <div className="flex items-center gap-3 mt-4">
                        <button 
                          onClick={() => setActiveTab('create')}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition duration-150 flex items-center gap-1.5 shadow"
                        >
                          <PlusCircle className="w-4 h-4" /> Compose Post
                        </button>
                        <button 
                          onClick={() => setActiveTab('connect')}
                          className="bg-[#1b253b] hover:bg-[#23304d] text-slate-200 text-xs font-semibold px-4 py-2 border border-slate-700/80 rounded-xl transition duration-150 flex items-center gap-1.5"
                        >
                          <LinkIcon className="w-4 h-4" /> Connect Channels
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick KPI Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#091020] border border-[#111e35] p-5 rounded-2xl shadow-md">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs uppercase font-semibold tracking-wider">Social Channels</span>
                        <LinkIcon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <p className="text-2xl font-bold font-mono text-white">{accounts.length}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{accounts.filter(a => a.status === 'active').length} active tokens</p>
                    </div>

                    <div className="bg-[#091020] border border-[#111e35] p-5 rounded-2xl shadow-md">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs uppercase font-semibold tracking-wider">Live Posts</span>
                        <TrendingUp className="w-4 h-4 text-indigo-400" />
                      </div>
                      <p className="text-2xl font-bold font-mono text-white">
                        {posts.filter(p => p.status === 'posted').length}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">Multiplied to targets</p>
                    </div>

                    <div className="bg-[#091020] border border-[#111e35] p-5 rounded-2xl shadow-md">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs uppercase font-semibold tracking-wider">Scheduled Queue</span>
                        <Clock className="w-4 h-4 text-amber-500" />
                      </div>
                      <p className="text-2xl font-bold font-mono text-white">
                        {activeSchedules.length}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">Due for automated release</p>
                    </div>

                    <div className="bg-[#091020] border border-[#111e35] p-5 rounded-2xl shadow-md">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs uppercase font-semibold tracking-wider">Storage Files</span>
                        <ImageIcon className="w-4 h-4 text-teal-400" />
                      </div>
                      <p className="text-2xl font-bold font-mono text-white">{mediaAssets.length}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {(mediaAssets.reduce((s, a) => s + a.file_size, 0) / (1024 * 1024)).toFixed(2)} MB total
                      </p>
                    </div>
                  </div>

                  {/* Connected Accounts list of cards */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white">Active Integrations</h3>
                        <p className="text-xs text-slate-400">Profiles connected to standard APIs</p>
                      </div>
                      <button 
                        onClick={() => setActiveTab('connect')} 
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                      >
                        Add Integration <ChevronRight className="w-4.5 h-4.5" />
                      </button>
                    </div>

                    {accounts.length === 0 ? (
                      <div className="bg-[#091020] border-2 border-dashed border-[#1e293b] p-8 text-center rounded-2xl">
                        <WifiOff className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                        <h4 className="font-semibold text-slate-300">No Channels Linked</h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                          Establish direct link configurations via environment keys or connect official profiles instantly.
                        </p>
                        <button
                          onClick={() => setActiveTab('connect')}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl"
                        >
                          Show Connect Page
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {accounts.map(acc => (
                          <div key={acc.id} className="bg-[#091020] border border-[#111e35] rounded-2xl p-5 shadow-sm hover:shadow-lg transition duration-200">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <img
                                  src={acc.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde'}
                                  alt={acc.display_name}
                                  className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-800"
                                />
                                <div>
                                  <h4 className="font-bold text-sm text-slate-100 truncate max-w-[130px]">{acc.display_name}</h4>
                                  <span className={`inline-block mt-1 font-mono text-[9px] uppercase px-2 py-0.5 rounded-full font-semibold ${getPlatformColor(acc.platform)}`}>
                                    {acc.platform}
                                  </span>
                                </div>
                              </div>
                              
                              <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded ${
                                acc.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                acc.status === 'expired' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                'bg-slate-800 text-slate-400'
                              }`}>
                                {acc.status.toUpperCase()}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t border-slate-800/80 mt-4 pt-3.5">
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase font-semibold">Post Count</p>
                                <p className="text-sm font-semibold text-slate-200 mt-0.5">{acc.posts_count || 0}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase font-semibold">Last Release</p>
                                <p className="text-xs text-slate-200 mt-0.5 truncate">
                                  {acc.last_post_date ? new Date(acc.last_post_date).toLocaleDateString() : 'None'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mt-4 pt-1">
                              {acc.status === 'expired' && (
                                <button
                                  onClick={() => handleInitiateOAuth(acc.platform)}
                                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold py-1.5 rounded-lg transition text-center cursor-pointer"
                                  title="Reconnect Expired Tokens"
                                >
                                  Reconnect
                                </button>
                              )}
                              <button
                                onClick={() => handleDisconnect(acc.id)}
                                className="flex-1 bg-red-950/20 hover:bg-red-950/40 border border-red-800/20 text-red-400 text-xs font-semibold py-1.5 rounded-lg transition text-center cursor-pointer"
                              >
                                Disconnect
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPlatforms([acc.id]);
                                  setActiveTab('create');
                                }}
                                className="bg-[#141b2d] hover:bg-[#1d263f] border border-slate-800 text-slate-200 text-xs font-semibold p-1.5 rounded-lg transition flex justify-center items-center"
                                title="Write specifically to this profile"
                              >
                                <Plus className="w-4.5 h-4.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Activity Logs Console streaming */}
                  <div className="bg-[#091020] border border-[#111e35] rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-5 h-5 text-indigo-400" />
                      <h3 className="font-bold text-white text-base">Channel Logging Stream</h3>
                    </div>
                    
                    <p className="text-xs text-slate-400 mb-4">Direct execution reports of publishing requests and scheduled checks:</p>
                    
                    <div className="bg-[#04060c] border border-slate-800/80 rounded-xl p-4 font-mono text-[11.5px] max-h-56 overflow-y-auto flex flex-col gap-2">
                      {logs.length === 0 ? (
                        <p className="text-slate-500 italic opacity-70">Console stream is currently empty. Activities will report here live.</p>
                      ) : (
                        logs.map(log => (
                          <div key={log.id} className="border-b border-slate-900 pb-1.5 last:border-0 last:pb-0">
                            <span className="text-slate-500 font-semibold">[{new Date(log.created_at).toLocaleTimeString()}]</span>{' '}
                            <span className="text-indigo-400 font-medium">({log.platform.toUpperCase()})</span>{' '}
                            <span className="text-slate-400">{log.action}:</span>{' '}
                            <span className={log.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}>
                              {log.message}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )}


              {/* SECTION: CONNECT ACCOUNTS */}
              {activeTab === 'connect' && (
                <div className="flex flex-col gap-6">
                  
                  <div>
                    <h2 className="text-xl font-bold text-white">Add Social Media Channels</h2>
                    <p className="text-sm text-slate-400 mt-1">Connect your real social developer setups to authenticate.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {configs.map(platform => {
                      // Find if we already have a connected account of this platform type
                      const linkedProfiles = accounts.filter(a => a.platform === platform.id);

                      return (
                        <div key={platform.id} className="bg-[#091020] border border-[#111e35] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                          
                          <div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className={`p-2 rounded-xl bg-slate-850 ${getPlatformColor(platform.id)}`}>
                                  {getPlatformIcon(platform.id)}
                                </div>
                                <h3 className="font-bold text-slate-100">{platform.name}</h3>
                              </div>

                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                                platform.isConfigured 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              }`}>
                                {platform.isConfigured ? 'READY FOR OAUTH' : 'API SETUP REQUIRED'}
                              </span>
                            </div>

                            <div className="mt-4 space-y-2">
                              <p className="text-xs text-slate-400 leading-relaxed leading-relaxed">
                                Connect credentials to start directly posting. Media types supported: 
                                <span className="text-slate-300 font-semibold font-medium"> {platform.id === 'youtube' ? 'Videos, YouTube Shorts' : 'Images, Videos, text-only posts'}.</span>
                              </p>

                              {/* Keys detail listing */}
                              <div className="bg-[#050811] p-3 rounded-lg border border-slate-900 mt-2">
                                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">OAuth ENV Checks</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {platform.envVars.map(v => {
                                    const isOk = !platform.missingVars?.includes(v);
                                    return (
                                      <span key={v} className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                        isOk ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/30' : 'bg-rose-900/40 text-rose-300 border border-rose-800/30'
                                      }`}>
                                        {isOk ? '✓' : '✗'} {v.replace(`${platform.id.toUpperCase()}_`, '')}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 pt-3.5 border-t border-slate-800/85">
                            {linkedProfiles.length > 0 && (
                              <div className="mb-3">
                                <p className="text-[9px] uppercase font-bold tracking-wider text-slate-500 mb-1">Currently Coupled Profiles</p>
                                <div className="space-y-1">
                                  {linkedProfiles.map(p => (
                                    <div key={p.id} className="flex items-center justify-between bg-slate-900/50 p-1.5 rounded text-xs text-slate-350">
                                      <span className="truncate">{p.display_name}</span>
                                      <span className="text-[9px] text-emerald-400 font-mono">Status OK</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2">
                              {platform.isConfigured ? (
                                <button
                                  onClick={() => handleInitiateOAuth(platform.id)}
                                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 rounded-xl transition shadow cursor-pointer text-center"
                                >
                                  Connect with OAuth
                                </button>
                              ) : (
                                <div className="flex-1 bg-[#1a120c] border border-amber-500/25 text-amber-500/90 p-2.5 rounded-xl text-center text-[10px] font-mono font-bold uppercase tracking-wider">
                                  API setup required
                                </div>
                              )}
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>

                </div>
              )}


              {/* SECTION: CREATE POST COMPOSER */}
              {activeTab === 'create' && (
                <div className="bg-[#091020] border border-[#111e35] rounded-3xl p-6 shadow-xl">
                  
                  <div className="border-b border-slate-800/80 pb-4 mb-6">
                    <h2 className="text-xl font-bold text-white">Social Campaign Publisher</h2>
                    <p className="text-xs text-slate-400 mt-1">Cross-post content and media directly through official APIs.</p>
                  </div>

                  <form onSubmit={handleCreatePostSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Input Controls */}
                    <div className="lg:col-span-7 flex flex-col gap-5">
                      
                      {/* Campaign Title */}
                      <div>
                        <label className="block text-xs uppercase font-semibold text-slate-400 mb-1.5">
                          Post Title (Internal Use)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Summer launch tease video"
                          value={postTitle}
                          onChange={(e) => setPostTitle(e.target.value)}
                          className="bg-[#050811] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 w-full focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>

                      {/* Select targeted account targets */}
                      <div>
                        <label className="block text-xs uppercase font-semibold text-slate-400 mb-1.5">
                          Publish To (Selected Profiles)
                        </label>
                        {accounts.length === 0 ? (
                          <div className="text-xs text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-dashed border-slate-800">
                            No channels connected. Please connect accounts first to select targets.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                            {accounts.map(acc => {
                              const isSelected = selectedPlatforms.includes(acc.id);
                              return (
                                <button
                                  type="button"
                                  key={acc.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedPlatforms(prev => prev.filter(p => p !== acc.id));
                                    } else {
                                      setSelectedPlatforms(prev => [...prev, acc.id]);
                                    }
                                  }}
                                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition ${
                                    isSelected 
                                      ? 'bg-[#141d31] border-indigo-500/80' 
                                      : 'bg-[#050811] border-slate-800 hover:border-slate-700'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                    isSelected ? 'bg-indigo-600 border-indigo-400' : 'border-slate-600'
                                  }`}>
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                  </div>

                                  <img
                                    src={acc.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde'}
                                    alt=""
                                    className="w-7 h-7 rounded-full object-cover"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-slate-200 truncate">{acc.display_name}</p>
                                    <span className="text-[9px] text-slate-400 font-mono">{acc.platform}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Caption Input */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-xs uppercase font-semibold text-slate-400">
                            Caption or Text content
                          </label>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {postCaption.length} chars
                          </span>
                        </div>
                        <textarea
                          rows={5}
                          placeholder="What would you like to share? Add vertical links and hashtags... 🚀"
                          value={postCaption}
                          onChange={(e) => setPostCaption(e.target.value)}
                          className="bg-[#050811] border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 w-full focus:outline-none focus:border-indigo-500 transition resize-none font-sans"
                        />
                      </div>

                      {/* Select Media attached */}
                      <div>
                        <label className="block text-xs uppercase font-semibold text-slate-400 mb-1.5">
                          Attach Media from Asset library
                        </label>
                        {mediaAssets.length === 0 ? (
                          <div className="text-xs text-slate-400 bg-slate-900/60 p-4 rounded-xl text-center border-2 border-dashed border-slate-800">
                            No files inside asset library.{' '}
                            <button
                              type="button"
                              onClick={() => setActiveTab('media')}
                              className="text-indigo-400 hover:underline font-semibold"
                            >
                              Upload files now
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-2.5">
                            {mediaAssets.map(asset => {
                              const isSelected = selectedMediaIds.includes(asset.id);
                              return (
                                <button
                                  type="button"
                                  key={asset.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedMediaIds(prev => prev.filter(id => id !== asset.id));
                                    } else {
                                      setSelectedMediaIds(prev => [...prev, asset.id]);
                                    }
                                  }}
                                  className={`relative rounded-lg overflow-hidden border aspect-video transition ${
                                    isSelected ? 'border-indigo-400 ring-2 ring-indigo-500/20' : 'border-slate-800'
                                  }`}
                                >
                                  {asset.file_type === 'video' ? (
                                    <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                                      <FileVideo className="w-5 h-5 text-indigo-400" />
                                      <span className="absolute bottom-1 right-1 text-[8px] font-mono bg-indigo-900 px-1 rounded text-white">MP4</span>
                                    </div>
                                  ) : (
                                    <img
                                      src={asset.file_url}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  
                                  {isSelected && (
                                    <div className="absolute inset-0 bg-indigo-900/30 flex items-center justify-center">
                                      <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                                        <Check className="w-3.5 h-3.5 text-white" />
                                      </div>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Scheduling inputs */}
                      <div className="bg-[#0c1324] border border-[#16233d] p-4 rounded-xl space-y-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-indigo-400" />
                          <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide">Schedule Publish (Optional)</h4>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-normal mb-1">
                          Leave these fields empty to deploy immediately across channels. Or select a future date to register scheduling timers.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] tracking-wider text-slate-400 mb-1">RELEASE DATE</label>
                            <input
                              type="date"
                              value={scheduleDate}
                              onChange={(e) => setScheduleDate(e.target.value)}
                              className="bg-[#050811] border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-slate-300 w-full focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] tracking-wider text-slate-400 mb-1">RELEASE TIME</label>
                            <input
                              type="time"
                              value={scheduleTime}
                              onChange={(e) => setScheduleTime(e.target.value)}
                              className="bg-[#050811] border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-slate-300 w-full focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                    </div>


                    {/* Action Panel & Platform Preview */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                      
                      <div className="bg-[#0c1222] border border-slate-800 p-5 rounded-2xl">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Live Feed Preview</h4>
                        
                        {/* Feed Box mockup */}
                        <div className="bg-[#050810] border border-slate-850 rounded-xl p-4">
                          <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-900/50 flex items-center justify-center text-xs font-bold text-indigo-300">
                              C
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-slate-200">REN's CrossPost Studio Preview</h5>
                              <span className="text-[9px] text-slate-500 font-mono">Simulated Multi-Format View</span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {postCaption || 'Add caption text to preview live feed render...'}
                          </p>

                          {/* Media attachments inside preview item */}
                          {selectedMediaIds.length > 0 && (
                            <div className="mt-3 rounded-lg overflow-hidden border border-slate-900 bg-slate-950 aspect-video flex items-center justify-center">
                              {(() => {
                                const activeAsset = mediaAssets.find(a => a.id === selectedMediaIds[0]);
                                if (activeAsset?.file_type === 'video') {
                                  return (
                                    <div className="text-center p-4">
                                      <FileVideo className="w-8 h-8 text-indigo-400 mx-auto mb-1.5" />
                                      <p className="text-[10px] text-slate-400 font-mono">{activeAsset.file_name}</p>
                                    </div>
                                  );
                                }
                                return activeAsset ? (
                                  <img src={activeAsset.file_url} alt="" className="w-full h-full object-cover" />
                                ) : null;
                              })()}
                            </div>
                          )}
                        </div>

                        {/* Media warning validator */}
                        {checkMediaWarnings().length > 0 && (
                          <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-3 mt-4 space-y-1.5 text-amber-300 text-[10.5px]">
                            <div className="flex items-center gap-1 text-xs font-bold uppercase text-amber-400">
                              <AlertTriangle className="w-4 h-4" /> Media Compliance Warning
                            </div>
                            <ul className="list-disc pl-4 space-y-1">
                              {checkMediaWarnings().map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="space-y-2.5">
                        <button
                          type="submit"
                          disabled={submitLoading}
                          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-3 px-4 rounded-xl transition duration-150 shadow-lg text-sm flex items-center justify-center gap-2"
                        >
                          {submitLoading ? (
                            <>
                              <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                              <span>Dispatching Campaign...</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-4.5 h-4.5" />
                              <span>
                                {scheduleDate ? 'Schedule Posting Queue' : 'Publish to Target Accounts'}
                              </span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!postCaption) {
                              showToast('error', 'Please enter some text description first.');
                              return;
                            }
                            showToast('success', 'Draft cached locally.');
                          }}
                          className="w-full bg-slate-900 hover:bg-slate-850 text-slate-300 font-semibold py-2.5 px-4 rounded-xl border border-slate-800 transition text-xs text-center"
                        >
                          Save post as Draft
                        </button>
                      </div>

                    </div>

                  </form>

                </div>
              )}


              {/* SECTION: SCHEDULE MANAGER */}
              {activeTab === 'schedule' && (
                <div className="flex flex-col gap-6">
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white">Scheduled Publishing Queue</h2>
                      <p className="text-sm text-slate-400 mt-1">Manage posts register for future release events.</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('create')}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
                    >
                      <Plus className="w-4.5 h-4.5" /> Schedule New
                    </button>
                  </div>

                  {/* Schedules filter lists */}
                  <div className="bg-[#091020] border border-[#111e35] rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-white mb-4">Calendar Timeline</h3>

                    {scheduledPosts.length === 0 ? (
                      <div className="text-center py-12">
                        <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                        <h4 className="font-semibold text-slate-300">No releases scheduled</h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                          You do not have any pending posts setup for database cron check. Create a post and select a publish date.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {scheduledPosts.map(p => {
                          const sched = p.schedule;
                          const isActive = sched?.status === 'scheduled';
                          return (
                            <div key={p.id} className="bg-[#050811] border border-slate-850 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-start gap-3.5">
                                <div className="p-2.5 bg-[#0f172a] border border-indigo-500/20 rounded-xl text-indigo-400 flex items-center justify-center">
                                  <Clock className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-bold text-sm text-slate-200">{p.title || 'Studio Schedule post'}</h4>
                                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                      sched?.status === 'posted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                      sched?.status === 'canceled' ? 'bg-slate-800 text-slate-400' :
                                      'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                                    }`}>
                                      {sched?.status.toUpperCase() || 'SCHEDULED'}
                                    </span>
                                  </div>

                                  <p className="text-xs text-slate-400 truncate max-w-md mt-1 italic">
                                    "{p.caption}"
                                  </p>

                                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                                      {sched ? new Date(sched.scheduled_at).toLocaleString() : 'Pending Date'}
                                    </span>
                                    <span className="text-slate-600 font-mono text-[11px]">•</span>
                                    <div className="flex items-center gap-1">
                                      {p.targets.map(t => (
                                        <span key={t.id} className={`text-[9px] uppercase font-mono px-1.5 rounded-full ${getPlatformColor(t.platform)}`}>
                                          {t.platform}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {sched && isActive && (
                                  <button
                                    onClick={() => handleCancelScheduled(sched.id)}
                                    className="bg-red-950/20 hover:bg-red-900/20 border border-red-850/30 text-rose-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                                  >
                                    Cancel Release
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDuplicatePost(p)}
                                  className="bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                                >
                                  Reuse Parameters
                                </button>
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              )}


              {/* SECTION: POST HISTORY LOGS */}
              {activeTab === 'history' && (
                <div className="flex flex-col gap-6">
                  
                  <div>
                    <h2 className="text-xl font-bold text-white">Campaign Post History</h2>
                    <p className="text-sm text-slate-400 mt-1">Review, monitor, or retry operations to your target profiles.</p>
                  </div>

                  <div className="bg-[#091020] border border-[#111e35] rounded-2xl p-5 shadow">
                    
                    {posts.filter(p => p.status !== 'scheduled').length === 0 ? (
                      <div className="text-center py-12">
                        <History className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                        <h4 className="font-semibold text-slate-300">History Empty</h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                          You do not have any published or failed post items yet. Try creating a post.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {posts.filter(p => p.status !== 'scheduled').map(p => {
                          const hasFailedTgt = p.targets.some(t => t.status === 'failed');
                          return (
                            <div key={p.id} className="bg-[#050811] border border-slate-850 rounded-xl p-5 flex flex-col gap-4">
                              
                              <div className="flex flex-col sm:flex-row justify-between gap-2.5 pb-3 border-b border-slate-900">
                                <div>
                                  <h4 className="font-bold text-sm text-slate-200">{p.title || 'Direct API post'}</h4>
                                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    Released on: {new Date(p.created_at).toLocaleString()}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={`text-[10.5px] font-mono px-2 py-0.5 rounded font-semibold ${
                                    p.status === 'posted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                    p.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse' :
                                    'bg-slate-850 text-slate-400'
                                  }`}>
                                    {p.status.toUpperCase()}
                                  </span>

                                  <button
                                    onClick={() => handleDeletePostRecord(p.id)}
                                    className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-900 rounded-lg transition"
                                    title="Delete post history card"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {p.caption}
                              </p>

                              {/* Media Thumbnails inside card */}
                              {p.media_asset_ids && p.media_asset_ids.length > 0 && (
                                <div className="flex gap-2 flex-wrap">
                                  {p.media_asset_ids.map(mId => {
                                    const asset = mediaAssets.find(a => a.id === mId);
                                    if (!asset) return null;
                                    return (
                                      <div key={mId} className="w-16 h-12 rounded overflow-hidden border border-slate-850">
                                        {asset.file_type === 'video' ? (
                                          <div className="w-full h-full bg-slate-950 flex items-center justify-center text-[8px] text-indigo-400 font-mono">
                                            Video File
                                          </div>
                                        ) : (
                                          <img src={asset.file_url} alt="" className="w-full h-full object-cover" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Target specific statuses and diagnostics */}
                              <div className="space-y-2 mt-2">
                                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Destination Results</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {p.targets.map(t => (
                                    <div key={t.id} className="bg-slate-950/40 border border-slate-900 rounded-lg p-2.5 flex items-start gap-3">
                                      <span className={`text-[8.5px] uppercase font-mono px-1.5 py-0.5 rounded-full ${getPlatformColor(t.platform)}`}>
                                        {t.platform}
                                      </span>
                                      
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 justify-between">
                                          <span className={`text-[10px] font-semibold ${t.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {t.status === 'success' ? '✓ Success' : '✗ Failed'}
                                          </span>
                                          {t.status === 'success' && t.platform_post_url && (
                                            <a
                                              href={t.platform_post_url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-[10.5px] text-indigo-400 hover:underline flex items-center gap-0.5 font-sans"
                                            >
                                              Open Link <ExternalLink className="w-3 h-3" />
                                            </a>
                                          )}
                                        </div>

                                        {t.error_message && (
                                          <p className="text-[10px] text-rose-300 mt-1 bg-rose-950/20 p-1.5 rounded leading-normal border border-rose-900/20">
                                            {t.error_message}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Interventions */}
                              <div className="flex gap-2.5 mt-3 pt-3 border-t border-slate-900/60">
                                {hasFailedTgt && (
                                  <button
                                    onClick={() => handleRetryPost(p.id)}
                                    className="bg-indigo-650 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition duration-150 flex items-center gap-1 shadow"
                                  >
                                    <RefreshCw className="w-4 h-4" /> Retry Failed Channels
                                  </button>
                                )}

                                <button
                                  onClick={() => handleDuplicatePost(p)}
                                  className="bg-[#111627] hover:bg-[#1a213a] border border-slate-800 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl transition"
                                >
                                  Reuse Caption & Media
                                </button>
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>

                </div>
              )}


              {/* SECTION: MEDIA ASSETS */}
              {activeTab === 'media' && (
                <div className="flex flex-col gap-6">
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white">Media Asset Library</h2>
                      <p className="text-sm text-slate-400 mt-1">Upload and pre-store images and videos for social posts.</p>
                    </div>

                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleMediaUpload}
                        className="hidden"
                        accept="image/*,video/*"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
                      >
                        {uploading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Ingesting File...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-4.5 h-4.5" />
                            <span>Upload Image / Video</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Filter Toolbar */}
                  <div className="bg-[#091020] border border-[#111e35] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2 bg-[#050811] px-3.5 py-1.5 rounded-xl border border-slate-800/80 max-w-sm flex-1">
                      <Search className="w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search assets by file name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-transparent text-xs text-slate-200 border-none outline-none w-full"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setMediaTypeFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          mediaTypeFilter === 'all' ? 'bg-[#15203a] text-indigo-300 border border-indigo-900/50' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        All Assets
                      </button>
                      <button
                        onClick={() => setMediaTypeFilter('image')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          mediaTypeFilter === 'image' ? 'bg-[#15203a] text-indigo-300 border border-indigo-900/50' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Images
                      </button>
                      <button
                        onClick={() => setMediaTypeFilter('video')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          mediaTypeFilter === 'video' ? 'bg-[#15203a] text-indigo-300 border border-indigo-900/50' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Videos (MP4)
                      </button>
                    </div>
                  </div>

                  {/* Core asset grid */}
                  <div className="bg-[#091020] border border-[#111e35] rounded-2xl p-5">
                    {mediaAssets.length === 0 ? (
                      <div className="text-center py-16">
                        <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <h4 className="font-semibold text-slate-300">File Storage Bin is Empty</h4>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 mb-4">
                          Upload high fidelity images or MP4 recordings to construct targeted post previews.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {mediaAssets
                          .filter(a => mediaTypeFilter === 'all' || a.file_type === mediaTypeFilter)
                          .filter(a => a.file_name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(asset => (
                            <div key={asset.id} className="group relative bg-[#050811] border border-slate-850 rounded-xl overflow-hidden aspect-video shadow-sm transition hover:shadow-md">
                              
                              {asset.file_type === 'video' ? (
                                <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-3 text-center">
                                  <FileVideo className="w-8 h-8 text-indigo-400 mb-2" />
                                  <p className="text-[10px] text-slate-300 truncate max-w-full font-semibold">{asset.file_name}</p>
                                  <span className="text-[8px] text-indigo-400 font-mono mt-1 bg-indigo-950/60 px-1 rounded truncate uppercase">
                                    {(asset.file_size / (1024 * 1024)).toFixed(2)} MB • {asset.mime_type.split('/')[1]}
                                  </span>
                                </div>
                              ) : (
                                <img
                                  src={asset.file_url}
                                  alt={asset.file_name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                />
                              )}

                              {/* Hover Overlay triggers */}
                              <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition flex flex-col justify-between p-3">
                                <div className="flex justify-end">
                                  <button
                                    onClick={() => handleDeleteMedia(asset.id)}
                                    className="p-1 text-rose-405 hover:bg-rose-950/50 rounded text-rose-400 transition"
                                    title="Delete file permanently"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="min-w-0">
                                  <p className="text-[10.5px] font-semibold text-slate-200 truncate">{asset.file_name}</p>
                                  <p className="text-[9px] text-slate-400 font-mono">
                                    Size: {(asset.file_size / 1024).toFixed(0)} KB
                                  </p>
                                </div>
                              </div>

                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                </div>
              )}


              {/* SECTION: SETTINGS */}
              {activeTab === 'settings' && (
                <div className="flex flex-col gap-6">
                  
                  <div>
                    <h2 className="text-xl font-bold text-white">Credentials & Environment Setup</h2>
                    <p className="text-sm text-slate-400 mt-1">Review active environment secrets used by modular platform connectors.</p>
                  </div>

                  {/* Security checklist banner */}
                  <div className="bg-[#0b1324] border border-[#1e2e4b] p-5 rounded-2xl flex items-start gap-4">
                    <Lock className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-100">Private Admin Architecture Requirements</h4>
                      <p className="text-xs text-slate-350 mt-1.5 leading-relaxed leading-normal">
                        To remain compliant with developer policies, REN's CrossPost Studio stores credentials exclusively server-side in your container workspace. Client tokens never reach client logs.
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-[11px] text-slate-400 font-sans">
                        <div className="flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-indigo-400" /> Secure refresh token storage
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-indigo-400" /> Automatically exchanges expired credentials
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-indigo-400" /> Redirects validated via callback URIs
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-indigo-400" /> Sanitized log auditing
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ENV variable detail box */}
                  <div className="bg-[#091020] border border-[#111e35] rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-white mb-3">Active Environmental Variables</h3>
                    <p className="text-xs text-slate-450 text-slate-400 mb-4">
                      Variables are configured using the Secrets Panel in your Google AI Studio UI. They automatically load in `process.env`.
                    </p>

                    <div className="space-y-3">
                      <div className="bg-[#050811] p-3 rounded-xl border border-slate-900 flex justify-between items-center text-xs">
                        <span className="font-mono text-indigo-300">APP_URL</span>
                        <span className="text-slate-400 font-mono text-right truncate max-w-sm">
                          {process.env.APP_URL || 'Using detected server context'}
                        </span>
                      </div>

                      <div className="bg-[#050811] p-3 rounded-xl border border-slate-900 flex justify-between items-center text-xs">
                        <span className="font-mono text-indigo-300">FACEBOOK_CLIENT_ID</span>
                        <span className="text-slate-400 font-mono text-xs font-semibold">
                          {configs.find(c => c.id === 'facebook')?.isConfigured ? '✓ Configured' : '✗ Missing'}
                        </span>
                      </div>

                      <div className="bg-[#050811] p-3 rounded-xl border border-slate-900 flex justify-between items-center text-xs">
                        <span className="font-mono text-indigo-300">X_CLIENT_ID</span>
                        <span className="text-slate-400 font-mono text-xs font-semibold">
                          {configs.find(c => c.id === 'x')?.isConfigured ? '✓ Configured' : '✗ Missing'}
                        </span>
                      </div>

                      <div className="bg-[#050811] p-3 rounded-xl border border-slate-900 flex justify-between items-center text-xs">
                        <span className="font-mono text-indigo-300">LINKEDIN_CLIENT_ID</span>
                        <span className="text-slate-400 font-mono text-xs font-semibold">
                          {configs.find(c => c.id === 'linkedin')?.isConfigured ? '✓ Configured' : '✗ Missing'}
                        </span>
                      </div>

                      <div className="bg-[#050811] p-3 rounded-xl border border-slate-900 flex justify-between items-center text-xs">
                        <span className="font-mono text-indigo-300">YOUTUBE_CLIENT_ID</span>
                        <span className="text-slate-400 font-mono text-xs font-semibold">
                          {configs.find(c => c.id === 'youtube')?.isConfigured ? '✓ Configured' : '✗ Missing'}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              )}


              {/* SECTION: ARCHITECTURE GUIDE */}
              {activeTab === 'guide' && (
                <div className="flex flex-col gap-6">
                  
                  <div>
                    <h2 className="text-xl font-bold text-white">Platform Setup & Verification Guide</h2>
                    <p className="text-sm text-slate-400 mt-1">Official OAuth redirection, permissions, scope constraints made simple.</p>
                  </div>

                  <div className="space-y-4">
                    
                    {/* Facebook / Instagram card setup */}
                    <div className="bg-[#091020] border border-[#111e35] p-5 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="bg-blue-600 p-2 rounded-lg text-white font-mono text-xs">FB</span>
                        <h3 className="font-bold text-white text-sm">Facebook Pages / Instagram Business API</h3>
                      </div>
                      <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                        <p>1. Open **Meta for Developers** panel and create a new App under Business or Consumer types.</p>
                        <p>2. Add **Facebook Login for Business** and Instagram Graph APIs inside your dashboards settings.</p>
                        <p>3. Enforce redirect callback URI setting to point exactly back: `YOUR_WORK_URL/api/oauth/callback/facebook`.</p>
                        <p>4. Required review permissions for production: `pages_manage_posts`, `instagram_content_publish`.</p>
                      </div>
                    </div>

                    {/* X card setup */}
                    <div className="bg-[#091020] border border-[#111e35] p-5 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="bg-neutral-850 border border-slate-700 p-2 rounded-lg text-white font-mono text-xs">X</span>
                        <h3 className="font-bold text-white text-sm">X / Twitter API v2 Direct</h3>
                      </div>
                      <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                        <p>1. Create your portal page project under **X Developer Portal** dashboard console.</p>
                        <p>2. Toggle OAuth 2.0 Settings under App configurations and set type as **Web App**.</p>
                        <p>3. Declare redirect URI: `YOUR_WORK_URL/api/oauth/callback/x`.</p>
                        <p>4. Required permissions check: **Read and Write** so that tweet writes succeed.</p>
                      </div>
                    </div>

                    {/* LinkedIn card setup */}
                    <div className="bg-[#091020] border border-[#111e35] p-5 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="bg-cyan-705 bg-cyan-800 p-2 rounded-lg text-white font-mono text-xs">LN</span>
                        <h3 className="font-bold text-white text-sm">LinkedIn Professional API</h3>
                      </div>
                      <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                        <p>1. Go to **LinkedIn Developers Hub** and request "Share on LinkedIn" or "Community management" app permission grants.</p>
                        <p>2. Configure redirect uri address to match exactly: `YOUR_WORK_URL/api/oauth/callback/linkedin`.</p>
                        <p>3. Client ID and secrets will resolve immediately under the Credentials tab of your LinkedIn project page.</p>
                      </div>
                    </div>

                    {/* Google YouTube card setup */}
                    <div className="bg-[#091020] border border-[#111e35] p-5 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="bg-rose-900 border border-red-800 p-2 rounded-lg text-white font-mono text-xs">YT</span>
                        <h3 className="font-bold text-white text-sm">YouTube & YouTube Shorts</h3>
                      </div>
                      <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                        <p>1. Open **Google Cloud Console** and provision a project with the **YouTube Data API v3** service enabled.</p>
                        <p>2. Register credentials as OAuth 2.0 Client IDs, configuring Authorize redirects: `YOUR_WORK_URL/api/oauth/callback/youtube`.</p>
                        <p>3. Required scopes check: `youtube.upload` in order to initiate multi-part file pipeline releases seamlessly.</p>
                      </div>
                    </div>

                  </div>

                </div>
              )}

            </div>
          )}

        </main>

      </div>

      {/* Aesthetic Footer Bar */}
      <footer className="border-t border-[#111e35] bg-[#050811] py-5 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-slate-500 font-mono">
            REN's CrossPost Studio — Personal Social Media Core Publisher. Secure API handshakes.
          </p>
        </div>
      </footer>

    </div>
  );
}
