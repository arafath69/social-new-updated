import { auth, db } from './firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { PlatformType, PLATFORMS } from './socialPlatforms';

interface PlatformCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  platformUserId: string;
  username: string;
}

const OAUTH_CONFIG = {
  instagram: {
    clientId: import.meta.env.VITE_INSTAGRAM_CLIENT_ID,
    clientSecret: import.meta.env.VITE_INSTAGRAM_CLIENT_SECRET,
    redirectUri: `${window.location.origin}/auth/instagram/callback`,
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scope: ['basic', 'create_content', 'read_insights'].join(' ')
  },
  facebook: {
    clientId: import.meta.env.VITE_FACEBOOK_CLIENT_ID,
    clientSecret: import.meta.env.VITE_FACEBOOK_CLIENT_SECRET,
    redirectUri: `${window.location.origin}/auth/facebook/callback`,
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scope: ['pages_manage_posts', 'pages_read_engagement'].join(',')
  },
  twitter: {
    clientId: import.meta.env.VITE_TWITTER_CLIENT_ID,
    clientSecret: import.meta.env.VITE_TWITTER_CLIENT_SECRET,
    redirectUri: `${window.location.origin}/auth/twitter/callback`,
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scope: ['tweet.read', 'tweet.write', 'users.read'].join(' ')
  }
};

export async function connectPlatform(platform: PlatformType): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');

  const config = OAUTH_CONFIG[platform];
  if (!config) throw new Error(`Platform ${platform} not supported`);

  // Check if we have valid credentials
  if (!config.clientId || !config.clientSecret) {
    throw new Error(`Missing credentials for ${platform}. Please check your environment variables.`);
  }

  // Store the platform being connected in session storage for the callback
  sessionStorage.setItem('connecting_platform', platform);

  // Generate and store state parameter for security
  const state = Math.random().toString(36).substring(7);
  sessionStorage.setItem('oauth_state', state);

  // Build the authorization URL
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scope,
    state: state
  });

  // Redirect to the platform's authorization page
  window.location.href = `${config.authUrl}?${params.toString()}`;
}

export async function handleOAuthCallback(platform: PlatformType, code: string, state: string): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');

  // Verify state parameter
  const storedState = sessionStorage.getItem('oauth_state');
  if (state !== storedState) {
    throw new Error('Invalid state parameter');
  }

  const config = OAUTH_CONFIG[platform];
  if (!config) throw new Error(`Platform ${platform} not supported`);

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(`Failed to get access token: ${errorData.error_description || errorData.error || 'Unknown error'}`);
    }

    const tokenData = await tokenResponse.json();

    // Get user info from the platform
    const userInfo = await fetchPlatformUserInfo(platform, tokenData.access_token);

    const credentials: PlatformCredentials = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
      platformUserId: userInfo.id,
      username: userInfo.username
    };

    // Store credentials in Firestore
    const userPlatformsRef = doc(db, 'userPlatforms', auth.currentUser.uid);
    await setDoc(userPlatformsRef, {
      [platform]: credentials
    }, { merge: true });

    // Update user settings to reflect connected account
    const userSettingsRef = doc(db, 'userSettings', auth.currentUser.uid);
    const settingsDoc = await getDoc(userSettingsRef);
    const settings = settingsDoc.data() || {};

    await updateDoc(userSettingsRef, {
      accounts: settings.accounts?.map((account: any) => 
        account.platform === platform
          ? { ...account, connected: true, username: userInfo.username }
          : account
      ) || []
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    throw error;
  } finally {
    // Clean up session storage
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('connecting_platform');
  }
}

async function fetchPlatformUserInfo(platform: PlatformType, accessToken: string) {
  const endpoints = {
    instagram: 'https://graph.instagram.com/me?fields=id,username',
    facebook: 'https://graph.facebook.com/me?fields=id,name',
    twitter: 'https://api.twitter.com/2/users/me'
  };

  const response = await fetch(endpoints[platform], {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  return response.json();
}

export async function disconnectPlatform(platform: PlatformType): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');

  try {
    // Get current platform credentials
    const userPlatformsRef = doc(db, 'userPlatforms', auth.currentUser.uid);
    const platformsDoc = await getDoc(userPlatformsRef);
    const platformData = platformsDoc.data()?.[platform];

    if (platformData) {
      // Revoke access token with the platform
      await revokePlatformAccess(platform, platformData.accessToken);
    }

    // Remove platform credentials from Firestore
    const currentData = platformsDoc.data() || {};
    delete currentData[platform];
    await setDoc(userPlatformsRef, currentData);

    // Update user settings to reflect disconnected account
    const userSettingsRef = doc(db, 'userSettings', auth.currentUser.uid);
    const settingsDoc = await getDoc(userSettingsRef);
    const settings = settingsDoc.data() || {};

    await updateDoc(userSettingsRef, {
      accounts: settings.accounts?.map((account: any) => 
        account.platform === platform
          ? { ...account, connected: false, username: '' }
          : account
      ) || []
    });

  } catch (error) {
    console.error('Platform disconnection error:', error);
    throw error;
  }
}

async function revokePlatformAccess(platform: PlatformType, accessToken: string) {
  const revokeEndpoints = {
    instagram: 'https://graph.instagram.com/access_token/revoke',
    facebook: 'https://graph.facebook.com/v18.0/me/permissions',
    twitter: 'https://api.twitter.com/2/oauth2/revoke'
  };

  await fetch(revokeEndpoints[platform], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      token: accessToken
    })
  });
}