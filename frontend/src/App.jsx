import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import DashboardHome from './pages/DashboardHome';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import AllPdfs from './pages/AllPdfs';
import Favorites from './pages/Favorites';
import CollectionDetails from './pages/CollectionDetails';
import ChatBox from './components/ChatBox/ChatBox';
import { useAuth } from './context/Auth';
import './App.css';

const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://contextdesk-backend.onrender.com' : 'http://localhost:8000');

function App() {
  const location = useLocation();
  const { user, token, logout } = useAuth();
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('contextdesk_theme');
    return saved === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('contextdesk_theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
  
  // Real PDF count fetched from backend
  const [pdfCount, setPdfCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [loadingCounts, setLoadingCounts] = useState(true);

  const fetchPdfCount = async () => {
    if (!token) return;
    setLoadingCounts(true);
    try {
      const res = await fetch(`${API}/api/pdf-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPdfCount(data.count);
        setFavoriteCount(data.favorite_count || 0);
      } else if (res.status === 401) {
        // If token is invalid or expired, log the user out
        logout();
      }
    } catch (err) {
      // backend may not be running yet, silently ignore
    } finally {
      setLoadingCounts(false);
    }
  };

  // Fetch count when token changes
  useEffect(() => {
    fetchPdfCount();
  }, [token]);
  
  const isAuthPage = location.pathname === '/signin' || location.pathname === '/signup';

  return (
    <div className={`app-container ${isDarkMode ? 'dark' : ''}`}>
      {/* Hide Sidebar entirely on sign-in and sign-up pages */}
      {!isAuthPage && (
        <Sidebar user={user} token={token} onLogout={logout} pdfCount={pdfCount} />
      )}
      
      <div className="main-content">
        {/* Hide Header on auth pages for a cleaner layout */}
        {!isAuthPage && (
          <Header user={user} onLogout={logout} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
        )}
        
        <Routes>
          <Route path="/" element={user ? <DashboardHome user={user} token={token} pdfCount={pdfCount} favoriteCount={favoriteCount} loadingCounts={loadingCounts} onUploadSuccess={fetchPdfCount} /> : <Navigate to="/signin" />} />
          <Route path="/all" element={user ? <AllPdfs user={user} token={token} /> : <Navigate to="/signin" />} />
          <Route path="/recent" element={<Navigate to="/" />} />
          <Route path="/favorites" element={user ? <Favorites user={user} token={token} /> : <Navigate to="/signin" />} />
          <Route path="/collections/:id" element={user ? <CollectionDetails user={user} token={token} /> : <Navigate to="/signin" />} />
          <Route path="/trash" element={<Navigate to="/" />} />
          <Route path="/signin" element={user ? <Navigate to="/" /> : <SignIn />} />
          <Route path="/signup" element={user ? <Navigate to="/" /> : <SignUp />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        
        {/* Render ChatBox floating widget only for authenticated users */}
        {user && !isAuthPage && <ChatBox />}
      </div>
    </div>
  );
}

export default App;
