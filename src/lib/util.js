// src/lib/util.js
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const formatUSD = (n) => isFinite(n) ? n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }) : '—';

export function mapRarity(raw) {
  const r = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (['common', 'uncommon', 'rare', 'super rare', 'legendary'].includes(r)) return r;
  if (['enchanted', 'iconic', 'epic'].includes(r)) return 'enchanted';
  return 'common';
}

export function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a,b)=>a-b);
  const m = Math.floor(s.length/2);
  return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
}

export function mean(arr) { 
  return arr.length > 0 ? arr.reduce((a,b)=>a+b,0) / arr.length : 0; 
}

export function trimOutliers(arr, frac = 0.10) {
  if (arr.length < 5 || frac <= 0) return arr.slice().sort((a,b)=>a-b);
  const s = arr.slice().sort((a,b)=>a-b);
  const k = Math.floor(s.length * frac);
  return s.slice(k, s.length - k);
}