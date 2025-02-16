import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { BarChart, LineChart, PieChart } from 'lucide-react';

interface PostAnalytics {
  id: string;
  platform: string;
  likes: number;
  shares: number;
  comments: number;
  reach: number;
  date: Date;
}

const Analytics = () => {
  const [analytics, setAnalytics] = useState<PostAnalytics[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'postAnalytics'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const analyticsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate()
      })) as PostAnalytics[];

      setAnalytics(analyticsData);
    });

    return () => unsubscribe();
  }, []);

  const platforms = ['Instagram', 'Twitter', 'Facebook'];
  const metrics = [
    { label: 'Total Reach', value: analytics.reduce((sum, item) => sum + item.reach, 0) },
    { label: 'Total Engagement', value: analytics.reduce((sum, item) => sum + item.likes + item.comments + item.shares, 0) },
    { label: 'Average Likes', value: Math.round(analytics.reduce((sum, item) => sum + item.likes, 0) / analytics.length || 0) }
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">{metric.label}</h3>
            <p className="text-2xl font-bold text-gray-900">{metric.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Platform Performance</h2>
            <BarChart className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {platforms.map(platform => {
              const platformData = analytics.filter(item => item.platform === platform.toLowerCase());
              const totalReach = platformData.reduce((sum, item) => sum + item.reach, 0);
              const totalEngagement = platformData.reduce((sum, item) => sum + item.likes + item.comments + item.shares, 0);
              
              return (
                <div key={platform} className="relative pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-900">{platform}</div>
                    <div className="text-sm font-medium text-gray-500">
                      {totalEngagement.toLocaleString()} engagements
                    </div>
                  </div>
                  <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-100">
                    <div
                      style={{ width: `${(totalEngagement / totalReach * 100) || 0}%` }}
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <LineChart className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {analytics.slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-900">
                    {item.platform.charAt(0).toUpperCase() + item.platform.slice(1)}
                  </span>
                  <span className="mx-2 text-gray-300">•</span>
                  <span className="text-sm text-gray-500">
                    {new Date(item.date).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{item.likes} likes</span>
                  <span>{item.comments} comments</span>
                  <span>{item.shares} shares</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;