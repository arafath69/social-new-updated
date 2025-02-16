import React, { useState, useEffect } from 'react';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Save } from 'lucide-react';
import { PLATFORMS, PlatformType } from '../lib/socialPlatforms';
import { connectPlatform, disconnectPlatform } from '../lib/platformAuth';
import { toast } from 'react-hot-toast';

interface SocialAccount {
  platform: PlatformType;
  username: string;
  connected: boolean;
}

interface UserSettings {
  timezone: string;
  accounts: SocialAccount[];
  notifications: {
    email: boolean;
    push: boolean;
  };
}

const Settings = () => {
  const [settings, setSettings] = useState<UserSettings>({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    accounts: Object.keys(PLATFORMS).map(platform => ({
      platform: platform as PlatformType,
      username: '',
      connected: false
    })),
    notifications: {
      email: true,
      push: true
    }
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(
      doc(db, 'userSettings', auth.currentUser.uid),
      (doc) => {
        if (doc.exists()) {
          setSettings(doc.data() as UserSettings);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  const handlePlatformConnection = async (platform: PlatformType, isConnected: boolean) => {
    if (!auth.currentUser) return;

    setLoading(prev => ({ ...prev, [platform]: true }));
    try {
      if (isConnected) {
        await disconnectPlatform(platform);
        toast.success(`Disconnected from ${PLATFORMS[platform].name}`);
      } else {
        await connectPlatform(platform);
        toast.success(`Connected to ${PLATFORMS[platform].name}`);
      }
    } catch (error) {
      console.error('Platform connection error:', error);
      toast.error(`Failed to ${isConnected ? 'disconnect from' : 'connect to'} ${PLATFORMS[platform].name}`);
    } finally {
      setLoading(prev => ({ ...prev, [platform]: false }));
    }
  };

  const handleSaveSettings = async () => {
    if (!auth.currentUser) return;

    try {
      await setDoc(doc(db, 'userSettings', auth.currentUser.uid), settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <button
          onClick={handleSaveSettings}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Save className="w-5 h-5 mr-2" />
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Social Media Accounts</h2>
          <div className="space-y-4">
            {settings.accounts.map((account) => {
              const platform = PLATFORMS[account.platform];
              const Icon = platform.icon;
              return (
                <div key={account.platform} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${platform.color}20` }}>
                      <Icon className="w-6 h-6" style={{ color: platform.color }} />
                    </div>
                    <div className="ml-4">
                      <h3 className="font-medium text-gray-900">
                        {platform.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {account.connected ? account.username : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePlatformConnection(account.platform, account.connected)}
                    disabled={loading[account.platform]}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      account.connected
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : `text-white hover:opacity-90`
                    }`}
                    style={{ backgroundColor: account.connected ? undefined : platform.color }}
                  >
                    {loading[account.platform] ? 'Processing...' : account.connected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Preferences</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timezone
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {Intl.supportedValuesOf('timeZone').map(zone => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Notifications</h3>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifications.email}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        email: e.target.checked
                      }
                    }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">Email notifications for scheduled posts</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifications.push}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        push: e.target.checked
                      }
                    }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">Push notifications for post performance</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;