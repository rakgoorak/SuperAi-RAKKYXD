import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildFileTree,
  filterTree,
  getFileCategory,
  type TreeNode,
} from '../client/src/fileTree.js';
import { listProjectFiles } from '../server/ProjectFiles.js';
import { saveProjectFile } from '../server/ProjectChanges.js';
import { readPreviewFile } from '../server/PreviewFiles.js';

test('buildFileTree constructs a sorted hierarchical tree with pinned state', () => {
  const files = [
    'src/components/Button.tsx',
    'src/index.ts',
    'package.json',
    'README.md',
    'assets\\logo.png',
  ];
  const pinnedSet = new Set(['src/index.ts', 'README.md']);

  const tree = buildFileTree(files, pinnedSet);

  // Top level: directories first (assets, src), then files (package.json, README.md)
  assert.equal(tree.length, 4);

  assert.equal(tree[0].name, 'assets');
  assert.equal(tree[0].isDirectory, true);
  assert.equal(tree[0].children?.length, 1);
  assert.equal(tree[0].children?.[0].name, 'logo.png');
  assert.equal(tree[0].children?.[0].path, 'assets/logo.png');
  assert.equal(tree[0].children?.[0].isPinned, false);

  assert.equal(tree[1].name, 'src');
  assert.equal(tree[1].isDirectory, true);
  // Inside src: components/ (dir) first, then index.ts
  assert.equal(tree[1].children?.length, 2);
  assert.equal(tree[1].children?.[0].name, 'components');
  assert.equal(tree[1].children?.[0].isDirectory, true);
  assert.equal(tree[1].children?.[0].children?.[0].name, 'Button.tsx');

  assert.equal(tree[1].children?.[1].name, 'index.ts');
  assert.equal(tree[1].children?.[1].isDirectory, false);
  assert.equal(tree[1].children?.[1].isPinned, true);

  assert.equal(tree[2].name, 'package.json');
  assert.equal(tree[2].isDirectory, false);
  assert.equal(tree[2].isPinned, false);

  assert.equal(tree[3].name, 'README.md');
  assert.equal(tree[3].isDirectory, false);
  assert.equal(tree[3].isPinned, true);
});

test('filterTree filters nodes in real time and collects matching dirs for auto-expansion', () => {
  const files = [
    'src/components/Button.tsx',
    'src/components/Header.tsx',
    'src/utils/helpers.ts',
    'package.json',
  ];
  const tree = buildFileTree(files, new Set());

  // Search "button"
  const { filtered, matchingDirs } = filterTree(tree, 'button');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'src');
  assert.equal(matchingDirs.has('src'), true);
  assert.equal(matchingDirs.has('src/components'), true);

  const srcChildren = filtered[0].children!;
  assert.equal(srcChildren.length, 1);
  assert.equal(srcChildren[0].name, 'components');
  assert.equal(srcChildren[0].children?.length, 1);
  assert.equal(srcChildren[0].children?.[0].name, 'Button.tsx');

  // Search non-existent
  const noMatch = filterTree(tree, 'xyz123');
  assert.equal(noMatch.filtered.length, 0);
  assert.equal(noMatch.matchingDirs.size, 0);

  // Empty query returns original tree unmodified
  const emptyFilter = filterTree(tree, '');
  assert.equal(emptyFilter.filtered, tree);
  assert.equal(emptyFilter.matchingDirs.size, 0);
});

test('getFileCategory identifies code, image, and text extensions', () => {
  assert.equal(getFileCategory('index.ts'), 'code');
  assert.equal(getFileCategory('app.tsx'), 'code');
  assert.equal(getFileCategory('config.json'), 'code');
  assert.equal(getFileCategory('script.py'), 'code');
  assert.equal(getFileCategory('banner.png'), 'image');
  assert.equal(getFileCategory('icon.svg'), 'image');
  assert.equal(getFileCategory('notes.txt'), 'text');
  assert.equal(getFileCategory('DOCUMENT'), 'text');
});

test('File Explorer server integration: listProjectFiles, saveProjectFile, and readPreviewFile', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-fe-test-'));
  try {
    const srcDir = path.join(tempDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });
    await fs.writeFile(path.join(srcDir, 'main.ts'), 'console.log("hello");\n');
    await fs.writeFile(path.join(tempDir, 'readme.txt'), 'SuperAi File Explorer Test');

    // 1. List files
    const list = await listProjectFiles(tempDir);
    assert.ok(list.files.includes('src/main.ts'));
    assert.ok(list.files.includes('readme.txt'));

    // 2. Read preview file
    const preview = await readPreviewFile(tempDir, 'src/main.ts');
    assert.equal(preview.contentType, 'text/plain; charset=utf-8');
    assert.equal(preview.content.toString(), 'console.log("hello");\n');

    // 3. Save modified content
    const updatedContent = 'console.log("updated via Quick Editor");\n';
    const saved = await saveProjectFile(tempDir, 'src/main.ts', updatedContent);
    assert.equal(saved, true);

    // 4. Verify saved content on disk
    const reloaded = await readPreviewFile(tempDir, 'src/main.ts');
    assert.equal(reloaded.content.toString(), updatedContent);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
