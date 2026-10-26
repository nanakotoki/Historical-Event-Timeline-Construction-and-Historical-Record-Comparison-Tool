import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export const metadata: Metadata = {
  title: '华夏史网 ChronoGraph China · 二十四史人物关系图谱',
  description:
    '以《史记》《汉书》《三国志》《晋书》《旧唐书》《新唐书》等二十四部正史为数据根基的华夏历史人物关系图谱与史料对勘引擎。支持六度分隔寻路、时序关系演变、四级画像考据与「罗生门」多源史料比读。',
  keywords: ['二十四史', '历史人物关系图谱', '数字人文', '史料对勘', 'CBDB', '中国历史'],
  authors: [{ name: 'ChronoGraph China' }],
  applicationName: '华夏史网',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F3EB' },
    { media: '(prefers-color-scheme: dark)', color: '#111318' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

/** 首帧前置注入主题，避免宣纸/玄墨切换时的白闪（FOUC） */
const themeBootstrap = `(function(){try{var t=localStorage.getItem('chronograph-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
