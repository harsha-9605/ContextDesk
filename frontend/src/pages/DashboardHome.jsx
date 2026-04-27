import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Search, FileText, Star, Clock, Folder, Sparkles, Brain, UploadCloud, ExternalLink } from 'lucide-react';

const API = 'http://localhost:8000';

const DashboardHome = ({ user, pdfCount, onUploadSuccess }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // Real data from backend
  const [recentPdfs, setRecentPdfs] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loadingPdfs, setLoadingPdfs] = useState(false);

  // ── Fetch real PDFs ──────────────────────────────────────────────
  const fetchPdfs = useCallback(async () => {
    setLoadingPdfs(true);
    try {
      const res = await fetch(`${API}/api/pdfs`);
      if (res.ok) {
        const data = await res.json();
        setRecentPdfs(data.pdfs || []);
      }
    } catch (_) {}
    setLoadingPdfs(false);
  }, []);

  // ── Fetch real topics ────────────────────────────────────────────
  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/topics`);
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics || []);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchPdfs();
    fetchTopics();
  }, [fetchPdfs, fetchTopics]);

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
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Upload failed');
      }
      const result = await response.json();
      alert(`✅ Uploaded "${result.filename}" — ${result.chunks_created} chunks processed.`);
      // Refresh everything
      if (onUploadSuccess) onUploadSuccess();
      fetchPdfs();
      fetchTopics();
    } catch (err) {
      alert(`Error uploading file: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  // ── Open PDF in new tab ──────────────────────────────────────────
  const openPdf = (url) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="dashboard-layout">
      {/* ── Center Panel ── */}
      <div className="center-panel">

        {/* Search Bar */}
        <div className="search-area">
          <div className="search-input-wrapper">
            <Search size={20} color="#94a3b8" />
            <input type="text" placeholder="Search PDFs by name or meaning..." />
            <button className="btn-primary" style={{ padding: '8px 24px', height: '36px', borderRadius: '8px' }}>
              <Sparkles size={16} /> Search
            </button>
          </div>
          <div className="search-suggestions">
            <span>Try searching:</span>
            <span className="suggestion-pill">machine learning</span>
            <span className="suggestion-pill">neural networks</span>
            <span className="suggestion-pill">data privacy</span>
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
            <button className="btn-primary" onClick={handleUploadClick} disabled={uploading}>
              <UploadCloud size={16} /> {uploading ? 'Uploading...' : 'Upload PDF'}
            </button>
          </div>
        )}

        {/* Quick Access Cards */}
        <div>
          <div className="section-header">
            <h2 className="section-title">Quick Access</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div className="card" style={{ padding: '20px', backgroundColor: 'var(--accent-purple)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '12px' }}>
                  <FileText color="var(--icon-purple)" size={24} />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>{pdfCount}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-gray)' }}>All PDFs</p>
              </div>
            </div>

            <div className="card" style={{ padding: '20px', backgroundColor: 'var(--accent-yellow)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '12px' }}>
                  <Star color="var(--icon-yellow)" size={24} />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>0</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-gray)' }}>Favorites</p>
              </div>
            </div>

            <div className="card" style={{ padding: '20px', backgroundColor: 'var(--accent-green)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '12px' }}>
                  <Clock color="var(--icon-green)" size={24} />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>{recentPdfs.length}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-gray)' }}>Recently Uploaded</p>
              </div>
            </div>

            <div className="card" style={{ padding: '20px', backgroundColor: 'var(--accent-blue)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '12px' }}>
                  <Folder color="var(--icon-blue)" size={24} />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>{topics.length}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-gray)' }}>Topics Found</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent PDFs — 100% real data */}
        <div>
          <h2 className="section-title" style={{ marginBottom: '16px' }}>Recent PDFs</h2>
          <div className="card" style={{ padding: '0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr auto', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-gray)', fontWeight: '600' }}>
              <div>Name</div>
              <div>Uploaded</div>
              <div></div>
            </div>

            {loadingPdfs ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-gray)' }}>
                <p>Loading PDFs...</p>
              </div>
            ) : recentPdfs.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-gray)' }}>
                <FileText size={48} color="#cbd5e1" style={{ margin: '0 auto 16px auto' }} />
                <p>No PDFs uploaded yet.</p>
                <p style={{ fontSize: '13px', marginTop: '8px' }}>
                  {user ? 'Click "Upload PDF" to add your first document.' : 'Sign in to upload PDFs.'}
                </p>
              </div>
            ) : (
              recentPdfs.map((pdf, idx) => (
                <div
                  key={pdf.file_id}
                  onClick={() => openPdf(pdf.supabase_url)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '3fr 1fr auto',
                    padding: '16px 24px',
                    borderBottom: idx === recentPdfs.length - 1 ? 'none' : '1px solid var(--border-color)',
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
                  <div style={{ display: 'flex', gap: '16px', color: '#cbd5e1' }}>
                    <Star size={18} />
                  </div>
                </div>
              ))
            )}

            <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-gray)' }}>
                {recentPdfs.length > 0 ? `${recentPdfs.length} PDF${recentPdfs.length !== 1 ? 's' : ''} in your library` : 'No PDFs yet'}
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
        </div>

        {/* Top Topics — 100% real data */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '24px' }}>Top Topics in Your Library</h3>
          {topics.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '20px 0' }}>
              <p style={{ fontSize: '13px' }}>No topics discovered yet.</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Upload PDFs to start discovering topics.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {topics.map(topic => (
                <div key={topic.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-dark)' }}>{topic.name}</span>
                    <span style={{ color: 'var(--text-gray)' }}>{topic.val}%</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${topic.val}%`, backgroundColor: 'var(--primary)', borderRadius: '3px' }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
