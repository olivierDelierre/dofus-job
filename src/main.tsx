import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Brume : petit « pop » des boutons au clic (coupé par prefers-reduced-motion dans le CSS).
document.addEventListener('click', (e) => {
  const btn = (e.target as Element | null)?.closest?.('.br-btn, .icon-btn');
  if (!(btn instanceof HTMLElement) || btn.matches(':disabled')) return;
  btn.classList.remove('is-pop');
  void btn.offsetWidth;
  btn.classList.add('is-pop');
});
document.addEventListener('animationend', (e) => {
  if (e.animationName === 'br-pop') (e.target as Element).classList.remove('is-pop');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
