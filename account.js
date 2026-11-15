(() => {
  const root = document.querySelector('#app');
  const accountId = root?.dataset.accountId || '';
  const accountName = root?.dataset.accountName || root?.dataset.accountEmail || 'Мастер';
  const accountEmail = root?.dataset.accountEmail || '';
  const originalSet = Storage.prototype.setItem;
  const originalRemove = Storage.prototype.removeItem;
  let ready = false;
  let timer = 0;
  const knownToys = new Map();
  const setLocal = (key, value) => originalSet.call(localStorage, key, JSON.stringify(value));

  window.DYMKA_READY = (async () => {
    if (accountId) {
      try {
        const response = await fetch('/api/account', { cache: 'no-store', credentials: 'same-origin' });
        if (!response.ok) throw new Error('Не удалось загрузить аккаунт');
        const data = await response.json();
        (data.toys || []).forEach(toy => knownToys.set(toy.id, JSON.stringify(toy)));
        setLocal('dymka-profile', { ...(data.profile || {}), name: data.profile?.name || data.name || accountName, toy: data.profile?.toy || 'lady.png', code: '', accountId, guest: false });
        setLocal('dymka-toys', data.toys || []);
        setLocal('dymka-favorites', data.favorites || []);
        window.DYMKA_ACCOUNT = { authenticated: true, id: accountId, name: data.name || accountName, email: data.email || accountEmail, guest: false, deviceId: null, syncError: '' };
        ready = true;
        if (!data.initialized) await send({ profile: JSON.parse(localStorage.getItem('dymka-profile')), favorites: [] });
        return window.DYMKA_ACCOUNT;
      } catch (error) {
        window.DYMKA_ACCOUNT = { authenticated: true, id: accountId, name: accountName, email: accountEmail, guest: false, deviceId: null, syncError: 'Не удалось подключить профиль. Обнови страницу, чтобы повторить.' };
        window.DYMKA_CLOUD_ERROR = true;
        ready = true;
        return window.DYMKA_ACCOUNT;
      }
    }

    let deviceId = localStorage.getItem('dymka-device-id');
    if (!deviceId) {
      deviceId = crypto.randomUUID ? crypto.randomUUID() : 'guest-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      originalSet.call(localStorage, 'dymka-device-id', deviceId);
    }
    const cachedProfile = JSON.parse(localStorage.getItem('dymka-profile') || 'null');
    if (cachedProfile?.accountId) {
      setLocal('dymka-profile', { name: 'Гость', toy: 'lady.png', guest: true, deviceId });
      setLocal('dymka-toys', []);
      setLocal('dymka-favorites', []);
    }
    window.DYMKA_ACCOUNT = { authenticated: false, id: deviceId, name: '', email: '', guest: true, deviceId, syncError: '' };
    ready = true;
    return window.DYMKA_ACCOUNT;
  })();

  Storage.prototype.setItem = function (key, value) {
    originalSet.call(this, key, value);
    if (this === localStorage && ready && window.DYMKA_ACCOUNT?.authenticated && ['dymka-profile', 'dymka-favorites', 'dymka-toys'].includes(key)) scheduleSync();
  };
  Storage.prototype.removeItem = function (key) {
    originalRemove.call(this, key);
    if (this === localStorage && ready && window.DYMKA_ACCOUNT?.authenticated && key === 'dymka-toys') scheduleSync();
  };

  function scheduleSync() {
    clearTimeout(timer);
    timer = setTimeout(syncNow, 650);
  }
  async function send(body) {
    const response = await fetch('/api/account', {
      method: 'PUT', credentials: 'same-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Не удалось сохранить данные');
    return data;
  }
  async function syncNow() {
    if (!window.DYMKA_ACCOUNT?.authenticated) return;
    try {
      const profile = JSON.parse(localStorage.getItem('dymka-profile') || '{}');
      const favorites = JSON.parse(localStorage.getItem('dymka-favorites') || '[]');
      await send({ profile: { name: profile.name, toy: profile.toy }, favorites });
      const toys = JSON.parse(localStorage.getItem('dymka-toys') || '[]');
      for (const toy of toys) {
        const serialized = JSON.stringify(toy);
        if (knownToys.get(toy.id) === serialized) continue;
        await send({ toy });
        knownToys.set(toy.id, serialized);
      }
      window.DYMKA_ACCOUNT.syncError = '';
      window.dispatchEvent(new CustomEvent('dymka-sync-state', { detail: { ok: true } }));
    } catch (error) {
      window.DYMKA_ACCOUNT.syncError = error instanceof Error ? error.message : 'Синхронизация не удалась';
      window.dispatchEvent(new CustomEvent('dymka-sync-state', { detail: { ok: false, message: window.DYMKA_ACCOUNT.syncError } }));
    }
  }
  window.DYMKA_SYNC_NOW = syncNow;
})();
