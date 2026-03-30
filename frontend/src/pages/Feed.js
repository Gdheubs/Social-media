import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Share2, Gift, Play, Pause, Volume2, VolumeX, Send, Search, X, Filter } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import TipModal from '@/components/TipModal';
import CreatorSpotlight from '@/components/CreatorSpotlight';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CommentSection = ({ video, isOpen, onClose }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && video) {
      fetchComments();
    }
  }, [isOpen, video]);

  const fetchComments = async () => {
    try {
      const response = await axios.get(`${API}/videos/${video.id}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Failed to load comments');
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/videos/${video.id}/comments`,
        { text: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewComment('');
      fetchComments();
      toast.success('Comment added');
    } catch (error) {
      toast.error('Failed to add comment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end" data-testid="comment-section">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative glass-morphism rounded-t-3xl w-full max-h-[70vh] flex flex-col"
        >
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Comments</h3>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full" data-testid="close-comments-btn">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {comments.length === 0 ? (
              <div className="text-center py-12 text-[#A0A0A5]">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>No comments yet. Be the first!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3" data-testid="comment-item">
                  <img
                    src={comment.user_avatar || 'https://images.unsplash.com/photo-1758486190195-dd677b21e00f?w=100&h=100&fit=crop'}
                    alt={comment.username}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{comment.username}</p>
                    <p className="text-sm">{comment.text}</p>
                    <p className="text-xs text-[#A0A0A5] mt-1">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSubmitComment} className="p-6 border-t border-white/10">
            <div className="flex gap-3">
              <input
                data-testid="comment-input"
                type="text"
                className="input-field flex-1"
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={loading}
              />
              <button
                data-testid="submit-comment-btn"
                type="submit"
                className="btn-primary p-3"
                disabled={loading || !newComment.trim()}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const VideoCard = ({ video, onTip, onCommentOpen }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    const handleView = async () => {
      try {
        const token = localStorage.getItem('token');
        await axios.post(
          `${API}/videos/${video.id}/view`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (error) {
        console.error('View tracking error:', error);
      }
    };

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            videoRef.current?.play();
            setIsPlaying(true);
            handleView();
          } else {
            videoRef.current?.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.7 }
    );

    if (videoRef.current) {
      observerRef.current.observe(videoRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [video.id]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div 
      className="snap-item relative w-full h-screen flex items-center justify-center bg-black"
      data-testid="video-card"
    >
      <div className="relative w-full max-w-[500px] h-full">
        <video
          ref={videoRef}
          src={video.cloudinary_url}
          className="w-full h-full object-cover"
          loop
          muted={isMuted}
          playsInline
          data-testid="video-player"
        />

        <div className="absolute bottom-0 left-0 right-0 video-gradient-mask p-6">
          <div className="flex items-center gap-3 mb-3">
            <img
              src={video.user_avatar || 'https://images.unsplash.com/photo-1758486190195-dd677b21e00f?w=100&h=100&fit=crop'}
              alt={video.username}
              className="w-12 h-12 rounded-full border-2 border-[#10B981]"
            />
            <div>
              <p className="font-semibold text-white">{video.username}</p>
              <p className="text-xs text-[#A0A0A5]">{video.view_count.toLocaleString()} views</p>
            </div>
          </div>
          
          <h3 className="text-lg font-semibold mb-2">{video.title}</h3>
          {video.description && (
            <p className="text-sm text-[#A0A0A5] line-clamp-2">{video.description}</p>
          )}
        </div>

        <div className="absolute right-4 bottom-32 flex flex-col gap-6">
          <button
            className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-colors"
            data-testid="like-btn"
          >
            <Heart className="w-6 h-6" />
          </button>
          
          <button
            className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-colors"
            data-testid="comment-btn"
            onClick={() => onCommentOpen(video)}
          >
            <MessageCircle className="w-6 h-6" />
          </button>
          
          <button
            className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-colors"
            data-testid="share-btn"
          >
            <Share2 className="w-6 h-6" />
          </button>
          
          <button
            onClick={() => onTip(video)}
            className="p-3 rounded-full bg-[#10B981] text-black hover:bg-[#059669] transition-colors"
            data-testid="tip-btn"
          >
            <Gift className="w-6 h-6" />
          </button>
        </div>

        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={togglePlayPause}
            className="p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white"
            data-testid="play-pause-btn"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          
          <button
            onClick={toggleMute}
            className="p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white"
            data-testid="mute-btn"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

const Feed = ({ user, onLogout }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all');

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await axios.get(`${API}/videos/feed`);
      setVideos(response.data);
    } catch (error) {
      toast.error('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchVideos();
      return;
    }

    setLoading(true);
    try {
      const aspectRatio = searchFilter === 'all' ? '' : searchFilter;
      const response = await axios.get(`${API}/videos/search/query`, {
        params: {
          q: searchQuery,
          aspect_ratio: aspectRatio || undefined
        }
      });
      setVideos(response.data);
      setShowSearch(false);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTip = (video) => {
    setSelectedVideo(video);
    setShowTipModal(true);
  };

  const handleCommentOpen = (video) => {
    setSelectedVideo(video);
    setShowComments(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading feed...</div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden" data-testid="feed-page">
      {/* Search Bar */}
      <div className="absolute top-0 left-0 right-0 z-40">
        <div className="glass-morphism border-b border-white/10 p-4">
          <div className="max-w-[500px] mx-auto flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A0A0A5]" />
              <input
                data-testid="search-input"
                type="text"
                className="input-field w-full pl-10"
                placeholder="Search videos, creators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-3 rounded-xl transition-colors ${ 
                showSearch ? 'bg-[#10B981] text-black' : 'bg-white/10 text-white'
              }`}
              data-testid="filter-btn"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
          
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="max-w-[500px] mx-auto mt-4 flex gap-2"
            >
              {['all', '9:16', '16:9'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSearchFilter(filter)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    searchFilter === filter
                      ? 'bg-[#10B981] text-black'
                      : 'bg-white/10 text-white'
                  }`}
                  data-testid={`filter-${filter}`}
                >
                  {filter === 'all' ? 'All Videos' : filter}
                </button>
              ))}
            </motion.div>
          )}
        </div>
        
        <CreatorSpotlight />
      </div>

      {/* Video Feed */}
      <div className="snap-container h-screen overflow-y-scroll pt-32">
        {videos.map((video) => (
          <VideoCard 
            key={video.id} 
            video={video} 
            onTip={handleTip}
            onCommentOpen={handleCommentOpen}
          />
        ))}
      </div>

      <Navigation user={user} onLogout={onLogout} />
      
      {showTipModal && selectedVideo && (
        <TipModal
          video={selectedVideo}
          onClose={() => setShowTipModal(false)}
        />
      )}

      {showComments && selectedVideo && (
        <CommentSection
          video={selectedVideo}
          isOpen={showComments}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  );
};

export default Feed;
