// SuperAi Voice & RAKKYXD — Ultra-Low-Latency Floating HUD with Real-Time Whisper & Live Waveform
const $ = (id) => document.getElementById(id);

let audioContext = null;
let analyser = null;
let micStream = null;
let mediaRecorder = null;
let audioChunks = [];
let animFrame = null;

let isRecording = false;
let isTranscribing = false;
let hasSpoken = false;
let lastSpeechTime = 0;
let silenceCheckInterval = null;

let currentLang = localStorage.getItem('voice-lang') || 'th'; // 'th' or 'en'
let timerInterval = null;
let recordStartTime = 0;

const transcriptInput = $('transcript');
const statusBadge = $('status');
const timerBadge = $('timerBadge');
const canvas = $('waveformCanvas');
const ctx = canvas.getContext('2d');
const langBtn = $('langBtn');
const langFlag = $('langFlag');
const langLabel = $('langLabel');
const deliverBtn = $('deliver');
const cancelBtn = $('cancel');
const micOrb = $('micOrb');
const engineBadge = $('engineBadge');
const techBadge = $('techBadge');

let groqKey = localStorage.getItem('voice-groq-key') || '';
let isTechMode = localStorage.getItem('voice-tech-mode') !== 'false';

// Update engine button display
function updateEngineUI() {
  if (engineBadge) {
    if (groqKey) {
      engineBadge.textContent = '⚡ Groq Turbo';
      engineBadge.title = 'ใช้ Groq Cloud Whisper Large-V3 Turbo (ความเร็ว 150-250ms) คลิกเพื่อเปลี่ยนคีย์';
    } else {
      engineBadge.textContent = '💻 Local';
      engineBadge.title = 'ใช้ Faster-Whisper ในเครื่อง 100% คลิกเพื่อใส่ Groq API Key';
    }
  }
}

// Update tech mode button display
function updateTechUI() {
  if (techBadge) {
    if (isTechMode) {
      techBadge.textContent = '🇹🇭 Code';
      techBadge.classList.remove('off');
      techBadge.title = 'เปิดโหมดแปลงศัพท์โปรแกรมมิ่ง (กิต -> git, เอ็นพีเอ็ม -> npm) คลิกเพื่อปิด';
    } else {
      techBadge.textContent = '🇹🇭 Text';
      techBadge.classList.add('off');
      techBadge.title = 'โหมดถอดข้อความทั่วไป คลิกเพื่อเปิดโหมดโค้ด';
    }
  }
}

updateEngineUI();
updateTechUI();

if (engineBadge) {
  engineBadge.onclick = (e) => {
    e.stopPropagation();
    const current = localStorage.getItem('voice-groq-key') || '';
    const input = prompt(
      'ใส่ Groq API Key (gsk_...) เพื่อความเร็วระดับเสี้ยววินาที (~200ms) และโมเดล Whisper Large-V3 Turbo:\n(เว้นว่างไว้เพื่อใช้ Local Whisper ในเครื่อง 100% ออฟไลน์)',
      current,
    );
    if (input !== null) {
      groqKey = input.trim();
      localStorage.setItem('voice-groq-key', groqKey);
      updateEngineUI();
      statusBadge.textContent = groqKey ? 'เปิดใช้งาน Groq Turbo ⚡' : 'ใช้ Local Whisper 💻';
    }
  };
}

if (techBadge) {
  techBadge.onclick = (e) => {
    e.stopPropagation();
    isTechMode = !isTechMode;
    localStorage.setItem('voice-tech-mode', String(isTechMode));
    updateTechUI();
    statusBadge.textContent = isTechMode ? 'เปิดโหมดแปลงโค้ด 🇹🇭' : 'โหมดข้อความทั่วไป';
  };
}

// Update language button display
function updateLangUI() {
  if (currentLang.startsWith('th')) {
    langFlag.textContent = '🇹🇭';
    langLabel.textContent = 'TH';
    if ($('language')) $('language').value = 'th';
  } else {
    langFlag.textContent = '🇺🇸';
    langLabel.textContent = 'EN';
    if ($('language')) $('language').value = 'en';
  }
}
updateLangUI();

langBtn.onclick = (e) => {
  e.stopPropagation();
  currentLang = currentLang.startsWith('th') ? 'en' : 'th';
  localStorage.setItem('voice-lang', currentLang);
  updateLangUI();
  if (isRecording) {
    statusBadge.textContent = currentLang === 'th' ? 'สลับเป็นภาษาไทย 🇹🇭' : 'Switched to English 🇺🇸';
  }
};

