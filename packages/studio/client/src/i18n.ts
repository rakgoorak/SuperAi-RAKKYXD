import { useState, useEffect } from 'react';

export type Locale = 'th' | 'en' | 'ja' | 'zh';

export interface LanguageOption {
  code: Locale;
  label: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'th', label: 'Thai', nativeName: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'en', label: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'ja', label: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: 'Chinese', nativeName: '简体中文', flag: '🇨🇳' },
];

const STORAGE_KEY = 'superai_locale';

// Translations dictionary
export const translations: Record<Locale, Record<string, string>> = {
  th: {
    // Titlebar & Navigation
    'brand.title': 'SuperAi & RAKKYXD',
    'titlebar.sidebar_toggle': 'สลับแถบข้าง',
    'titlebar.sidebar_hide': 'ซ่อนแถบข้าง',
    'titlebar.sidebar_show': 'แสดงแถบข้าง',
    'titlebar.connected': 'เชื่อมต่อแล้ว',
    'titlebar.reconnecting': 'กำลังเชื่อมต่อใหม่',
    'titlebar.lang_switch': 'เปลี่ยนภาษา (Switch Language)',
    'mode.agent': 'ทีม Agent',
    'mode.chat': 'ถามหลาย AI',
    'mode.code': 'Terminal',
    'mode.agent_desc': 'ทีม Agent: ให้ AI แบ่งงานและลงมือทำ',
    'mode.chat_desc': 'ถามหลาย AI: ถามคำถามเดียวเทียบคำตอบ',
    'mode.code_desc': 'Terminal: ผู้ช่วย AI และเขียนโค้ดลงเครื่อง',
    'nav.files': 'ไฟล์',
    'nav.files_desc': 'เปิดไฟล์และแก้ไขด่วน',
    'nav.preview': 'Preview',
    'nav.preview_desc': 'เปิด Preview หน้าเว็บ',
    'nav.terminal': 'Terminal',
    'nav.terminal_desc': 'เปิด Terminal หรือหลายห้อง',
    'nav.new': 'ใหม่',
    'nav.new_desc': 'บทสนทนาใหม่',

    // Sidebar
    'sidebar.heading': 'พื้นที่ทำงาน',
    'sidebar.hide': 'ซ่อนแถบโปรเจกต์',
    'sidebar.add_project': 'เพิ่มโปรเจกต์',
    'sidebar.search_projects': 'ค้นหาโปรเจกต์',
    'sidebar.favorites': 'โปรเจกต์โปรด',
    'sidebar.no_favorites': 'ยังไม่มีโปรเจกต์โปรด เพิ่มได้จากเมนู … ของโปรเจกต์',
    'sidebar.new_session': 'เปิด session ใหม่',
    'sidebar.empty_sessions': 'บทสนทนาแรกจะปรากฏที่นี่ · เริ่มพิมพ์ได้เลย',
    'sidebar.search_history': 'ค้นหาประวัติ',
    'sidebar.getting_started': 'เริ่มต้นใช้งาน',
    'sidebar.getting_started_sub': 'ตรวจ Node, Git, CLI และบัญชี',
    'sidebar.skills': 'Skills',
    'sidebar.skills_sub': 'AI เสนอ คุณกดติดตั้ง',
    'sidebar.mcp': 'MCP Servers',
    'sidebar.mcp_sub': 'เชื่อมเครื่องมือ AI แต่ละค่าย',
    'sidebar.recent_projects': 'โปรเจกต์ล่าสุด',
    'sidebar.all_conversations': 'ประวัติการสนทนา',
    'sidebar.settings': 'การตั้งค่า',
    'sidebar.start_here': 'เริ่มต้นใช้งาน',

    // Welcome Screen
    'welcome.title': 'วันนี้อยากทำอะไร?',
    'welcome.subtitle': 'เลือกผู้ช่วย แล้วเริ่มพิมพ์ด้านล่างได้เลย',
    'welcome.install': 'ติดตั้ง',
    'welcome.open_terminal': 'เปิด Terminal',
    'welcome.open_terminal_desc': 'หน้าต่างพิมพ์คำสั่ง สำหรับผู้ที่คุ้นเคยกับ Terminal',
    'welcome.agent_btn': 'ให้ทีม AI ช่วยลงมือทำ',
    'welcome.agent_btn_desc': 'แบ่งงานให้ผู้ช่วยหลายตัว แล้วติดตามผลในหน้าเดียว',
    'welcome.chat_btn': 'คุยและเปรียบเทียบคำตอบ',
    'welcome.chat_btn_desc': 'ถามหลาย AI พร้อมกัน แล้วเลือกแนวทางที่เหมาะ',

    // Canvas & Empty States
    'canvas.workspace_room': 'ห้องทำงาน',
    'canvas.tasks_unit': 'งาน',
    'canvas.running_unit': 'กำลังทำงาน',
    'canvas.agent_empty_title': 'บอกเป้าหมาย แล้วให้ทีมแบ่งงานกันทำ',
    'canvas.agent_empty_desc': 'พิมพ์เป้าหมายและเกณฑ์ตรวจรับด้านล่าง Main จะแจกงานให้ Sub-agent และคุณจะเห็นว่าแต่ละตัวกำลังทำอะไร',
    'canvas.chat_empty_title': 'พิมพ์คำถามครั้งเดียว ได้ความเห็นจากทุก AI',
    'canvas.chat_empty_desc': 'แต่ละ AI ตอบแยกกัน แล้วผู้สรุปจะรวมผลพร้อมบอกว่าใครแนะนำอะไร',

    // Composer & Interactions
    'composer.placeholder': 'ส่งข้อความถึง AI (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัดใหม่)...',
    'composer.placeholder_all': 'ส่งข้อความถึงทุกห้อง…',
    'composer.placeholder_code': 'พิมพ์ข้อความ…',
    'composer.placeholder_agent': 'บอกสิ่งที่ต้องการให้ทีมทำ…',
    'composer.placeholder_chat': 'ถาม AI ที่เลือก…',
    'composer.send': 'ส่ง',
    'composer.stop': 'หยุด',
    'composer.effort': 'ระดับความคิด',
    'composer.permission': 'สิทธิ์การเขียนไฟล์',
    'composer.perm_ask': 'ถามก่อนเขียน',
    'composer.perm_auto': 'เขียนได้ทันที',
    'composer.perm_readonly': 'อ่านอย่างเดียว',
    'composer.dictation_start': 'พูดภาษาไทย',
    'composer.dictation_stop': 'หยุดบันทึก',
    'composer.attach': 'แนบไฟล์',
    'composer.add_context': 'เพิ่มบริบท',

    // Interactive Tour
    'tour.skip': 'ข้ามทัวร์ (Esc)',
    'tour.prev': 'ย้อน',
    'tour.next': 'ถัดไป',
    'tour.finish': 'เสร็จสิ้น',
    'tour.done_title': 'ยอดเยี่ยม! คุณพร้อมใช้งานแล้ว 🎉',
    'tour.done_desc': 'คุณได้รู้จักเครื่องมือหลักของ SuperAi ครบถ้วนแล้ว ลองพิมพ์คำสั่งแรกในกล่องข้อความ หรือสั่งงานด้วยเสียงได้ทันที',
    'tour.done_btn': 'เริ่มต้นใช้งาน SuperAi ทันที',
    'tour.step1_badge': 'ขั้นตอนที่ 1 / 5',
    'tour.step1_title': '1. สลับโหมดการทำงาน (3 โหมดหลัก)',
    'tour.step1_desc': 'SuperAi รวมโหมดทำงานอัจฉริยะไว้ในที่เดียว:\n• 🤖 ทีม Agent: สั่งงานใหญ่ ให้ AI หลายตัวช่วยกันวางแผนและเขียนโค้ด\n• ⚡ Terminal: คุยตรงกับ AI CLI สั่งรันคำสั่งและแก้ไฟล์บนเครื่อง\n• 💬 ถามหลาย AI: ถามข้อความเดียว AI ทุกค่ายร่วมแข่งกันตอบ',
    'tour.step1_hint': '💡 ลองคลิกปุ่มสลับโหมด หรือกดปุ่ม "ถัดไป" ได้เลยครับ',
    'tour.step2_badge': 'ขั้นตอนที่ 2 / 5',
    'tour.step2_title': '2. กล่องพิมพ์สั่งงาน AI (Smart Composer)',
    'tour.step2_desc': 'กล่องคำสั่ง AI ที่รองรับทุกอย่างที่คุณต้องการ:\n• พิมพ์ภาษาไทยหรืออังกฤษตามธรรมชาติ\n• กด Enter เพื่อส่ง / Shift+Enter ขึ้นบรรทัดใหม่\n• พิมพ์ / เพื่อเปิดเมนูคำสั่งลัด เช่น /review, /test\n• พิมพ์ @ เพื่อแท็กอ้างอิงไฟล์ในโปรเจกต์',
    'tour.step2_hint': '💡 สามารถลากไฟล์ รูปภาพ หรือโฟลเดอร์มาวางในกล่องนี้ได้ทันที',
    'tour.step3_badge': 'ขั้นตอนที่ 3 / 5',
    'tour.step3_title': '3. สั่งงานด้วยเสียง (Local Whisper AI)',
    'tour.step3_desc': 'ประหยัดเวลาพิมพ์คำสั่งยาวๆ!\n• กดปุ่มไมโครโฟนข้างกล่องพิมพ์ แล้วพูดสั่งงานได้ทันที\n• ระบบใช้ Local Whisper AI ถอดเสียงเป็นข้อความลงช่องพิมพ์ให้อัตโนมัติ\n• ทำงานบนเครื่องของคุณ 100% ปลอดภัยและเป็นส่วนตัว',
    'tour.step3_hint': '💡 ลองกดปุ่มไมโครโฟน แล้วพูดทดสอบได้เลยครับ',
    'tour.step4_badge': 'ขั้นตอนที่ 4 / 5',
    'tour.step4_title': '4. เปิด Preview ดูเว็บจริง & เช็กโควตา',
    'tour.step4_desc': 'ศูนย์ตรวจงานและมอนิเตอร์:\n• 🌐 เปิด Preview: เปิดดูหน้าเว็บจริงที่ AI สร้างขึ้นในหน้าต่างเดียว ไม่ต้องสลับเบราว์เซอร์\n• 📊 โควตา: เช็กโควตาคงเหลือของแต่ละค่าย AI ได้แบบเรียลไทม์',
    'tour.step4_hint': '💡 เห็นทั้งโค้ดและหน้าเว็บที่ AI กำลังสร้างพร้อมๆ กัน',
    'tour.step5_badge': 'ขั้นตอนที่ 5 / 5',
    'tour.step5_title': '5. ปลั๊กอิน MCP & ซ่อมโค้ดอัตโนมัติ',
    'tour.step5_desc': 'ขุมพลังพิเศษของ SuperAi:\n• 🔌 MCP Servers: เชื่อมต่อเครื่องมือเบราว์เซอร์ Puppeteer, ฐานข้อมูล SQLite/Postgres ให้ AI ทุกค่ายใช้ร่วมกัน\n• 🩹 Self-Healing: ซ่อมโค้ดอัตโนมัติเมื่อ Test พัง (ดูได้ที่หน้า Changes)\n• ⚖️ AI Cross-Review: ให้ AI ต่างค่ายช่วยรีวิวหาช่องโหว่ความปลอดภัย',
    'tour.step5_hint': '💡 ลองคลิกที่ปุ่ม MCP Servers เพื่อดูเครื่องมือที่เปิดให้เชื่อมต่อได้ในคลิกเดียว',

    // Settings
    'settings.title': 'การตั้งค่า',
    'settings.tab_general': 'ทั่วไป',
    'settings.tab_language': 'ภาษา / Language',
    'settings.tab_tools': 'เครื่องมือ AI',
    'settings.tab_mcp': 'MCP Servers',
    'settings.tab_models': 'Model และ Effort',
    'settings.tab_folders': 'โฟลเดอร์',
    'settings.tab_voice': 'เสียง',
    'settings.tab_notify': 'แจ้งเตือนและคำแนะนำ',
    'settings.tab_updates': 'การอัปเดต',
    'settings.done': 'เสร็จแล้ว',
    'settings.auto_saved': 'บันทึกการตั้งค่าอัตโนมัติ',
    'settings.lang_heading': 'เลือกภาษาการแสดงผล (Display Language)',
    'settings.lang_desc': 'เปลี่ยนภาษาเมนูและปุ่มสั่งงานทั้งหมดในโปรแกรมได้ทันที',

    // Updates & Community
    'updates.community_downloads': 'ยอดดาวน์โหลดคอมมูนิตี้',
    'updates.current_version': 'เวอร์ชันที่ใช้อยู่',
    'updates.latest_version': 'เวอร์ชันล่าสุด',
    'updates.check_now': 'ตรวจหาการอัปเดต',
    'updates.up_to_date': 'คุณใช้เวอร์ชันล่าสุดแล้ว',
  },
  en: {
    // Titlebar & Navigation
    'brand.title': 'SuperAi & RAKKYXD',
    'titlebar.sidebar_toggle': 'Toggle sidebar',
    'titlebar.sidebar_hide': 'Hide sidebar',
    'titlebar.sidebar_show': 'Show sidebar',
    'titlebar.connected': 'Connected',
    'titlebar.reconnecting': 'Reconnecting...',
    'titlebar.lang_switch': 'Switch Display Language',
    'mode.agent': 'Agent Team',
    'mode.chat': 'Multi-AI Chat',
    'mode.code': 'Terminal',
    'mode.agent_desc': 'Agent Team: Autonomous multi-agent task planning & execution',
    'mode.chat_desc': 'Multi-AI Chat: Ask once, compare answers across providers',
    'mode.code_desc': 'Terminal: Direct AI CLI sessions & local coding',
    'nav.files': 'Files',
    'nav.files_desc': 'Open file explorer & quick editor',
    'nav.preview': 'Preview',
    'nav.preview_desc': 'Toggle live web preview pane',
    'nav.terminal': 'Terminal',
    'nav.terminal_desc': 'Spawn new terminal or multi-pane session',
    'nav.new': 'New',
    'nav.new_desc': 'Start a new conversation',

    // Sidebar
    'sidebar.heading': 'Workspaces',
    'sidebar.hide': 'Hide project sidebar',
    'sidebar.add_project': 'Add Project',
    'sidebar.search_projects': 'Search projects...',
    'sidebar.favorites': 'Favorites',
    'sidebar.no_favorites': 'No favorite projects yet. Star a project from its … menu.',
    'sidebar.new_session': 'New session',
    'sidebar.empty_sessions': 'Your first conversation will appear here · Start typing below',
    'sidebar.search_history': 'Search History',
    'sidebar.getting_started': 'Setup Guide',
    'sidebar.getting_started_sub': 'Verify Node, Git, CLIs & accounts',
    'sidebar.skills': 'Skills',
    'sidebar.skills_sub': 'AI-recommended project skills',
    'sidebar.mcp': 'MCP Servers',
    'sidebar.mcp_sub': '1-click tools across AI providers',
    'sidebar.recent_projects': 'Recent Projects',
    'sidebar.all_conversations': 'Conversations',
    'sidebar.settings': 'Settings',
    'sidebar.start_here': 'Get Started',

    // Welcome Screen
    'welcome.title': 'What would you like to build today?',
    'welcome.subtitle': 'Choose an AI assistant below and start typing',
    'welcome.install': 'Install',
    'welcome.open_terminal': 'Open Terminal',
    'welcome.open_terminal_desc': 'Launch an interactive terminal pane',
    'welcome.agent_btn': 'Run Autonomous Agent Team',
    'welcome.agent_btn_desc': 'Delegate complex tasks to Main + Sub-agents in parallel',
    'welcome.chat_btn': 'Compare Multiple AIs',
    'welcome.chat_btn_desc': 'Ask multiple AI models at once and compare side-by-side',

    // Canvas & Empty States
    'canvas.workspace_room': 'Workspace',
    'canvas.tasks_unit': 'runs',
    'canvas.running_unit': 'running',
    'canvas.agent_empty_title': 'Describe your goal and let the AI Team divide & conquer',
    'canvas.agent_empty_desc': 'Enter your objective below. The Main planner delegates tasks to Sub-agents while you track live progress.',
    'canvas.chat_empty_title': 'Ask once, get side-by-side answers from every AI',
    'canvas.chat_empty_desc': 'Each AI responds independently, and the Summarizer synthesizes the best insights.',

    // Composer & Interactions
    'composer.placeholder': 'Message AI (Enter to send, Shift+Enter for new line)...',
    'composer.placeholder_all': 'Broadcast message to all active sessions…',
    'composer.placeholder_code': 'Type a message or command…',
    'composer.placeholder_agent': 'Describe what you want the Agent Team to build…',
    'composer.placeholder_chat': 'Ask selected AI models…',
    'composer.send': 'Send',
    'composer.stop': 'Stop',
    'composer.effort': 'Thinking Effort',
    'composer.permission': 'File Permissions',
    'composer.perm_ask': 'Ask before write',
    'composer.perm_auto': 'Auto-write',
    'composer.perm_readonly': 'Read-only',
    'composer.dictation_start': 'Voice Dictation',
    'composer.dictation_stop': 'Stop Recording',
    'composer.attach': 'Attach files',
    'composer.add_context': 'Add context',

    // Interactive Tour
    'tour.skip': 'Skip Tour (Esc)',
    'tour.prev': 'Back',
    'tour.next': 'Next',
    'tour.finish': 'Finish',
    'tour.done_title': 'You’re All Set! 🎉',
    'tour.done_desc': 'You’ve explored the core workspace tools of SuperAi. Type your first prompt below or use local voice dictation right away!',
    'tour.done_btn': 'Start Using SuperAi',
    'tour.step1_badge': 'Step 1 / 5',
    'tour.step1_title': '1. Switch Workspace Modes (3 Core Modes)',
    'tour.step1_desc': 'SuperAi unites 3 powerful workflows in one window:\n• 🤖 Agent Team: Multi-agent planning & parallel code execution\n• ⚡ Terminal: Direct interactive AI CLIs & local file editing\n• 💬 Multi-AI Chat: Ask once and compare responses side-by-side',
    'tour.step1_hint': '💡 Click any mode tab above or press "Next" to continue',
    'tour.step2_badge': 'Step 2 / 5',
    'tour.step2_title': '2. Smart Composer',
    'tour.step2_desc': 'Your unified command center:\n• Press Enter to send, Shift+Enter for a new line\n• Type / for slash commands (/review, /test, /skills)\n• Type @ to reference project files & context',
    'tour.step2_hint': '💡 Drag & drop images, PDFs, or code files directly into the box',
    'tour.step3_badge': 'Step 3 / 5',
    'tour.step3_title': '3. Local Whisper AI Voice Input',
    'tour.step3_desc': 'Speak instead of typing long prompts!\n• Click the microphone icon to dictate hands-free\n• Powered by 100% local on-device Whisper AI\n• Zero cloud audio uploads — complete privacy',
    'tour.step3_hint': '💡 Click the mic button anytime to test voice transcription',
    'tour.step4_badge': 'Step 4 / 5',
    'tour.step4_title': '4. Live Web Preview & Quota Tracker',
    'tour.step4_desc': 'Inspect results without leaving the app:\n• 🌐 Preview: View live localhost web apps side-by-side with your code\n• 📊 Usage: Track remaining 5-hour & weekly CLI quotas across Claude, Codex & Gemini',
    'tour.step4_hint': '💡 Watch your web app update live as AI writes code',
    'tour.step5_badge': 'Step 5 / 5',
    'tour.step5_title': '5. 1-Click MCP Servers & Self-Healing',
    'tour.step5_desc': 'Supercharge every AI provider:\n• 🔌 MCP Servers: Connect Puppeteer, Postgres, GitHub & Filesystem in 1 click and sync across Claude, Codex & OpenCode\n• 🩹 Self-Healing: Auto-fix failing tests in the Changes panel\n• ⚖️ Cross-Review: Have one AI audit another AI’s git diff',
    'tour.step5_hint': '💡 Click MCP Servers to explore 1-click tool presets',

    // Settings
    'settings.title': 'Settings',
    'settings.tab_general': 'General',
    'settings.tab_language': 'Language',
    'settings.tab_tools': 'AI Tools',
    'settings.tab_mcp': 'MCP Servers',
    'settings.tab_models': 'Model & Effort',
    'settings.tab_folders': 'Folders',
    'settings.tab_voice': 'Voice & Audio',
    'settings.tab_notify': 'Notifications',
    'settings.tab_updates': 'Updates',
    'settings.done': 'Done',
    'settings.auto_saved': 'Settings saved automatically',
    'settings.lang_heading': 'Display Language',
    'settings.lang_desc': 'Choose your preferred language for the interface and controls.',

    // Updates & Community
    'updates.community_downloads': 'Community Downloads',
    'updates.current_version': 'Current Version',
    'updates.latest_version': 'Latest Version',
    'updates.check_now': 'Check for updates',
    'updates.up_to_date': 'You are on the latest version',
  },
  ja: {
    // Titlebar & Navigation
    'brand.title': 'SuperAi & RAKKYXD',
    'titlebar.sidebar_toggle': 'サイドバー切替',
    'titlebar.sidebar_hide': 'サイドバーを隠す',
    'titlebar.sidebar_show': 'サイドバーを表示',
    'titlebar.connected': '接続済み',
    'titlebar.reconnecting': '再接続中...',
    'titlebar.lang_switch': '表示言語を切り替え',
    'mode.agent': 'エージェント',
    'mode.chat': 'マルチAI比較',
    'mode.code': 'ターミナル',
    'mode.agent_desc': 'エージェントチーム：複数AIによるタスク分割と並列実行',
    'mode.chat_desc': 'マルチAI：1つの質問で複数AIの回答を同時比較',
    'mode.code_desc': 'ターミナル：AI CLIセッション＆ローカル開発',
    'nav.files': 'ファイル',
    'nav.files_desc': 'ファイル一覧とクイック編集',
    'nav.preview': 'プレビュー',
    'nav.preview_desc': 'ライブWebプレビューを開閉',
    'nav.terminal': 'ターミナル',
    'nav.terminal_desc': '新しいターミナルセッションを起動',
    'nav.new': '新規',
    'nav.new_desc': '新しい会話を開始',

    // Sidebar
    'sidebar.heading': 'ワークスペース',
    'sidebar.hide': 'サイドバーを隠す',
    'sidebar.add_project': 'プロジェクト追加',
    'sidebar.search_projects': 'プロジェクトを検索...',
    'sidebar.favorites': 'お気に入り',
    'sidebar.no_favorites': 'お気に入りはまだありません（…メニューから追加可能）',
    'sidebar.new_session': '新規セッション',
    'sidebar.empty_sessions': '最初の会話がここに表示されます',
    'sidebar.search_history': '履歴を検索',
    'sidebar.getting_started': 'セットアップ',
    'sidebar.getting_started_sub': 'Node・Git・CLI・アカウント確認',
    'sidebar.skills': 'スキル (Skills)',
    'sidebar.skills_sub': 'AI推奨スキルのワンクリック導入',
    'sidebar.mcp': 'MCPサーバー',
    'sidebar.mcp_sub': '外部ツールを各AIに一括連携',
    'sidebar.recent_projects': '最近のプロジェクト',
    'sidebar.all_conversations': '会話履歴',
    'sidebar.settings': '設定',
    'sidebar.start_here': '使ってみる',

    // Welcome Screen
    'welcome.title': '今日は何を作りますか？',
    'welcome.subtitle': 'AIアシスタントを選択して、下のボックスから入力してください',
    'welcome.install': '導入',
    'welcome.open_terminal': 'ターミナルを開く',
    'welcome.open_terminal_desc': 'コマンド入力用のターミナル画面を開きます',
    'welcome.agent_btn': 'AIエージェントチームに任せる',
    'welcome.agent_btn_desc': '複数のAIにタスクを分担させ、進捗を一画面で管理します',
    'welcome.chat_btn': '複数AIの回答を比較する',
    'welcome.chat_btn_desc': '複数のAIモデルに同時質問し、最適な回答を選べます',

    // Canvas & Empty States
    'canvas.workspace_room': 'ワークスペース',
    'canvas.tasks_unit': '件',
    'canvas.running_unit': '実行中',
    'canvas.agent_empty_title': '目標を伝えて、AIチームにタスクを分担させましょう',
    'canvas.agent_empty_desc': '下に目標を入力すると、MainがSub-agentに作業を割り振り、進行状況をリアルタイム表示します。',
    'canvas.chat_empty_title': '1回の質問で、すべてのAIから意見を収集',
    'canvas.chat_empty_desc': '各AIが個別に回答し、最後にサマライザーが要点をまとめます。',

    // Composer & Interactions
    'composer.placeholder': 'AIにメッセージを送信 (Enterで送信、Shift+Enterで改行)...',
    'composer.placeholder_all': 'すべてのセッションに一括送信…',
    'composer.placeholder_code': 'メッセージまたはコマンドを入力…',
    'composer.placeholder_agent': 'AIチームに依頼したいタスクを入力…',
    'composer.placeholder_chat': '選択したAIに質問…',
    'composer.send': '送信',
    'composer.stop': '停止',
    'composer.effort': '思考レベル',
    'composer.permission': 'ファイル書き込み権限',
    'composer.perm_ask': '書き込み前に確認',
    'composer.perm_auto': '自動書き込み',
    'composer.perm_readonly': '読み取り専用',
    'composer.dictation_start': '音声入力開始',
    'composer.dictation_stop': '録音停止',
    'composer.attach': 'ファイルを添付',
    'composer.add_context': 'コンテキストを追加',

    // Interactive Tour
    'tour.skip': 'スキップ (Esc)',
    'tour.prev': '戻る',
    'tour.next': '次へ',
    'tour.finish': '完了',
    'tour.done_title': '準備完了です！ 🎉',
    'tour.done_desc': 'SuperAiの主要機能を確認しました。下の入力欄から最初のプロンプトを送ってみましょう！',
    'tour.done_btn': 'SuperAiを始める',
    'tour.step1_badge': 'ステップ 1 / 5',
    'tour.step1_title': '1. 3つの作業モードを切り替え',
    'tour.step1_desc': '用途に合わせてモードを瞬時に切り替えられます：\n• 🤖 エージェント：複数AIが計画・実装を分担\n• ⚡ ターミナル：各社AI CLIと直接対話＆コード編集\n• 💬 マルチAI比較：複数AIの回答を並べて比較',
    'tour.step1_hint': '💡 タブをクリックするか「次へ」を押してください',
    'tour.step2_badge': 'ステップ 2 / 5',
    'tour.step2_title': '2. スマートコンポーザー (入力欄)',
    'tour.step2_desc': '直感的なコマンド入力：\n• Enterで送信 / Shift+Enterで改行\n• / でショートカットコマンド (/review, /test)\n• @ でプロジェクト内のファイルを参照',
    'tour.step2_hint': '💡 画像やファイルをここにドラッグ＆ドロップできます',
    'tour.step3_badge': 'ステップ 3 / 5',
    'tour.step3_title': '3. ローカルWhisper AI音声入力',
    'tour.step3_desc': 'マイクボタンを押して話すだけでテキスト化！\n• 100%ローカル実行のWhisper AIを搭載\n• 音声データは外部サーバーに送信されず安全です',
    'tour.step3_hint': '💡 マイクボタンを押して音声入力を試せます',
    'tour.step4_badge': 'ステップ 4 / 5',
    'tour.step4_title': '4. ライブプレビュー＆残り枠(Quota)確認',
    'tour.step4_desc': 'アプリ内で結果を確認：\n• 🌐 プレビュー：作成したWebアプリをその場で表示\n• 📊 使用量：Claude・Codex・Geminiの残り枠を一目で確認',
    'tour.step4_hint': '💡 コードとWeb画面を並べて開発できます',
    'tour.step5_badge': 'ステップ 5 / 5',
    'tour.step5_title': '5. MCP連携＆自動修復 (Self-Healing)',
    'tour.step5_desc': 'AIをさらに強化：\n• 🔌 MCPサーバー：PuppeteerやDBをワンクリックで各AIに連携\n• 🩹 自動修復：テスト失敗時にAIが自動でコードを修正\n• ⚖️ クロスレビュー：別のAIがGit差分を監査',
    'tour.step5_hint': '💡 MCPサーバーボタンからプリセットを確認できます',

    // Settings
    'settings.title': '設定',
    'settings.tab_general': '一般',
    'settings.tab_language': '言語 (Language)',
    'settings.tab_tools': 'AIツール',
    'settings.tab_mcp': 'MCPサーバー',
    'settings.tab_models': 'モデル＆思考力',
    'settings.tab_folders': 'フォルダー',
    'settings.tab_voice': '音声設定',
    'settings.tab_notify': '通知とアドバイス',
    'settings.tab_updates': 'アップデート',
    'settings.done': '完了',
    'settings.auto_saved': '設定は自動保存されます',
    'settings.lang_heading': '表示言語の選択',
    'settings.lang_desc': 'インターフェースおよびボタンの表示言語を切り替えます。',

    // Updates & Community
    'updates.community_downloads': 'コミュニティダウンロード総数',
    'updates.current_version': '現在のバージョン',
    'updates.latest_version': '最新バージョン',
    'updates.check_now': '更新を確認',
    'updates.up_to_date': '最新バージョンを使用中です',
  },
  zh: {
    // Titlebar & Navigation
    'brand.title': 'SuperAi & RAKKYXD',
    'titlebar.sidebar_toggle': '切换侧边栏',
    'titlebar.sidebar_hide': '隐藏侧边栏',
    'titlebar.sidebar_show': '显示侧边栏',
    'titlebar.connected': '已连接',
    'titlebar.reconnecting': '正在重新连接...',
    'titlebar.lang_switch': '切换界面语言',
    'mode.agent': '智能体团队',
    'mode.chat': '多模型对比',
    'mode.code': '终端与代码',
    'mode.agent_desc': '智能体团队：多AI协同规划与并行编写代码',
    'mode.chat_desc': '多模型对比：一次提问，并排对比各家AI回答',
    'mode.code_desc': '终端模式：直连本地AI CLI与代码编辑',
    'nav.files': '文件',
    'nav.files_desc': '打开文件浏览器与快速编辑',
    'nav.preview': '网页预览',
    'nav.preview_desc': '开启内置实时网页预览',
    'nav.terminal': '终端',
    'nav.terminal_desc': '新建终端或多窗口会话',
    'nav.new': '新建',
    'nav.new_desc': '发起新对话',

    // Sidebar
    'sidebar.heading': '工作区',
    'sidebar.hide': '隐藏侧边栏',
    'sidebar.add_project': '添加项目',
    'sidebar.search_projects': '搜索项目...',
    'sidebar.favorites': '收藏项目',
    'sidebar.no_favorites': '暂无收藏项目，可在项目 … 菜单中添加',
    'sidebar.new_session': '新建会话',
    'sidebar.empty_sessions': '您的第一个对话将显示在这里 · 在下方开始输入',
    'sidebar.search_history': '搜索历史',
    'sidebar.getting_started': '环境向导',
    'sidebar.getting_started_sub': '检测 Node、Git、CLI 与账号状态',
    'sidebar.skills': '技能 (Skills)',
    'sidebar.skills_sub': 'AI 推荐并一键安装项目技能',
    'sidebar.mcp': 'MCP 服务',
    'sidebar.mcp_sub': '跨平台一键同步外部工具',
    'sidebar.recent_projects': '最近项目',
    'sidebar.all_conversations': '对话记录',
    'sidebar.settings': '设置',
    'sidebar.start_here': '快速入门',

    // Welcome Screen
    'welcome.title': '今天想构建什么？',
    'welcome.subtitle': '选择下方的 AI 助手并直接开始输入',
    'welcome.install': '安装',
    'welcome.open_terminal': '打开终端',
    'welcome.open_terminal_desc': '打开命令行终端窗口',
    'welcome.agent_btn': '让 AI 团队协同执行',
    'welcome.agent_btn_desc': '将复杂任务拆解给多个子智能体并行完成',
    'welcome.chat_btn': '多 AI 提问与对比',
    'welcome.chat_btn_desc': '同时向多个 AI 模型提问并对比最佳方案',

    // Canvas & Empty States
    'canvas.workspace_room': '工作室',
    'canvas.tasks_unit': '项任务',
    'canvas.running_unit': '正在运行',
    'canvas.agent_empty_title': '输入目标，让 AI 团队自动拆解并协作完成',
    'canvas.agent_empty_desc': '在下方输入需求，主智能体 (Main) 会分配任务给子智能体 (Sub-agents) 并实时展示进度。',
    'canvas.chat_empty_title': '一次提问，同时获取所有 AI 的见解',
    'canvas.chat_empty_desc': '各个 AI 独立作答，最后由总结模型汇总各方建议。',

    // Composer & Interactions
    'composer.placeholder': '给 AI 发送消息 (按 Enter 发送，Shift+Enter 换行)...',
    'composer.placeholder_all': '向所有活动会话广播消息…',
    'composer.placeholder_code': '输入消息或命令…',
    'composer.placeholder_agent': '描述您希望 AI 团队完成的任务…',
    'composer.placeholder_chat': '向所选 AI 提问…',
    'composer.send': '发送',
    'composer.stop': '停止',
    'composer.effort': '思考深度',
    'composer.permission': '文件修改权限',
    'composer.perm_ask': '写入前询问',
    'composer.perm_auto': '允许自动写入',
    'composer.perm_readonly': '仅只读',
    'composer.dictation_start': '语音输入',
    'composer.dictation_stop': '停止录音',
    'composer.attach': '添加附件',
    'composer.add_context': '添加上下文',

    // Interactive Tour
    'tour.skip': '跳过导览 (Esc)',
    'tour.prev': '上一步',
    'tour.next': '下一步',
    'tour.finish': '完成',
    'tour.done_title': '太棒了！一切准备就绪 🎉',
    'tour.done_desc': '您已了解 SuperAi 的核心工具，现在可以在下方输入框发送第一条指令或体验本地语音输入！',
    'tour.done_btn': '立即开始使用 SuperAi',
    'tour.step1_badge': '步骤 1 / 5',
    'tour.step1_title': '1. 切换三大核心工作模式',
    'tour.step1_desc': 'SuperAi 将三种工作流融为一体：\n• 🤖 智能体团队：多 AI 规划拆解并并行编写代码\n• ⚡ 终端与代码：直连各家 AI CLI 并直接修改本地文件\n• 💬 多模型对比：一次提问，并排对比各家 AI 的回答',
    'tour.step1_hint': '💡 点击上方模式标签或按“下一步”继续',
    'tour.step2_badge': '步骤 2 / 5',
    'tour.step2_title': '2. 智能输入框 (Smart Composer)',
    'tour.step2_desc': '全功能指令中心：\n• 按 Enter 发送 / Shift+Enter 换行\n• 输入 / 调出快捷命令 (/review, /test)\n• 输入 @ 引用项目中的文件作为上下文',
    'tour.step2_hint': '💡 支持直接拖拽图片、PDF 或代码文件到输入框',
    'tour.step3_badge': '步骤 3 / 5',
    'tour.step3_title': '3. 本地 Whisper AI 语音输入',
    'tour.step3_desc': '解放双手，告别长篇打字：\n• 点击麦克风即可语音输入指令\n• 100% 在本地设备运行 Whisper AI 模型\n• 绝不上传音频到云端，兼顾速度与隐私',
    'tour.step3_hint': '💡 随时点击麦克风图标测试语音转文字',
    'tour.step4_badge': '步骤 4 / 5',
    'tour.step4_title': '4. 实时网页预览与额度监控',
    'tour.step4_desc': '无需切换外部浏览器：\n• 🌐 网页预览：在应用内同屏预览 AI 构建的网页成果\n• 📊 额度监控：实时查看 Claude、Codex、Gemini 的剩余配额',
    'tour.step4_hint': '💡 一边看 AI 写代码，一边看网页实时刷新',
    'tour.step5_badge': '步骤 5 / 5',
    'tour.step5_title': '5. MCP 插件与自动修复 (Self-Healing)',
    'tour.step5_desc': '赋能所有 AI 模型：\n• 🔌 MCP 服务：一键连接 Puppeteer、数据库、GitHub 并同步给各家 CLI\n• 🩹 自动修复：测试报错时自动分析日志并修复代码\n• ⚖️ 交叉审查：让不同厂商的 AI 互相审查代码安全漏洞',
    'tour.step5_hint': '💡 点击 MCP 服务按钮查看一键预设工具',

    // Settings
    'settings.title': '设置',
    'settings.tab_general': '通用',
    'settings.tab_language': '语言 (Language)',
    'settings.tab_tools': 'AI 工具',
    'settings.tab_mcp': 'MCP 服务',
    'settings.tab_models': '模型与深度',
    'settings.tab_folders': '项目文件夹',
    'settings.tab_voice': '语音设置',
    'settings.tab_notify': '通知与建议',
    'settings.tab_updates': '版本更新',
    'settings.done': '完成',
    'settings.auto_saved': '配置已自动保存',
    'settings.lang_heading': '界面显示语言',
    'settings.lang_desc': '选择适合您的软件显示语言，修改后即时生效。',

    // Updates & Community
    'updates.community_downloads': '社区总下载量',
    'updates.current_version': '当前版本',
    'updates.latest_version': '最新版本',
    'updates.check_now': '检查更新',
    'updates.up_to_date': '当前已是最新版本',
  },
};

