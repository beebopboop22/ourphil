import dynamic from 'next/dynamic';

const AppRoutes = dynamic(() => import('../src/main.jsx'), {
  ssr: false,
});

export default function CatchAllPage() {
  return <AppRoutes />;
}
