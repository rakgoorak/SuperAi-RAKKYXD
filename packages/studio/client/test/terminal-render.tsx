import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TerminalPane } from '../src/components/TerminalPane';
import '../src/index.css';

function Fixture() {
  const [visible, setVisible] = useState(true);
  return <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
    <button id="toggle" onClick={() => setVisible(v => !v)}>Toggle terminal</button>
    <div style={{ flex: 1, minHeight: 0 }}>
      <TerminalPane tab={{ id: 'render', sessionId: 'render', name: 'Rendering', type: 'terminal', status: 'running' }}
        visible={visible} focused={false} showHeader={false}
        onFocus={() => {}} onClose={() => {}} onExit={() => {}} registerSender={() => {}} />
    </div>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
