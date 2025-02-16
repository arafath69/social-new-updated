import { Instagram, Twitter, Facebook } from 'lucide-react';

export const PLATFORMS = {
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    scopes: ['basic', 'create_content', 'read_insights'],
    color: '#E1306C'
  },
  twitter: {
    name: 'Twitter',
    icon: Twitter,
    scopes: ['tweet.read', 'tweet.write', 'users.read'],
    color: '#1DA1F2'
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    scopes: ['pages_manage_posts', 'pages_read_engagement'],
    color: '#4267B2'
  }
} as const;

export type PlatformType = keyof typeof PLATFORMS;