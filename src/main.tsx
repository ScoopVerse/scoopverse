import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ShopPage } from './components/ShopPage';
import './index.css';

// The admin code (with the text editor) is only downloaded by people who open /admin.
const AdminApp = lazy(() => import('./components/admin/AdminApp').then((m) => ({ default: m.AdminApp })));

const path = window.location.pathname.replace(/\/+$/, '');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {path === '/admin' ? (
      <Suspense fallback={<div className="min-h-screen bg-[#fdf9f3]" />}>
        <AdminApp />
      </Suspense>
    ) : path === '/shop' ? (
      <ShopPage />
    ) : (
      <App />
    )}
  </StrictMode>,
);
