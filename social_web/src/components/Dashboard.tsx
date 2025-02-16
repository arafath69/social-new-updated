import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { PlusCircle, Instagram, Twitter, Facebook, Calendar, BarChart } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

interface ScheduledPost {
  id: string;
  content: string;
  scheduledDate: Timestamp;
  platforms: string[];
  status: 'pending' | 'published';
}

interface Analytics {
  platform: string;
  likes: number;
  shares: number;
  comments: number;
}

const Dashboard = () => {
  const [upcomingPosts, setUpcomingPosts] = useState<ScheduledPost[]>([]);
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<string[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch upcoming posts with a simpler query first
    const postsQuery = query(
      collection(db, 'scheduledPosts'),
      where('userId', '==', auth.currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScheduledPost[];
      
      // Sort posts in memory instead of using orderBy
      const sortedPosts = posts.sort((a, b) => 
        a.scheduledDate.toMillis() - b.scheduledDate.toMillis()
      ).slice(0, 5);
      
      setUpcomingPosts(sortedPosts);
    });

    // Fetch analytics with a simpler query
    const analyticsQuery = query(
      collection(db, 'postAnalytics'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribeAnalytics = onSnapshot(analyticsQuery, (snapshot) => {
      const analyticsData = snapshot.docs.map(doc => doc.data()) as Analytics[];
      setAnalytics(analyticsData);
    });

    // Fetch connected accounts
    const settingsQuery = query(
      collection(db, 'userSettings'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribeSettings = onSnapshot(settingsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const accounts = snapshot.docs[0].data().accounts || [];
        setConnectedAccounts(accounts.filter((acc: any) => acc.connected).map((acc: any) => acc.platform));
      }
    });

    return () => {
      unsubscribePosts();
      unsubscribeAnalytics();
      unsubscribeSettings();
    };
  }, []);

  const platformIcons = {
    instagram: Instagram,
    twitter: Twitter,
    facebook: Facebook
  };

  const getTotalEngagement = () => {
    return analytics.reduce((sum, item) => sum + item.likes + item.comments + item.shares, 0);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          to="/schedule"
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Create Post
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Connected Accounts */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Connected Accounts</h2>
          <div className="space-y-4">
            {connectedAccounts.length === 0 ? (
              <div className="flex items-center text-gray-600">
                <span className="ml-2">No accounts connected yet</span>
              </div>
            ) : (
              connectedAccounts.map(platform => {
                const Icon = platformIcons[platform as keyof typeof platformIcons];
                return (
                  <div key={platform} className="flex items-center text-gray-700">
                    <Icon className="w-5 h-5 mr-2" />
                    <span className="capitalize">{platform}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Upcoming Posts */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Upcoming Posts</h2>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {upcomingPosts.length === 0 ? (
              <p className="text-gray-600">No scheduled posts yet</p>
            ) : (
              upcomingPosts.map(post => (
                <div key={post.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 mr-4">
                    <p className="text-sm text-gray-900 truncate">{post.content}</p>
                    <div className="flex items-center mt-1">
                      {post.platforms.map(platform => {
                        const Icon = platformIcons[platform as keyof typeof platformIcons];
                        return <Icon key={platform} className="w-4 h-4 text-gray-500 mr-1" />;
                      })}
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">
                    {format(post.scheduledDate.toDate(), 'MMM d, h:mm a')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Quick Stats</h2>
            <BarChart className="w-5 h-5 text-gray-400" />
          </div>
          {analytics.length === 0 ? (
            <p className="text-gray-600">Connect your accounts to see stats</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Total Engagement</p>
                <p className="text-2xl font-bold text-gray-900">{getTotalEngagement().toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Scheduled Posts</p>
                <p className="text-2xl font-bold text-gray-900">{upcomingPosts.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Connected Platforms</p>
                <p className="text-2xl font-bold text-gray-900">{connectedAccounts.length}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;