/**
 * Detect the initial language from localStorage or navigator.
 * Thai OS -> 'th', Japanese OS -> 'ja', Chinese OS -> 'zh', all other global OS -> 'en'.
 */
export function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && (saved === 'th' || saved === 'en' || saved === 'ja' || saved === 'zh')) {
      return saved;
    }
    const nav = navigator.language?.toLowerCase() || '';
    if (nav.startsWith('th')) return 'th';
    if (nav.startsWith('ja')) return 'ja';
    if (nav.startsWith('zh')) return 'zh';
  } catch {}
  return 'th'; // Default to Thai
}

let currentLocale: Locale = getInitialLocale();
const listeners = new Set<(locale: Locale) => void>();

export function setLocale(locale: Locale): void {
  if (currentLocale === locale) return;
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {}
  listeners.forEach((fn) => fn(locale));
}

export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Cycle to the next supported language (convenient for 1-click header switcher)
 */
export function cycleLocale(): Locale {
  const order: Locale[] = ['th', 'en', 'ja', 'zh'];
  const idx = order.indexOf(currentLocale);
  const next = order[(idx + 1) % order.length];
  setLocale(next);
  return next;
}

/**
 * Get translation string by key with optional fallback
 */
export function t(key: string, fallback?: string): string {
  const dict = translations[currentLocale] || translations.en;
  if (dict && dict[key]) return dict[key];
  if (translations.en && translations.en[key]) return translations.en[key];
  if (translations.th && translations.th[key]) return translations.th[key];
  return fallback || key;
}

/**
 * React Hook for i18n
 */
export function useTranslation() {
  const [locale, setLocalLocale] = useState<Locale>(currentLocale);

  useEffect(() => {
    const handler = (newLocale: Locale) => setLocalLocale(newLocale);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    locale,
    setLocale,
    cycleLocale,
    t: (key: string, fallback?: string) => t(key, fallback),
    languages: SUPPORTED_LANGUAGES,
  };
}
