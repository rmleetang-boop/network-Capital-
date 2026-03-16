import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, TrendingUp, Star, Users, Check } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const NotificationsPage = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axiosInstance.get('/notifications');
      setNotifications(response.data);
    } catch (error) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axiosInstance.put(`/notifications/${notificationId}/read`);
      setNotifications(
        notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'score_increase':
        return <TrendingUp className="text-secondary" size={20} />;
      case 'level_up':
        return <Star className="text-accent-gold" size={20} />;
      case 'referral':
        return <Users className="text-primary" size={20} />;
      default:
        return <Bell className="text-text-muted" size={20} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-DEFAULT">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 py-4">
        <h1 className="text-2xl font-heading font-bold text-primary">Notifications</h1>
        <p className="text-sm text-text-secondary">
          {notifications.filter((n) => !n.read).length} unread
        </p>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-2">
        {notifications.map((notification, index) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className={`bg-white rounded-2xl shadow-sm border p-4 hover:shadow-md transition-all ${
              notification.read ? 'border-gray-100' : 'border-primary/30 bg-primary/5'
            }`}
            data-testid={`notification-${index}`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-background-subtle rounded-full">
                {getNotificationIcon(notification.type)}
              </div>

              <div className="flex-1">
                <p className="text-text-primary font-medium mb-1">
                  {notification.message}
                </p>
                <p className="text-xs text-text-muted">
                  {new Date(notification.created_at).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-secondary">
                  +{notification.points}
                </span>
                {!notification.read && (
                  <button
                    onClick={() => markAsRead(notification.id)}
                    className="p-1.5 bg-primary hover:bg-primary-hover text-white rounded-full transition-all active:scale-95"
                    data-testid={`mark-read-${index}`}
                  >
                    <Check size={16} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {notifications.length === 0 && (
          <div className="text-center py-12">
            <Bell className="mx-auto mb-4 text-text-muted" size={48} />
            <p className="text-text-secondary">No notifications yet</p>
            <p className="text-sm text-text-muted mt-2">
              Start engaging to earn points and see notifications here
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;