// 60 FPS Audio Waveform Visualizer & Voice Activity Detection (VAD)
function startWaveform(stream) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.75;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      animFrame = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = 6;
      const gap = 3.5;
      const barCount = 32;
      const startX = 0;

      let sumEnergy = 0;

      for (let i = 0; i < barCount; i++) {
        const raw = dataArray[i % bufferLength] || 0;
        sumEnergy += raw;
        const norm = isRecording ? raw / 255 : 0.05;
        const minHeight = 3;
        const barHeight = Math.max(minHeight, norm * (canvas.height - 2));

        const x = startX + i * (barWidth + gap);
        const y = (canvas.height - barHeight) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#9ed8ff');
        grad.addColorStop(1, '#8bd2b2');

        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, 2.5);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      // Voice Activity Detection
      const avgEnergy = sumEnergy / barCount;
      if (avgEnergy > 14) {
        hasSpoken = true;
        lastSpeechTime = Date.now();
        if (isRecording && !isTranscribing) {
          statusBadge.textContent = currentLang === 'th' ? 'กำลังรับเสียงพูด...' : 'Listening...';
        }
      }
    }
    draw();
  } catch (err) {
    console.warn('Waveform visualizer warning:', err);
  }
}

function stopWaveform() {
  if (animFrame) {
    cancelAnimationFrame(animFrame);
    animFrame = null;
  }
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// Timer
function startTimer() {
  recordStartTime = Date.now();
  timerBadge.textContent = '00:00';
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    timerBadge.textContent = `${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

// Start Voice Recording
async function startListening() {
  if (isRecording || isTranscribing) return;
  try {
    isRecording = true;
    hasSpoken = false;
    lastSpeechTime = 0;
    audioChunks = [];

    statusBadge.textContent = currentLang === 'th' ? 'พูดคำสั่งได้เลย...' : 'Speak now...';
    micOrb.style.boxShadow = '0 0 20px rgba(158, 216, 255, 0.9)';

    // Request mic stream
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    startWaveform(micStream);
    startTimer();

    // Start MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(micStream, { mimeType });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };
    mediaRecorder.start(100);

    // Silence detection check: finish after 1.5s of silence after speaking
    clearInterval(silenceCheckInterval);
    silenceCheckInterval = setInterval(() => {
      if (isRecording && hasSpoken && lastSpeechTime > 0) {
        if (Date.now() - lastSpeechTime > 1500) {
          clearInterval(silenceCheckInterval);
          finishAndDeliver();
        }
      }
    }, 200);
  } catch (err) {
    isRecording = false;
    statusBadge.textContent = `ไมโครโฟนไม่พร้อม: ${err.message}`;
  }
}

async function stopAndDeliverText(text) {
  clearInterval(silenceCheckInterval);
  isRecording = false;
  stopTimer();
  stopWaveform();

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch {}
  }
  mediaRecorder = null;

  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  micOrb.style.boxShadow = 'none';
  audioChunks = [];

  transcriptInput.value = text;
  statusBadge.textContent = '✓ ส่งข้อความแล้ว';
  const dest = $('destination')?.value || 'superai';
  try {
    const res = await window.voice.deliver({ text, destination: dest });
    console.log('VOICE DELIVER SUCCESS:', res);
  } catch (err) {
    console.error('VOICE DELIVER ERROR:', err);
    statusBadge.textContent = 'คัดลอกลงคลิปบอร์ดแล้ว';
  }
}

// Handler when user or test explicitly clicks Deliver button
async function handleDeliverClick() {
  const currentText = transcriptInput.value.trim();
  if (currentText) {
    await stopAndDeliverText(currentText);
  } else {
    await finishAndDeliver();
  }
}

// Stop Voice Recording, Transcribe with Faster-Whisper/Groq, and Deliver
async function finishAndDeliver() {
  if (isTranscribing) return;
  clearInterval(silenceCheckInterval);
  isRecording = false;
  stopTimer();
  stopWaveform();

  const recorder = mediaRecorder;
  mediaRecorder = null;

  if (recorder && recorder.state !== 'inactive') {
    await new Promise((resolve) => {
      const fallbackTimer = setTimeout(resolve, 150);
      recorder.onstop = () => {
        clearTimeout(fallbackTimer);
        resolve();
      };
      try {
        recorder.stop();
      } catch {
        clearTimeout(fallbackTimer);
        resolve();
      }
    });
  }

  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  micOrb.style.boxShadow = 'none';

  const recordedBlob = audioChunks.length > 0 ? new Blob(audioChunks, { type: 'audio/webm' }) : null;
  audioChunks = [];

  // Transcribe if we have captured audio
  if (recordedBlob && recordedBlob.size > 800) {
    isTranscribing = true;
    statusBadge.textContent = currentLang === 'th' ? '⚡ กำลังถอดเสียงเป็นข้อความ...' : '⚡ Transcribing...';
    try {
      const buffer = await recordedBlob.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const lang = currentLang.startsWith('th') ? 'th' : 'en';
      const model = $('model')?.value || 'base';

      const result = await window.voice.transcribe({
        audio: uint8,
        model,
        language: lang,
        groqKey: groqKey || undefined,
        techMode: isTechMode,
      });

      if (result && result.text) {
        transcriptInput.value = result.text.trim();
      }
    } catch (err) {
      console.warn('Transcription error:', err);
      statusBadge.textContent = `ถอดเสียงไม่ได้: ${err.message || 'เกิดข้อผิดพลาด'}`;
    } finally {
      isTranscribing = false;
    }
  }

  // Deliver text
  const text = transcriptInput.value.trim();
  if (text) {
    statusBadge.textContent = '✓ ส่งข้อความแล้ว';
    const dest = $('destination')?.value || 'superai';
    try {
      await window.voice.deliver({ text, destination: dest });
    } catch {
      statusBadge.textContent = 'คัดลอกลงคลิปบอร์ดแล้ว';
    }
  } else {
    statusBadge.textContent = 'ไม่พบเสียงพูด';
  }
}

// Cancel
function cancelListening(keepVisible = false) {
  clearInterval(silenceCheckInterval);
  isRecording = false;
  isTranscribing = false;
  stopTimer();
  stopWaveform();

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch {}
  }
  mediaRecorder = null;
  audioChunks = [];

  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  micOrb.style.boxShadow = 'none';

  statusBadge.textContent = 'ยกเลิกแล้ว';
  setTimeout(() => {
    try {
      if (!keepVisible) window.voice.hide();
    } catch {}
    statusBadge.textContent = 'พร้อมฟังเสียง';
  }, 200);
}

// Toggle on hotkey
async function toggle() {
  if (isRecording) {
    await finishAndDeliver();
    setTimeout(() => {
      try {
        window.voice.hide();
      } catch {}
    }, 300);
  } else {
    startListening();
  }
}

// Wire buttons
micOrb.onclick = toggle;
deliverBtn.onclick = handleDeliverClick;
cancelBtn.onclick = () => cancelListening();

// Keyboard navigation
window.addEventListener('keydown', (e) => {
  if (document.getElementById('voiceSettings')?.hidden === false) {
    if (e.key === 'Escape') showVoiceSettings(false);
    return;
  }
  if (e.key === 'Enter') {
    handleDeliverClick();
    e.preventDefault();
  } else if (e.key === 'Escape') {
    cancelListening();
    e.preventDefault();
  } else if (e.key === 'Tab') {
    langBtn.click();
    e.preventDefault();
  }
});

// IPC listeners
if (window.voice) {
  window.voice.onToggle(() => {
    toggle();
  });
  window.voice.onProgress((text) => {
    if (text) statusBadge.textContent = text;
  });
}

// Auto-start on load or hotkey signal
const settingsPanel = $('voiceSettings');
const settingsToggle = $('settingsToggle');
const setupStatus = $('setupStatus');
async function showVoiceSettings(expanded) {
  if (expanded && isRecording) cancelListening(true);
  settingsPanel.hidden = !expanded;
  document.body.classList.toggle('settings-open', expanded);
  settingsToggle.setAttribute('aria-expanded', String(expanded));
  await window.voice.settings(expanded);
}
settingsToggle.onclick = () => showVoiceSettings(settingsPanel.hidden);
$('closeSettings').onclick = () => showVoiceSettings(false);
async function setupAction(operation) {
  const buttons = ['installLocal', 'downloadLocal', 'checkLocal'].map($);
  buttons.forEach(button => button.disabled = true);
  setupStatus.textContent = 'กำลังดำเนินการ… การดาวน์โหลดครั้งแรกอาจใช้เวลาหลายนาที';
  try {
    const result = await operation();
    setupStatus.textContent = result.ok && result.ready !== false ? 'พร้อมแล้ว · ติดตั้งระบบเสียงแล้วให้ดาวน์โหลดโมเดล จากนั้นกลับหน้าพูด' : (result.error || 'ยังไม่พร้อม ตรวจ Python และดาวน์โหลดโมเดล');
  } catch (e) { setupStatus.textContent = e.message; }
  finally { buttons.forEach(button => button.disabled = false); }
}
$('installLocal').onclick = () => setupAction(() => window.voice.setup());
$('downloadLocal').onclick = () => setupAction(() => window.voice.prepare('base'));
$('checkLocal').onclick = () => setupAction(() => window.voice.status());
if (!window.voice?.testMode) setTimeout(async () => {
  const status = await window.voice.status();
  if (!groqKey && (!status.ok || !status.ready || !status.modelReady)) {
    await showVoiceSettings(true);
    setupStatus.textContent = status.error || 'ติดตั้งระบบเสียงและดาวน์โหลดโมเดล Base ก่อนใช้งานครั้งแรก';
  } else startListening();
}, 80);

// Legacy stubs for backwards compatibility with tests
if ($('record')) $('record').onclick = toggle;
