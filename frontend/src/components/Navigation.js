import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Upload, User, Wallet, BarChart3, Heart, Bell, Shield } from 'lucide-react';
import axios from 'axios';
import NotificationCenter from './NotificationCenter';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Navigation = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      // Silently fail
    }
  };

  const navItems = [
    { icon: Home, label: 'Feed', path: '/feed', testId: 'nav-feed' },
    { icon: Upload, label: 'Upload', path: '/upload', testId: 'nav-upload' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics', testId: 'nav-analytics' },
    { icon: Heart, label: 'Fundraisers', path: '/fundraisers', testId: 'nav-fundraisers' },
    { icon: Wallet, label: 'Wallet', path: '/wallet', testId: 'nav-wallet' },
  ];

  if (user?.email === 'admin@example.com') {
    navItems.push({ icon: Shield, label: 'Admin', path: '/admin', testId: 'nav-admin' });
  }

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-morphism border-t border-white/10" data-testid="bottom-navigation">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-around py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <button
                key={item.path}
                data-testid={item.testId}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  active
                    ? 'text-[#10B981] bg-[#10B981]/10'
                    : 'text-[#A0A0A5] hover:text-white'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
          
          <button
            data-testid="nav-profile"
            onClick={() => navigate(`/profile/${user?.username}`)}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
              location.pathname.includes('/profile')
                ? 'text-[#10B981] bg-[#10B981]/10'
                : 'text-[#A0A0A5] hover:text-white'
            }`}
          >
            <User className="w-6 h-6" />
            <span className="text-xs font-medium">Profile</span>
          </button>

          <button
            data-testid="nav-notifications"
            onClick={() => setShowNotifications(true)}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all text-[#A0A0A5] hover:text-white relative"
          >
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-[#F43F5E] rounded-full" />
            )}
            <span className="text-xs font-medium">Alerts</span>
          </button>
        </div>
      </div>
      
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => {
          setShowNotifications(false);
          fetchUnreadCount();
        }}
      />
    </nav>
  );
};

export default Navigation;