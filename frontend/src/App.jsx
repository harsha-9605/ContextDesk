import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import DashboardHome from './pages/DashboardHome';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import { useAuth } from './context/Auth';
import './App.css';

function App() {
  const location = useLocation();
  const { user, logout } = useAuth();
  
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

  const fetchPdfCount = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/pdf-count');
      if (res.ok) {
        const data = await res.json();
        setPdfCount(data.count);
      }
    } catch (err) {
      // backend may not be running yet, silently ignore
    }
  };

  // Fetch count on initial load
  useEffect(() => {
    fetchPdfCount();
  }, []);
  
  const isAuthPage = location.pathname === '/signin' || location.pathname === '/signup';

  return (
    <div className={`app-container ${isDarkMode ? 'dark' : ''}`}>
      {/* Hide Sidebar entirely on sign-in and sign-up pages */}
      {!isAuthPage && (
        <Sidebar user={user} onLogout={logout} pdfCount={pdfCount} />
      )}
      
      <div className="main-content">
        {/* Hide Header on auth pages for a cleaner layout */}
        {!isAuthPage && (
          <Header user={user} onLogout={logout} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
        )}
        
        <Routes>
          <Route path="/" element={<DashboardHome user={user} pdfCount={pdfCount} onUploadSuccess={fetchPdfCount} />} />
          <Route path="/signin" element={user ? <Navigate to="/" /> : <SignIn />} />
          <Route path="/signup" element={user ? <Navigate to="/" /> : <SignUp />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
