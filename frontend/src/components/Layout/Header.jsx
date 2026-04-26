import React from 'react';
import { Sun, Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Header = ({ user, onLogout }) => {
  const navigate = useNavigate();

  return (
    <header className="header">
      <div className="welcome-text">
        {user ? (
          <>
            <h1>Welcome back, {user.name}! <span role="img" aria-label="wave">👋</span></h1>
            <p>Find your PDFs instantly with the power of semantic search.</p>
          </>
        ) : (
          <>
            <h1>Mini File Manager</h1>
            <p>Please sign in to upload and manage your PDFs.</p>
          </>
        )}
      </div>

      <div className="header-actions">
        <button className="icon-btn">
          <Sun size={20} />
        </button>
        
        {user && (
          <button className="icon-btn">
            <Bell size={20} />
          </button>
        )}
        
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '8px' }}>
            <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
            <button className="btn-outline" onClick={onLogout} style={{ padding: '8px 16px', fontSize: '13px' }}>
              Logout
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '8px' }}>
            <Link to="/signin">
              <button className="btn-outline">Sign In</button>
            </Link>
            <Link to="/signup">
              <button className="btn-primary">Sign Up</button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
