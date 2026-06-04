import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '生成式内容卡片',
  description: '一句话生成发布会风格 Bento Grid 一览图',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {children}
      </body>
    </html>
  );
}
