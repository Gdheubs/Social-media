import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Landing from '@/pages/Landing';
import Feed from '@/pages/Feed';
import Upload from '@/pages/Upload';
import Profile from '@/pages/Profile';
import Wallet from '@/pages/Wallet';
import Analytics from '@/pages/Analytics';
import Fundraisers from '@/pages/Fundraisers';
import TipSuccess from '@/pages/TipSuccess';
import FundraiserSuccess from '@/pages/FundraiserSuccess';
import '@/index.css';
import '@/App.css';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleAuth = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route 
            path="/" 
            element={
              isAuthenticated ? 
              <Navigate to="/feed" /> : 
              <Landing onAuth={handleAuth} />
            } 
          />
          <Route 
            path="/feed" 
            element={
              isAuthenticated ? 
              <Feed user={user} onLogout={handleLogout} /> : 
              <Navigate to="/" />
            } 
          />
          <Route 
            path="/upload" 
            element={
              isAuthenticated ? 
              <Upload user={user} onLogout={handleLogout} /> : 
              <Navigate to="/" />
            } 
          />
          <Route 
            path="/profile/:username" 
            element={<Profile currentUser={user} onLogout={handleLogout} />} 
          />
          <Route 
            path="/wallet" 
            element={
              isAuthenticated ? 
              <Wallet user={user} onLogout={handleLogout} /> : 
              <Navigate to="/" />
            } 
          />
          <Route 
            path="/analytics" 
            element={
              isAuthenticated ? 
              <Analytics user={user} onLogout={handleLogout} /> : 
              <Navigate to="/" />
            } 
          />
          <Route 
            path="/fundraisers" 
            element={
              isAuthenticated ? 
              <Fundraisers user={user} onLogout={handleLogout} /> : 
              <Navigate to="/" />
            } 
          />
          <Route 
            path="/tip-success" 
            element={
              isAuthenticated ? 
              <TipSuccess /> : 
              <Navigate to="/" />
            } 
          />
          <Route 
            path="/fundraiser-success" 
            element={
              isAuthenticated ? 
              <FundraiserSuccess /> : 
              <Navigate to="/" />
            } 
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </div>
  );
};

export default App;