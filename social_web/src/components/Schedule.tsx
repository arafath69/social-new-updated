import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, Timestamp, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { PLATFORMS, PlatformType } from '../lib/socialPlatforms';
import { toast } from 'react-hot-toast';

interface ScheduledPost {
  id: string;
  content: string;
  scheduledDate: Timestamp;
  platforms: PlatformType[];
  userId: string;
  status: 'pending' | 'published' | 'failed';
  mediaUrls?: string[];
}

const Schedule = () => {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [content, setContent] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformType[]>([]);
  const [connectedPlatforms, setConnectedPlatforms] = useState<PlatformType[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch connected platforms
    const fetchConnectedPlatforms = async () => {
      const platformsDoc = await getDocs(query(
        collection(db, 'userPlatforms'),
        where('userId', '==', auth.currentUser!.uid)
      ));
      
      if (!platformsDoc.empty) {
        const platforms = platformsDoc.docs[0].data();
        setConnectedPlatforms(Object.keys(platforms) as PlatformType[]);
      }
    };

    fetchConnectedPlatforms();

    // Subscribe to scheduled posts
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'scheduledPosts'),
        where('userId', '==', auth.currentUser.uid)
      ),
      (snapshot) => {
        const updatedPosts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ScheduledPost[];
        
        setPosts(updatedPosts.sort((a, b) => 
          a.scheduledDate.toMillis() - b.scheduledDate.toMillis()
        ));
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    if (selectedPlatforms.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }

    setIsSubmitting(true);
    const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    
    try {
      // In a production environment, we would upload media files to storage
      // and get their URLs here
      const mediaUrls: string[] = [];

      await addDoc(collection(db, 'scheduledPosts'), {
        content,
        scheduledDate: Timestamp.fromDate(dateTime),
        platforms: selectedPlatforms,
        userId: auth.currentUser.uid,
        status: 'pending',
        createdAt: Timestamp.now(),
        mediaUrls
      });

      setContent('');
      setScheduledDate('');
      setScheduledTime('');
      setSelectedPlatforms([]);
      setMediaFiles([]);
      toast.success('Post scheduled successfully');
    } catch (error) {
      console.error('Error scheduling post:', error);
      toast.error('Failed to schedule post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: ScheduledPost['status']) => {
    switch (status) {
      case 'published':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Schedule Posts</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-6">Create New Post</h2>
          {connectedPlatforms.length === 0 && (
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                <p className="text-sm text-yellow-700">
                  No social media accounts connected. Please connect your accounts in the Settings page.
                </p>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Write your post content..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Date
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Time
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platforms
              </label>
              <div className="flex flex-wrap gap-4">
                {Object.entries(PLATFORMS).map(([id, { name, icon: Icon, color }]) => {
                  const isConnected = connectedPlatforms.includes(id as PlatformType);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedPlatforms(prev => 
                        prev.includes(id as PlatformType)
                          ? prev.filter(p => p !== id)
                          : [...prev, id as PlatformType]
                      )}
                      disabled={!isConnected}
                      className={`flex items-center px-4 py-2 rounded-lg border transition-colors ${
                        !isConnected
                          ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                          : selectedPlatforms.includes(id as PlatformType)
                            ? 'border-transparent text-white'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                      style={{
                        backgroundColor: selectedPlatforms.includes(id as PlatformType) ? color : undefined
                      }}
                    >
                      <Icon className="w-5 h-5 mr-2" />
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || selectedPlatforms.length === 0}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Scheduling...' : 'Schedule Post'}
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-6">Scheduled Posts</h2>
          <div className="space-y-4">
            {posts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No posts scheduled yet</p>
            ) : (
              posts.map(post => (
                <div
                  key={post.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {post.platforms.map(platform => {
                        const PlatformIcon = PLATFORMS[platform].icon;
                        return (
                          <div
                            key={platform}
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: `${PLATFORMS[platform].color}20` }}
                          >
                            <PlatformIcon
                              className="w-4 h-4"
                              style={{ color: PLATFORMS[platform].color }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
                      {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 mb-2">{post.content}</p>
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-1" />
                    {format(post.scheduledDate.toDate(), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schedule;