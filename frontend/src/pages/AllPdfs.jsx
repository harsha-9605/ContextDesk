import React, { useState, useEffect, useCallback } from 'react';
import { Search, FileText, Star, ExternalLink, ArrowLeft, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://contextdesk-backend.onrender.com' : 'http://localhost:8000');

const AllPdfs = ({ user, token }) => {
  const navigate = useNavigate();
  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPdfs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/pdfs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPdfs(data.pdfs || []);
      }
    } catch (_) {}
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchPdfs();
  }, [fetchPdfs]);

  const openPdf = (url) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const toggleFavorite = async (e, file_id) => {
    e.stopPropagation();
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
        fetchPdfs();
      }
    } catch (_) {}
  };

  const deletePdf = async (e, file_id) => {
    e.stopPropagation();
    if (!token) return;
    if (!window.confirm("Are you sure you want to delete this PDF? This cannot be undone.")) return;
    
    try {
      const res = await fetch(`${API}/api/pdfs/${file_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchPdfs();
      }
    } catch (err) {
      console.error("Error deleting PDF:", err);
    }
  };


  const filteredPdfs = pdfs.filter(p => 
    p.filename.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button className="icon-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>All PDFs</h1>
      </div>

      <div className="search-area" style={{ marginBottom: '24px' }}>
        <div className="search-input-wrapper">
          <Search size={20} color="#94a3b8" />
          <input 
            type="text" 
            placeholder="Filter PDFs by name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ padding: '0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr auto', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-gray)', fontWeight: '600' }}>
          <div>Name</div>
          <div>Uploaded</div>
          <div></div>
        </div>

        {loading ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-gray)' }}>
            <p>Loading your library...</p>
          </div>
        ) : filteredPdfs.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-gray)' }}>
            <FileText size={48} color="#cbd5e1" style={{ margin: '0 auto 16px auto' }} />
            <p>No PDFs found.</p>
          </div>
        ) : (
          filteredPdfs.map((pdf, idx) => (
            <div
              key={pdf.file_id}
              onClick={() => openPdf(pdf.supabase_url)}
              style={{
                display: 'grid',
                gridTemplateColumns: '3fr 1fr auto',
                padding: '16px 24px',
                borderBottom: idx === filteredPdfs.length - 1 ? 'none' : '1px solid var(--border-color)',
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
              <div style={{ display: 'flex', gap: '16px', color: pdf.is_favorite ? '#eab308' : '#cbd5e1' }}>
                <Star size={18} fill={pdf.is_favorite ? '#eab308' : 'none'} style={{ cursor: 'pointer' }} onClick={(e) => toggleFavorite(e, pdf.file_id)} />
                <Trash2 size={18} color="#ef4444" style={{ cursor: 'pointer', opacity: 0.8 }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.8} onClick={(e) => deletePdf(e, pdf.file_id)} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AllPdfs;
