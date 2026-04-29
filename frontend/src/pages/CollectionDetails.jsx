import React, { useState, useEffect, useCallback } from 'react';
import { Search, FileText, Star, ExternalLink, ArrowLeft, Plus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://contextdesk-backend.onrender.com' : 'http://localhost:8000');

const CollectionDetails = ({ user, token }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // For the Add PDF Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [allUserPdfs, setAllUserPdfs] = useState([]);
  const [loadingAllPdfs, setLoadingAllPdfs] = useState(false);

  const fetchCollectionDetails = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/collections/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCollection(data);
      } else {
        navigate('/'); // invalid collection
      }
    } catch (_) {}
    setLoading(false);
  }, [id, token, navigate]);

  useEffect(() => {
    fetchCollectionDetails();
  }, [fetchCollectionDetails]);

  const handleOpenAddModal = async () => {
    setShowAddModal(true);
    setLoadingAllPdfs(true);
    try {
      const res = await fetch(`${API}/api/pdfs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllUserPdfs(data.pdfs || []);
      }
    } catch (_) {}
    setLoadingAllPdfs(false);
  };

  const addPdfToCollection = async (file_id) => {
    try {
      const res = await fetch(`${API}/api/collections/${id}/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ file_id })
      });
      if (res.ok) {
        fetchCollectionDetails();
        setShowAddModal(false);
      }
    } catch (_) {}
  };

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
        fetchCollectionDetails();
      }
    } catch (_) {}
  };

  if (loading || !collection) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-gray)' }}>
        Loading collection...
      </div>
    );
  }

  const pdfs = collection.pdfs || [];
  const filteredPdfs = pdfs.filter(p => 
    p.filename.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="icon-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>{collection.name}</h1>
        </div>
        <button className="btn-primary" onClick={handleOpenAddModal} style={{ padding: '8px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Plus size={16} /> Add PDF
        </button>
      </div>

      <div className="search-area" style={{ marginBottom: '24px' }}>
        <div className="search-input-wrapper">
          <Search size={20} color="#94a3b8" />
          <input 
            type="text" 
            placeholder="Search within this collection..." 
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

        {filteredPdfs.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-gray)' }}>
            <FileText size={48} color="#cbd5e1" style={{ margin: '0 auto 16px auto' }} />
            <p>No PDFs in this collection yet.</p>
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
              <div style={{ display: 'flex', gap: '16px', color: pdf.is_favorite ? '#eab308' : '#cbd5e1' }} onClick={(e) => toggleFavorite(e, pdf.file_id)}>
                <Star size={18} fill={pdf.is_favorite ? '#eab308' : 'none'} style={{ cursor: 'pointer' }} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add PDF Modal overlay */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', margin: 0 }}>Add PDF to {collection.name}</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
              {loadingAllPdfs ? (
                <p>Loading your PDFs...</p>
              ) : allUserPdfs.length === 0 ? (
                <p>You haven't uploaded any PDFs yet.</p>
              ) : (
                allUserPdfs.map(p => {
                  const alreadyInCollection = collection.pdfs.some(cp => cp.file_id === p.file_id);
                  return (
                    <div key={p.file_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #eee' }}>
                      <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.filename}
                      </div>
                      <button 
                        onClick={() => addPdfToCollection(p.file_id)}
                        disabled={alreadyInCollection}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: alreadyInCollection ? '#e2e8f0' : 'var(--primary)',
                          color: alreadyInCollection ? '#94a3b8' : 'white',
                          cursor: alreadyInCollection ? 'not-allowed' : 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        {alreadyInCollection ? 'Added' : 'Add'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionDetails;
