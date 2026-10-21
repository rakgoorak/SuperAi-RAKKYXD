import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

// Copy the runtime dependency closure; workspace links must not escape the app.
export async function stageApp(appRoot, root = process.cwd()) {
  await fs.mkdir(appRoot, { recursive: true });
  const metadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  await fs.writeFile(path.join(appRoot, 'package.json'), JSON.stringify({ name: 'superai-rakkyxd', productName: 'SuperAi & RAKKYXD', version: metadata.version, type: 'module', main: 'bootstrap.mjs' }, null, 2));
  await fs.writeFile(path.join(appRoot, 'bootstrap.mjs'), `await import('./packages/desktop/main.mjs');
`);
  for (const relative of ['packages/desktop', 'packages/studio/dist', 'packages/studio/client/dist']) {
    await fs.cp(path.join(root, relative), path.join(appRoot, relative), {
      recursive: true, filter: source => !/[\\/](test|__pycache__)([\\/]|$)/.test(source) && !source.endsWith('.test.mjs'),
    });
  }
  const modules = path.join(appRoot, 'node_modules'), versions = new Map(), visited = new Set();
  async function packageRoot(name, from) {
    const resolve = createRequire(path.join(from, 'package.json'));
    let entry;
    try { entry = resolve.resolve(`${name}/package.json`); } catch { entry = resolve.resolve(name); }
    let current = path.dirname(entry);
    while (current !== path.dirname(current)) {
      try { const data = JSON.parse(await fs.readFile(path.join(current, 'package.json'), 'utf8')); if (data.name === name) return { directory: current, metadata: data }; } catch {}
      current = path.dirname(current);
    }
    throw new Error(`Cannot locate runtime dependency ${name}`);
  }
  async function include(name, from, parent) {
    const { directory, metadata: data } = await packageRoot(name, from);
    const top = versions.get(name);
    const target = path.join(!top || top === data.version ? modules : path.join(parent, 'node_modules'), name);
    const key = `${target}:${data.version}`;
    if (visited.has(key)) return;
    visited.add(key); if (!top) versions.set(name, data.version);
    await fs.cp(directory, target, { recursive: true, filter: source => !path.relative(directory, source).split(path.sep).some(p => ['node_modules', '__pycache__'].includes(p)) });
    for (const dependency of new Set([...Object.keys(data.dependencies || {}), ...Object.keys(data.optionalDependencies || {})])) {
      try { await include(dependency, directory, target); } catch (error) { if (!(dependency in (data.optionalDependencies || {}))) throw error; }
    }
  }
  for (const name of ['express', 'ws', '@lydell/node-pty', '@opencode-multi/core']) await include(name, root, appRoot);
  return visited.size;
}
