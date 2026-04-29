import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Home, FileText, Star, Clock, Trash2, Plus, Folder } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'https://contextdesk-backend.onrender.com';

const Sidebar = ({ user, token, onLogout, pdfCount }) => {
  const location = useLocation();
  const path = location.pathname;

  const [collections, setCollections] = useState([]);
  
  const fetchCollections = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/collections`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections || []);
      }
    } catch (_) {}
  }, [token]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleCreateCollection = async () => {
    if (!token) {
      alert("Please sign in to create a collection.");
      return;
    }
    const name = window.prompt("Enter new collection name:");
    if (!name || !name.trim()) return;

    try {
      const res = await fetch(`${API}/api/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: name.trim() })
      });
      if (res.ok) {
        fetchCollections();
      } else {
        alert("Failed to create collection.");
      }
    } catch (_) {}
  };


  // Real storage estimate: each PDF ≈ ~0.5MB average
  const estimatedMB = pdfCount * 0.5;
  const totalGB = 5;
  const usedGB = Math.min(estimatedMB / 1024, totalGB);
  const usedPercent = Math.round((usedGB / totalGB) * 100);
  const usedDisplay = usedGB < 0.1
    ? `${Math.round(estimatedMB)} MB`
    : `${usedGB.toFixed(2)} GB`;

  return (
    <aside className="sidebar">
      <div className="logo-area">
        <div className="logo-icon">
          <Shield size={24} />
        </div>
        <div className="logo-text">
          <h2>ContextDesk</h2>
          <p>Smart. Semantic. Simple.</p>
        </div>
      </div>

      <div className="nav-section">
        <ul className="nav-list">
          <Link to="/" className={`nav-item ${path === '/' ? 'active' : ''}`}>
            <Home className="nav-icon" />
            <span>Home</span>
          </Link>
          <Link to="/all" className={`nav-item ${path === '/all' ? 'active' : ''}`}>
            <FileText className="nav-icon" />
            <span>All PDFs</span>
          </Link>
          <Link to="/favorites" className={`nav-item ${path === '/favorites' ? 'active' : ''}`}>
            <Star className="nav-icon" />
            <span>Favorites</span>
          </Link>
          <Link to="/recent" className={`nav-item ${path === '/recent' ? 'active' : ''}`}>
            <Clock className="nav-icon" />
            <span>Recent</span>
          </Link>
          <Link to="/trash" className={`nav-item ${path === '/trash' ? 'active' : ''}`}>
            <Trash2 className="nav-icon" />
            <span>Trash</span>
          </Link>
        </ul>
      </div>

      {/* Collections */}
      <div className="nav-section">
        <div className="nav-section-title">
          <span>Collections</span>
          {user && <Plus size={16} onClick={handleCreateCollection} style={{ cursor: 'pointer', opacity: 0.7 }} title="Create Collection" />}
        </div>
        <ul className="nav-list" style={{ marginTop: '8px' }}>
          {collections.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-gray)', padding: '4px 12px' }}>
              No collections yet.
            </div>
          ) : (
            collections.map(col => (
              <Link to={`/collections/${col.id}`} key={col.id} className={`nav-item ${path === `/collections/${col.id}` ? 'active' : ''}`}>
                <Folder className="nav-icon" size={18} />
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.name}</span>
                <span style={{ fontSize: '11px', backgroundColor: 'var(--border-color)', padding: '2px 6px', borderRadius: '10px' }}>{col.pdf_count}</span>
              </Link>
            ))
          )}
        </ul>
      </div>

      {/* Storage — based on real pdf count */}
      <div className="storage-card">
        <div className="storage-title">Storage Used</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{ position: 'relative', width: '48px', height: '48px' }}>
            <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#eee"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#7b61ff"
                strokeWidth="3"
                strokeDasharray={`${usedPercent}, 100`}
              />
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '12px', fontWeight: 'bold' }}>
              {usedPercent}%
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>
              {pdfCount === 0 ? '0 MB' : usedDisplay} / {totalGB} GB
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-gray)', marginTop: '2px' }}>
              {pdfCount} PDF{pdfCount !== 1 ? 's' : ''} uploaded
            </div>
          </div>
        </div>
        <button className="btn-outline" style={{ width: '100%', justifyContent: 'center', color: '#7b61ff', borderColor: '#e2e8f0' }}>
          <Shield size={16} /> Upgrade Storage
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
