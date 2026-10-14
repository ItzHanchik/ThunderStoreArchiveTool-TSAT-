const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { publishPackage, validateMetadata } = require('./publish.cjs');
const MAX = 200 * 1024 * 1024;
let window;
let publishing = false;
app.setName('TSAT');
// Portable projects stay next to the executable. DPAPI secrets remain bound to this Windows user.
if (process.env.PORTABLE_EXECUTABLE_DIR) app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'TSAT-data'));
const tokenPath = () => path.join(app.getPath('userData'), 'team-token.enc');
function encryptionAvailable() { return safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'); }
function bytesFrom(value) { if (!(value instanceof Uint8Array) || value.length < 4 || value.length > MAX || value[0] !== 80 || value[1] !== 75) throw new Error('Некорректный ZIP или превышен лимит 200 МБ.'); return Buffer.from(value); }
function register(channel, handler) { ipcMain.handle(channel, async (event, ...args) => { if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Недоверенный источник.'); return handler(...args); }); }
register('external:open', async value => { if (typeof value !== 'string' || value.length > 4096) throw new Error('Некорректная ссылка.'); const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Можно открывать только веб-ссылки.'); await shell.openExternal(url.href); });
register('archive:save', async (value, filename) => { const bytes = bytesFrom(value); if (typeof filename !== 'string' || !/^[A-Za-z0-9_]{1,128}-\d+\.\d+\.\d+\.zip$/.test(filename)) throw new Error('Некорректное имя архива.'); const result = await dialog.showSaveDialog(window, { title: 'Сохранить архив мода', defaultPath: filename, filters: [{ name: 'ZIP archive', extensions: ['zip'] }] }); if (result.canceled || !result.filePath) return false; await fs.writeFile(result.filePath, bytes); return true; });
register('token:status', async () => ({ available: encryptionAvailable(), saved: await fs.access(tokenPath()).then(() => true).catch(() => false) }));
register('token:save', async value => { if (!encryptionAvailable()) throw new Error('Системное шифрование недоступно. Токен не сохранён.'); if (typeof value !== 'string' || !/^[\x21-\x7e]{16,4096}$/.test(value.trim())) throw new Error('Проверьте формат токена.'); const file = tokenPath(); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file + '.tmp', safeStorage.encryptString(value.trim()), { mode: 0o600 }); await fs.rename(file + '.tmp', file); });
register('token:delete', async () => { await fs.rm(tokenPath(), { force: true }); });
register('package:publish', async (value, metadata) => {
  if (publishing) throw new Error('Другая публикация уже выполняется.');
  const bytes = bytesFrom(value); validateMetadata(metadata);
  if (!encryptionAvailable()) throw new Error('Защищённое хранилище недоступно.');
  publishing = true;
  try {
    const confirmation = await dialog.showMessageBox(window, { type: 'question', title: 'Опубликовать в Thunderstore?', message: `${metadata.filename}\nКоманда: ${metadata.team}\nСообщество: ${metadata.community}`, detail: 'Архив будет отправлен в Thunderstore. Это не локальная сборка. Убедитесь, что файлы не содержат секретов.', buttons: ['Отмена', 'Опубликовать'], defaultId: 0, cancelId: 0, noLink: true });
    if (confirmation.response !== 1) throw new Error('Публикация отменена.');
    let token;
    try { token = safeStorage.decryptString(await fs.readFile(tokenPath())); } catch { throw new Error('Подключите токен заново: он отсутствует или создан другим пользователем Windows.'); }
    return await publishPackage(bytes, metadata, token);
  } finally { publishing = false; }
});
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  function createWindow() {
    window = new BrowserWindow({ width: 1440, height: 960, minWidth: 880, minHeight: 650, title: 'TSAT — Mod workspace', backgroundColor: '#f6f7f9', icon: path.join(__dirname, '../dist/icon.png'), autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.loadFile(path.join(__dirname, '../dist/index.html'));
    window.on('close', event => { if (publishing) { event.preventDefault(); dialog.showMessageBox(window, { type: 'info', message: 'Дождитесь завершения публикации, чтобы не потерять её статус.' }); } });
  }
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
