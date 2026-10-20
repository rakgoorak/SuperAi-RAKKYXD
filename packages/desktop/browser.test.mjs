import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBrowserUrl } from './browser-url.mjs';
test('browser accepts web URLs and localhost but rejects privileged URLs',()=>{
  assert.equal(normalizeBrowserUrl('localhost:3000'),'http://localhost:3000/');
  assert.equal(normalizeBrowserUrl('example.com'),'https://example.com/');
  assert.equal(normalizeBrowserUrl('https://example.com/path'),'https://example.com/path');
  for(const url of ['javascript:alert(1)','file:///C:/Windows','https://user:pass@example.com','']) assert.throws(()=>normalizeBrowserUrl(url));
});
