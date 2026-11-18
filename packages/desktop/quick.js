// Quick ask box (global shortcut): Enter sends to a new chat in the app, Shift+Enter adds a line, Esc closes.
const params = new URLSearchParams(location.search);
const text = document.getElementById('text');
text.placeholder = params.get('placeholder') || '';
document.getElementById('hint').textContent = params.get('hint') || '';
const submit = () => {
  const value = text.value.trim();
  if (!value) return;
  text.value = '';
  window.quickAsk.submit(value);
};
text.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { event.preventDefault(); text.value = ''; window.quickAsk.close(); }
  else if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); submit(); }
});
document.getElementById('form').addEventListener('submit', (event) => { event.preventDefault(); submit(); });
window.quickAsk.onShow(() => { text.focus(); text.select(); });
