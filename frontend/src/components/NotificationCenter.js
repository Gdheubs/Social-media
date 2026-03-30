import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Gift, MessageCircle, Award, TrendingUp } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NotificationCenter = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/notifications/${notificationId}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/notifications/read-all`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('All notifications marked as read');
      fetchNotifications();
    } catch (error) {
      toast.error('Failed to mark notifications');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'tip':
        return <Gift className="w-5 h-5 text-[#10B981]" />;
      case 'comment':
        return <MessageCircle className="w-5 h-5 text-[#10B981]" />;
      case 'milestone':
        return <Award className="w-5 h-5 text-[#10B981]" />;
      default:
        return <TrendingUp className="w-5 h-5 text-[#10B981]" />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-end" data-testid="notification-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative glass-morphism h-full sm:h-auto sm:max-h-[600px] w-full sm:w-[400px] sm:m-4 sm:rounded-3xl overflow-hidden flex flex-col"
        >
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold">Notifications</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                data-testid="close-notifications-btn"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-[#10B981] hover:underline"
                data-testid="mark-all-read-btn"
              >
                Mark all as read ({unreadCount})
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center py-12 text-[#A0A0A5]">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 text-[#A0A0A5]">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl cursor-pointer transition-colors ${
                      notification.read
                        ? 'bg-white/5 hover:bg-white/10'
                        : 'bg-[#10B981]/10 border border-[#10B981]/20 hover:bg-[#10B981]/20'
                    }`}
                    onClick={() => {
                      if (!notification.read) {
                        handleMarkAsRead(notification.id);
                      }
                      if (notification.link) {
                        navigate(notification.link);
                        onClose();
                      }
                    }}
                    data-testid="notification-item"
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 p-2 rounded-full bg-black/40">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed">{notification.message}</p>
                        <p className="text-xs text-[#A0A0A5] mt-1">
                          {new Date(notification.created_at).toLocaleDateString()} at{' '}
                          {new Date(notification.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default NotificationCenter;