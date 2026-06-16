// Service Worker vector. A background script (see public/sw.js) stores the id in
// its own Cache Storage and can re-serve it even offline. We communicate with it
// over postMessage + a MessageChannel, which works as soon as the worker is
// active — no need for it to "control" this particular page load.

let registrationPromise = null;

function supported() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

function ensureRegistered() {
  if (!supported()) return Promise.resolve(null);
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready) // resolves once a worker is active
      .catch(() => null);
  }
  return registrationPromise;
}

async function activeWorker() {
  const reg = await ensureRegistered();
  return reg ? reg.active : null;
}

function request(worker, message, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel.port1.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    channel.port1.onmessage = (event) => {
      finish(event.data || null);
    };
    worker.postMessage(message, [channel.port2]);
  });
}

export default {
  id: 'serviceWorker',
  label: 'Service Worker + Cache',
  kind: 'client',
  jsRequired: true,
  clearable: true,
  blurb:
    'A background script that keeps the id in its own cache and can re-serve it even offline — ' +
    'a persistence layer that runs independently of the page.',

  async read() {
    const worker = await activeWorker();
    if (!worker) return null;
    const reply = await request(worker, { type: 'gc-get' });
    return reply && reply.id ? reply.id : null;
  },

  async write(value) {
    const worker = await activeWorker();
    if (!worker) return false;
    const reply = await request(worker, { type: 'gc-set', id: value });
    return Boolean(reply && reply.ok);
  },

  async clear() {
    const worker = await activeWorker();
    if (!worker) return false;
    const reply = await request(worker, { type: 'gc-clear' });
    return Boolean(reply && reply.ok);
  },
};
