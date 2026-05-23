import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '진로 선택과목 추천 MVP',
  description: '커리어넷 Open API 기반 고등학교 선택과목 추천 MVP'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
