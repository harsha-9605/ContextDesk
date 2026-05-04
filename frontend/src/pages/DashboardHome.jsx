import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Search, FileText, Star, Clock, Folder, Sparkles, Brain, UploadCloud, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://contextdesk-backend.onrender.com' : 'http://localhost:8000');

/**
 * Fetch wrapper that:
 *  - Waits up to `timeoutMs` ms (default 120 s) before aborting
 *  - Calls `onSlow()` after `slowMs` ms so the UI can show a "warming up" hint
 */
async function fetchWithTimeout(url, options = {}, { timeoutMs = 120_000, slowMs = 8_000, onSlow } = {}) {
  const controller = new AbortController();
  const hardTimer = setTimeout(() => controller.abort(), timeoutMs);

  let slowTimer;
  if (onSlow) {
    slowTimer = setTimeout(onSlow, slowMs);
  }

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(hardTimer);
    clearTimeout(slowTimer);
  }
}

const DashboardHome = ({ user, token, pdfCount, favoriteCount, loadingCounts, onUploadSuccess }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('Upload PDF'); // label shown on button

  // Real data from backend
  const [recentPdfs, setRecentPdfs] = useState([]);
  const [loadingPdfs, setLoadingPdfs] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState('Search'); // label shown on search button

  // ── Fetch real PDFs ──────────────────────────────────────────────
  const fetchPdfs = useCallback(async () => {
    if (!token) return;
    setLoadingPdfs(true);
    try {
      const res = await fetch(`${API}/api/pdfs?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecentPdfs(data.pdfs || []);
      }
    } catch (_) {}
    setLoadingPdfs(false);
  }, [token]);

  useEffect(() => {
    fetchPdfs();
  }, [fetchPdfs]);

  // ── Upload ───────────────────────────────────────────────────────
  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Only PDF files are allowed.');
      e.target.value = null;
      return;
    }
    if (file.size > 1024 * 1024) {
      alert('File size must be less than 1 MB to save resources.');
      e.target.value = null;
      return;
    }

    setUploading(true);
    setUploadStatus('Uploading…');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetchWithTimeout(
        `${API}/api/upload`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        },
        {
          timeoutMs: 120_000,
          slowMs: 8_000,
          onSlow: () => setUploadStatus('Waking up server… please wait ☕'),
        }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Upload failed');
      }
      const result = await response.json();
      alert(`✅ Uploaded "${result.filename}" — ${result.chunks_created} chunks processed.`);
      // Refresh everything
      if (onUploadSuccess) onUploadSuccess();
      fetchPdfs();
    } catch (err) {
      if (err.name === 'AbortError') {
        alert('⏱ The server took too long to respond. It may still be waking up — please try again in a moment.');
      } else {
        alert(`Error uploading file: ${err.message}`);
      }
    } finally {
      setUploading(false);
      setUploadStatus('Upload PDF');
      e.target.value = null;
    }
  };

  // ── Open PDF in new tab ──────────────────────────────────────────
  const openPdf = (url) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ── Semantic Search ──────────────────────────────────────────────
  const handleSearch = async (queryOverride = null) => {
    const q = typeof queryOverride === 'string' ? queryOverride : searchQuery;
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    
    if (!token) return;
    setIsSearching(true);
    setSearchStatus('Searching…');
    setSearchQuery(q); // update input visually if pill was clicked
    try {
      const res = await fetchWithTimeout(
        `${API}/api/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ query: q }),
        },
        {
          timeoutMs: 120_000,
          slowMs: 8_000,
          onSlow: () => setSearchStatus('Waking up server… ☕'),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.pdfs || []);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        alert('⏱ Search timed out. The server may still be waking up — please try again in a moment.');
      }
    } finally {
      setIsSearching(false);
      setSearchStatus('Search');
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  // ── Toggle Favorite ──────────────────────────────────────────────
  const toggleFavorite = async (e, file_id) => {
    e.stopPropagation(); // prevent opening the PDF
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/favorites/toggle`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ file_id })
      });
      if (res.ok) {
        // Refresh the list to show updated favorites
        fetchPdfs();
      }
    } catch (_) {}
  };

  return (
    <div className="dashboard-layout">
      {/* ── Center Panel ── */}
      <div className="center-panel">

        {/* Search Bar */}
        <div className="search-area">
          <div className="search-input-wrapper">
            <Search size={20} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Search PDFs by name or meaning..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn-primary" onClick={handleSearch} disabled={isSearching} style={{ padding: '8px 24px', height: '36px', borderRadius: '8px', minWidth: '160px', whiteSpace: 'nowrap' }}>
              <Sparkles size={16} /> {isSearching ? searchStatus : 'Search'}
            </button>
          </div>
          <div className="search-suggestions">
            <span>Try searching:</span>
            <span className="suggestion-pill" onClick={() => handleSearch('machine learning')} style={{cursor: 'pointer'}}>machine learning</span>
            <span className="suggestion-pill" onClick={() => handleSearch('neural networks')} style={{cursor: 'pointer'}}>neural networks</span>
            <span className="suggestion-pill" onClick={() => handleSearch('data privacy')} style={{cursor: 'pointer'}}>data privacy</span>
          </div>
        </div>

        {/* Upload Restricted Banner */}
        {!user && (
          <div className="card" style={{ backgroundColor: '#fefce8', border: '1px solid #fef08a', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <UploadCloud size={24} color="#ca8a04" />
            <div>
              <h3 style={{ fontSize: '15px', color: '#854d0e', marginBottom: '4px' }}>Upload Restricted</h3>
              <p style={{ fontSize: '13px', color: '#a16207' }}>You must sign in to upload new PDFs to your library.</p>
            </div>
          </div>
        )}

        {/* Upload Button */}
        {user && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <input type="file" accept=".pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
            <button className="btn-primary" onClick={handleUploadClick} disabled={uploading} style={{ minWidth: '220px', whiteSpace: 'nowrap' }}>
              <UploadCloud size={16} /> {uploading ? uploadStatus : 'Upload PDF'}
            </button>
          </div>
        )}

        {/* Quick Access Cards */}
        <div>
          <div className="section-header">
            <h2 className="section-title">Quick Access</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div className="card" onClick={() => navigate('/all')} style={{ padding: '20px', backgroundColor: 'var(--accent-purple)', border: 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '12px' }}>
                  <FileText color="var(--icon-purple)" size={24} />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>{loadingCounts ? '...' : pdfCount}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-gray)' }}>All PDFs</p>
              </div>
            </div>

            <div className="card" onClick={() => navigate('/favorites')} style={{ padding: '20px', backgroundColor: 'var(--accent-yellow)', border: 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '12px' }}>
                  <Star color="var(--icon-yellow)" size={24} />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>{loadingCounts ? '...' : favoriteCount}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-gray)' }}>Favorites</p>
              </div>
            </div>

            <div className="card" onClick={() => { document.getElementById('recent-pdfs-section')?.scrollIntoView({behavior: 'smooth'}) }} style={{ padding: '20px', backgroundColor: 'var(--accent-green)', border: 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '12px' }}>
                  <Clock color="var(--icon-green)" size={24} />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>{loadingPdfs ? '...' : recentPdfs.length}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-gray)' }}>Recently Uploaded</p>
              </div>
            </div>
          </div>
        </div>

        {/* PDFs List — Real Data or Search Results */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 id="recent-pdfs-section" className="section-title" style={{ margin: 0 }}>
              {searchResults ? 'Search Results' : 'All / Recent PDFs'}
            </h2>
            {searchResults && (
              <button className="btn-outline" onClick={clearSearch} style={{ padding: '4px 12px', fontSize: '12px', height: 'auto' }}>
                Clear Search
              </button>
            )}
          </div>
          <div className="card" style={{ padding: '0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr auto', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-gray)', fontWeight: '600' }}>
              <div>Name</div>
              <div>Uploaded</div>
              <div></div>
            </div>

            {isSearching || loadingPdfs ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-gray)' }}>
                <p>{isSearching ? 'Searching your library...' : 'Loading PDFs...'}</p>
              </div>
            ) : (searchResults || recentPdfs).length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-gray)' }}>
                <FileText size={48} color="#cbd5e1" style={{ margin: '0 auto 16px auto' }} />
                <p>{searchResults ? 'No PDFs matched your search.' : 'No PDFs uploaded yet.'}</p>
                {!searchResults && (
                  <p style={{ fontSize: '13px', marginTop: '8px' }}>
                    {user ? 'Click "Upload PDF" to add your first document.' : 'Sign in to upload PDFs.'}
                  </p>
                )}
              </div>
            ) : (
              (searchResults || recentPdfs).map((pdf, idx) => (
                <div
                  key={pdf.file_id}
                  onClick={() => openPdf(pdf.supabase_url)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '3fr 1fr auto',
                    padding: '16px 24px',
                    borderBottom: idx === (searchResults || recentPdfs).length - 1 ? 'none' : '1px solid var(--border-color)',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg, #f8fafc)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ backgroundColor: '#fee2e2', padding: '8px', borderRadius: '8px', color: '#ef4444', fontSize: '10px', fontWeight: 'bold', flexShrink: 0 }}>
                      PDF
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ fontSize: '14px', color: 'var(--text-dark)', fontWeight: '500', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {pdf.filename}
                        <ExternalLink size={12} color="#94a3b8" />
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-gray)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {pdf.preview || `${pdf.chunks} chunks processed`}
                      </p>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-gray)' }}>
                    <div style={{ marginBottom: '4px' }}>{pdf.date}</div>
                    <div>{pdf.time}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', color: pdf.is_favorite ? '#eab308' : '#cbd5e1' }} onClick={(e) => toggleFavorite(e, pdf.file_id)}>
                    <Star size={18} fill={pdf.is_favorite ? '#eab308' : 'none'} style={{ cursor: 'pointer' }} />
                  </div>
                </div>
              ))
            )}

            <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-gray)' }}>
                {searchResults ? (
                  `${searchResults.length} match${searchResults.length !== 1 ? 'es' : ''} found`
                ) : (
                  recentPdfs.length > 0 ? `${recentPdfs.length} PDF${recentPdfs.length !== 1 ? 's' : ''} in recent view` : 'No PDFs yet'
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="right-panel">

        {/* Semantic Search Card */}
        <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', marginBottom: '24px' }}>
            <Brain size={16} /> Semantic Search
          </div>
          <div style={{ height: '80px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '80px', height: '80px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', justifyContent: 'center' }}>
              <div style={{ height: '6px', backgroundColor: '#cbd5e1', borderRadius: '3px', width: '100%' }}></div>
              <div style={{ height: '6px', backgroundColor: '#cbd5e1', borderRadius: '3px', width: '70%' }}></div>
              <div style={{ height: '6px', backgroundColor: '#cbd5e1', borderRadius: '3px', width: '90%' }}></div>
            </div>
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>Search goes beyond keywords.</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-gray)', marginBottom: '16px', lineHeight: '1.5' }}>Find PDFs by concepts, topics, or meaning.</p>
          <a href="https://en.wikipedia.org/wiki/Semantic_search" target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
            View full details <ExternalLink size={14} />
          </a>
        </div>

        {/* Quote */}
        <div className="card" style={{ backgroundColor: 'var(--primary-light)', border: 'none' }}>
          <p style={{ fontSize: '14px', color: 'var(--primary)', fontStyle: 'italic', lineHeight: '1.6', marginBottom: '16px', fontWeight: '500' }}>
            "The goal is to turn data into information, and information into insight."
          </p>
          <p style={{ fontSize: '12px', color: 'var(--primary)', textAlign: 'right' }}>- Carly Fiorina</p>
        </div>

      </div>
    </div>
  );
};

export default DashboardHome;
