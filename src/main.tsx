import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AdminApp } from './components/admin/AdminApp';
import { ShopPage } from './components/ShopPage';
import './index.css';

const path = window.location.pathname.replace(/\/+$/, '');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {path === '/admin' ? <AdminApp /> : path === '/shop' ? <ShopPage /> : <App />}
  </StrictMode>,
);
