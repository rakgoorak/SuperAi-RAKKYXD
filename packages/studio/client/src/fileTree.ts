export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
  isPinned?: boolean;
}

export const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'html', 'css', 'scss', 'less',
  'py', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'yaml', 'yml', 'toml', 'xml',
  'rs', 'go', 'c', 'cpp', 'h', 'hpp', 'cs', 'java', 'kt', 'swift', 'php', 'rb',
  'sql', 'graphql', 'md', 'mdx', 'env', 'gitignore', 'dockerignore'
]);

export const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'ico', 'bmp'
]);

export function getFileCategory(filename: string): 'code' | 'image' | 'text' {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  return 'text';
}

export function buildFileTree(files: string[], pinnedSet: Set<string>): TreeNode[] {
  const rootNodes: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();

  for (const rawPath of files) {
    const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized) continue;
    const parts = normalized.split('/');
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isDir = i < parts.length - 1;
      const prevPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (isDir) {
        if (!dirMap.has(currentPath)) {
          const dirNode: TreeNode = {
            name: part,
            path: currentPath,
            isDirectory: true,
            children: [],
          };
          dirMap.set(currentPath, dirNode);
          if (i === 0) {
            rootNodes.push(dirNode);
          } else {
            const parent = dirMap.get(prevPath);
            parent?.children?.push(dirNode);
          }
        }
      } else {
        const fileNode: TreeNode = {
          name: part,
          path: currentPath,
          isDirectory: false,
          isPinned: pinnedSet.has(currentPath),
        };
        if (i === 0) {
          if (!rootNodes.some(c => c.name === part && !c.isDirectory)) {
            rootNodes.push(fileNode);
          }
        } else {
          const parent = dirMap.get(prevPath);
          if (parent) {
            if (!parent.children) parent.children = [];
            if (!parent.children.some(c => c.name === part && !c.isDirectory)) {
              parent.children.push(fileNode);
            }
          }
        }
      }
    }
  }

  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
    });
    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children);
      }
    }
  }

  sortNodes(rootNodes);
  return rootNodes;
}

export function filterTree(
  nodes: TreeNode[],
  query: string
): { filtered: TreeNode[]; matchingDirs: Set<string> } {
  const q = query.toLowerCase().trim();
  if (!q) {
    return { filtered: nodes, matchingDirs: new Set() };
  }

  const matchingDirs = new Set<string>();

  function filterNode(node: TreeNode): TreeNode | null {
    const isSelfMatch = node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);

    if (node.isDirectory) {
      const filteredChildren: TreeNode[] = [];
      if (node.children) {
        for (const child of node.children) {
          const res = filterNode(child);
          if (res) filteredChildren.push(res);
        }
      }

      if (isSelfMatch || filteredChildren.length > 0) {
        matchingDirs.add(node.path);
        return {
          ...node,
          children: filteredChildren,
        };
      }
      return null;
    } else {
      if (isSelfMatch) {
        return node;
      }
      return null;
    }
  }

  const filtered: TreeNode[] = [];
  for (const node of nodes) {
    const res = filterNode(node);
    if (res) filtered.push(res);
  }

  return { filtered, matchingDirs };
}
