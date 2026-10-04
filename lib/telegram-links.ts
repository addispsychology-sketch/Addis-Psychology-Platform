const platformRoutes = /^\/(?:account|appointments|therapists|register|portal|chat|packages|schedule|wallet|admin)(?:[/?]|$)/;

function safePath(path: string) {
  if ((path === '/' || platformRoutes.test(path)) && !/[\\#\r\n]/.test(path)) return path;
  throw new Error('Unsupported platform destination.');
}

function encodePath(path: string) {
  const bytes = new TextEncoder().encode(path);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Channel URLs launch the Mini App in the current chat, without opening a bot conversation.
export function miniAppLink(username: string | undefined, path: string, appName?: string) {
  safePath(path);
  if (!username || !/^[a-zA-Z0-9_]{5,32}$/.test(username)) throw new Error('Configure your Telegram bot username before publishing.');
  if (appName && !/^[a-zA-Z0-9_]{1,64}$/.test(appName)) throw new Error('Configure a valid Telegram Mini App short name.');
  const value = encodePath(path);
  if (value.length > 512) throw new Error('This Mini App destination is too long.');
  return `https://t.me/${username}${appName ? '/' + appName : ''}?startapp=${value}`;
}

export function miniAppPath(value: string) {
  if (!/^[a-zA-Z0-9_-]{1,512}$/.test(value)) return null;
  try {
    const bytes = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const path = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
    if (encodePath(path) !== value) return null;
    return safePath(path);
  } catch { return null; }
}
