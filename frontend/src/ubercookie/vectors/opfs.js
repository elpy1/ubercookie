// Origin Private File System: a real, persistent, sandboxed filesystem per
// origin (navigator.storage.getDirectory). It's invisible to the normal
// "Local Storage / Cookies" DevTools panels and is one of the stores people are
// least likely to clear by hand. We just keep a one-line file with the id in it.
const FILE_NAME = 'ubercookie.id';

function supported() {
  return typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.getDirectory === 'function';
}

export default {
  id: 'opfs',
  label: 'Origin Private File System',
  kind: 'client',
  jsRequired: true,
  clearable: true,
  blurb:
    'A persistent sandboxed filesystem per origin. It does not show up under the usual ' +
    'cookies/storage panels, so manual clean-ups almost always miss it.',

  async read() {
    if (!supported()) return null;
    try {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(FILE_NAME); // throws if absent
      const file = await handle.getFile();
      const text = (await file.text()).trim();
      return text || null;
    } catch {
      return null;
    }
  },

  async write(value) {
    if (!supported()) return false;
    try {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(FILE_NAME, { create: true });
      const writable = await handle.createWritable();
      await writable.write(value);
      await writable.close();
      return true;
    } catch {
      // Some browsers only allow OPFS writes from a Worker; degrade quietly.
      return false;
    }
  },

  async clear() {
    if (!supported()) return;
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(FILE_NAME);
    } catch {
      /* ignore */
    }
  },
};
