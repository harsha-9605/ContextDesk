import React, { useState, useEffect, useCallback } from 'react';
import { Search, FileText, Star, ExternalLink, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://contextdesk-backend.onrender.com' : 'http://localhost:8000');

const Favorites = ({ user, token }) => {
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
        // Only keep favorites
        setPdfs((data.pdfs || []).filter(p => p.is_favorite));
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
        // If a favorite is toggled off here, it will be removed from the list when we re-fetch
        fetchPdfs();
      }
    } catch (_) {}
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
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Favorites</h1>
      </div>

      <div className="search-area" style={{ marginBottom: '24px' }}>
        <div className="search-input-wrapper">
          <Search size={20} color="#94a3b8" />
          <input 
            type="text" 
            placeholder="Search favorite PDFs..." 
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
            <p>Loading favorites...</p>
          </div>
        ) : filteredPdfs.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-gray)' }}>
            <Star size={48} color="#cbd5e1" style={{ margin: '0 auto 16px auto' }} />
            <p>No favorites found.</p>
            <p style={{ fontSize: '13px', marginTop: '8px' }}>Star some PDFs to add them here.</p>
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
                <div style={{ backgroundColor: '#fef08a', padding: '8px', borderRadius: '8px', color: '#a16207', fontSize: '10px', fontWeight: 'bold', flexShrink: 0 }}>
                  FAV
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
              <div style={{ display: 'flex', gap: '16px', color: '#eab308' }} onClick={(e) => toggleFavorite(e, pdf.file_id)}>
                <Star size={18} fill="#eab308" style={{ cursor: 'pointer' }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Favorites;
