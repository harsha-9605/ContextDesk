import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import DashboardHome from './pages/DashboardHome';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import './App.css';

function App() {
  // Mock authentication state
  const [user, setUser] = useState(null); // null means not logged in

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <Router>
      <div className="app-container">
        {/* Sidebar is always visible for navigation */}
        <Sidebar user={user} onLogout={handleLogout} />
        
        <div className="main-content">
          <Header user={user} onLogout={handleLogout} />
          
          <Routes>
            <Route path="/" element={<DashboardHome user={user} />} />
            <Route path="/signin" element={user ? <Navigate to="/" /> : <SignIn onLogin={handleLogin} />} />
            <Route path="/signup" element={user ? <Navigate to="/" /> : <SignUp onLogin={handleLogin} />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
