/**
 * StockSense — API client wrapper
 * Injects JWT Authorization header on every request.
 */

const API = (() => {
  const BASE = '/api';

  function getToken() {
    return localStorage.getItem('ss_token');
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('ss_user') || 'null');
    } catch { return null; }
  }

  function saveSession(token, user) {
    localStorage.setItem('ss_token', token);
    localStorage.setItem('ss_user', JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem('ss_token');
    localStorage.removeItem('ss_user');
  }

  function isLoggedIn() {
    return !!getToken();
  }

  async function request(method, path, body) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, opts);

    if (res.status === 401) {
      // Token expired or invalid
      clearSession();
      window.location.href = '/login.html';
      throw new Error('Session expired');
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return data;
  }

  const get    = (path)        => request('GET',    path);
  const post   = (path, body)  => request('POST',   path, body);
  const put    = (path, body)  => request('PUT',    path, body);
  const del    = (path)        => request('DELETE', path);

  return { get, post, put, del, getToken, getUser, saveSession, clearSession, isLoggedIn };
})();
