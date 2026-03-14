import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import RegistrarPage from './components/Registrar/RegistrarPage';
import './index.css';

const isRegistrar = window.location.pathname.startsWith('/registrar/');

ReactDOM.createRoot(document.getElementById('root')).render(
  isRegistrar ? <RegistrarPage /> : <App />
);
