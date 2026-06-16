import './style.css';
import { survey, forget } from './ubercookie/index.js';

const root = document.querySelector('#app');

function renderLoading() {
  root.replaceChildren(document.createTextNode('Reading browser storage...'));
}

function button(label, onClick) {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

async function run() {
  renderLoading();
  const result = await survey();
  root.replaceChildren();
  const main = document.createElement('main');
  const title = document.createElement('h1');
  title.textContent = 'ubercookie';
  const id = document.createElement('code');
  id.textContent = result.id;
  const summary = document.createElement('p');
  summary.textContent = `${result.vectors.filter((v) => v.had || v.respawned).length} of ${result.vectors.length} vectors hold this id.`;
  const list = document.createElement('ul');
  for (const vector of result.vectors) {
    const item = document.createElement('li');
    item.textContent = `${vector.label}: ${vector.before || 'empty'}`;
    list.append(item);
  }
  main.append(title, id, summary, list, button('Re-scan', run), button('Forget me', async () => {
    await forget(result.id);
    await run();
  }));
  root.append(main);
}

run().catch((error) => {
  root.replaceChildren(document.createTextNode(String(error)));
});
