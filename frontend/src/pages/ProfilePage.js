import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Edit2, Save, X, LogOut, Users } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import NetworkScore from '../components/NetworkScore';
import RankBadge from '../components/RankBadge';
import { Progress } from '@/components/ui/progress';

const ProfilePage = ({ user, setUser }) => {
  const { userId } = useParams();
  const isOwnProfile = !userId || userId === user.id;
  const [profileUser, setProfileUser] = useState(user);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    username: user.username,
    bio: user.bio,
    photo: user.photo,
  });

  useEffect(() => {
    if (!isOwnProfile && userId) {
      fetchUserProfile(userId);
    } else {
      setProfileUser(user);
    }
  }, [userId, user]);

  const fetchUserProfile = async (id) => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(`/users/${id}`);
      setProfileUser(response.data);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await axiosInstance.put('/users/me', editData);
      setUser(response.data);
      setProfileUser(response.data);
      setEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditData({ ...editData, photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/auth';
  };

  const getNextRankScore = (currentScore) => {
    if (currentScore < 500) return 500;
    if (currentScore < 2000) return 2000;
    return 5000;
  };

  const calculateProgress = (score) => {
    if (score < 500) return (score / 500) * 100;
    if (score < 2000) return ((score - 500) / 1500) * 100;
    return Math.min(((score - 2000) / 3000) * 100, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-6">
      <div className="bg-gradient-to-br from-primary to-secondary h-32"></div>

      <div className="max-w-2xl mx-auto px-4 -mt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
        >
          <div className="flex items-start gap-4 mb-6">
            <div className="relative">
              {editing ? (
                <label className="cursor-pointer group">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={editData.photo} />
                    <AvatarFallback>{editData.username[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Edit2 className="text-white" size={20} />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    data-testid="profile-photo-input"
                  />
                </label>
              ) : (
                <Avatar className="w-24 h-24">
                  <AvatarImage src={profileUser.photo} />
                  <AvatarFallback>{profileUser.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
            </div>

            <div className="flex-1">
              {editing ? (
                <input
                  type="text"
                  value={editData.username}
                  onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                  className="text-2xl font-heading font-bold mb-2 w-full border border-gray-300 rounded-lg px-3 py-1 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  data-testid="username-edit-input"
                />
              ) : (
                <h1 className="text-2xl font-heading font-bold text-text-primary mb-2">
                  {profileUser.username}
                </h1>
              )}
              <RankBadge rank={profileUser.rank} />
            </div>

            {isOwnProfile && (
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="bg-secondary hover:bg-secondary-hover text-white p-2 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
                      data-testid="save-profile-button"
                    >
                      <Save size={20} />
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setEditData({
                          username: user.username,
                          bio: user.bio,
                          photo: user.photo,
                        });
                      }}
                      className="bg-gray-200 hover:bg-gray-300 text-text-primary p-2 rounded-full transition-all"
                      data-testid="cancel-edit-button"
                    >
                      <X size={20} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="bg-primary hover:bg-primary-hover text-white p-2 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
                    data-testid="edit-profile-button"
                  >
                    <Edit2 size={20} />
                  </button>
                )}
              </div>
            )}
          </div>

          {editing ? (
            <textarea
              value={editData.bio}
              onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
              placeholder="Write something about yourself..."
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none mb-4"
              data-testid="bio-edit-input"
            />
          ) : (
            <p className="text-text-secondary mb-6">
              {profileUser.bio || 'No bio yet'}
            </p>
          )}

          <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-secondary">Network Score</span>
              <span className="text-xs text-text-muted">
                {profileUser.network_score} / {getNextRankScore(profileUser.network_score)}
              </span>
            </div>
            <NetworkScore score={profileUser.network_score} size="large" />
            <Progress value={calculateProgress(profileUser.network_score)} className="mt-3 h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-background-subtle rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{profileUser.network_score}</p>
              <p className="text-sm text-text-secondary">Total Score</p>
            </div>
            <div className="bg-background-subtle rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-secondary">{profileUser.rank}</p>
              <p className="text-sm text-text-secondary">Current Rank</p>
            </div>
          </div>

          {isOwnProfile && (
            <>
              <button
                onClick={() => window.location.href = '/referral'}
                className="w-full flex items-center justify-center gap-2 bg-secondary hover:bg-secondary-hover text-white font-medium py-3 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95 mb-3"
                data-testid="referral-button"
              >
                <Users size={20} />
                Invite Friends (+200 pts)
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-medium py-3 rounded-full transition-all border border-red-200"
                data-testid="logout-button"
              >
                <LogOut size={20} />
                Logout
              </button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ProfilePage;