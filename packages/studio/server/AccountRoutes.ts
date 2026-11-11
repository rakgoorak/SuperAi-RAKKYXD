import type { Express } from 'express';
import { accounts, ACCOUNT_CAPABILITIES, type AccountRegistry } from './Accounts.js';

export function registerAccountRoutes(app: Express, referenced: (id: string) => boolean, registry: AccountRegistry = accounts) {
  app.get('/api/accounts', (_req, res) => {
    try { res.json(ACCOUNT_CAPABILITIES.map(capability => ({ ...capability, profiles: registry.list(capability.provider) }))); }
    catch (error) { res.status(400).json({ error: (error as Error).message }); }
  });
  app.post('/api/accounts/:provider', (req, res) => {
    try { res.status(201).json(registry.create(String(req.params.provider), req.body?.name)); }
    catch (error) { res.status(400).json({ error: (error as Error).message }); }
  });
  app.patch('/api/accounts/:provider/:id', (req, res) => {
    try {
      registry.rename(String(req.params.provider), String(req.params.id), req.body?.name);
      res.json({ success: true });
    } catch (error) { res.status(400).json({ error: (error as Error).message }); }
  });
  app.post('/api/accounts/:provider/:id/default', (req, res) => {
    try {
      const provider = String(req.params.provider);
      if (!ACCOUNT_CAPABILITIES.some(c => c.provider === provider)) throw new Error('ไม่รู้จักผู้ให้บริการนี้');
      registry.setDefault(provider, String(req.params.id)); res.json({ success: true });
    } catch (error) { res.status(400).json({ error: (error as Error).message }); }
  });
  app.delete('/api/accounts/:provider/:id', (req, res) => {
    try {
      const id = String(req.params.id);
      if (referenced(id)) return res.status(409).json({ error: 'บัญชีนี้ยังผูกกับแท็บหรือประวัติงาน กรุณาปิดแท็บและล้างประวัติที่เกี่ยวข้องก่อนนำออก' });
      registry.remove(String(req.params.provider), id); res.json({ success: true });
    } catch (error) { res.status(400).json({ error: (error as Error).message }); }
  });
}
