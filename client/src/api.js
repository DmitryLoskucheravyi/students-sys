import { useCallback, useEffect, useRef, useState } from 'react';

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Немає зв’язку із сервером');
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('zoshyt:logout'));
  if (!res.ok) throw new Error(data?.error ?? 'Не вдалося виконати дію');
  return data;
}

/** Надсилає форму з файлами і повідомляє прогрес від 0 до 1. */
export function uploadForm(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
      else reject(new Error(xhr.response?.error ?? 'Не вдалося завантажити файли'));
    };
    xhr.onerror = () => reject(new Error('Немає зв’язку із сервером'));
    xhr.send(formData);
  });
}

export function useData(path) {
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: null });
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!path) return;
    const ticket = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(path);
      if (ticket === latest.current) setState({ data, loadedPath: path, loading: false, error: null });
    } catch (e) {
      if (ticket === latest.current) setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload, setData: (data) => setState((s) => ({ ...s, data })) };
}
