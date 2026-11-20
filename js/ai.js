// ==========================================
// FocusPulse - Zenith AI Context-Aware Coach, Multi-Turn System Analyzer & Interactive Controller (ai.js)
// Supports Conversational Memory, Multi-Item Collection ("add 2 habits"), Assignment Solutions,
// Natural Language System Actions, and Inline Apply (Yes/No) Confirmation Above Input
// ==========================================

let aiRequestSequence = 0;
let pendingAiAction = null;
let activeAiFlow = null;
let aiVariantCounter = 0;

// Persistent in-memory conversation context so follow-ups ("I need answers", "both", "save to notes") work naturally
const aiConversationMemory = {
    messages: [],
    lastIntent: null,
    lastTopic: null,
    lastAnswerText: ''
};

const AI_COLOR_PALETTE = [
    { key: 'violet',  label: 'Violet', nameKey: 'appearance.violet',  hex: '#8b5cf6', aliases: ['violet', 'voilet', 'purple', 'purpel', 'lavender', 'amethyst'] },
    { key: 'indigo',  label: 'Indigo', nameKey: 'appearance.indigo',  hex: '#5f5bf6', aliases: ['indigo', 'royal'] },
    { key: 'emerald', label: 'Emerald', nameKey: 'appearance.emerald', hex: '#10b981', aliases: ['emerald', 'green', 'grn', 'mint', 'forest', 'tealgreen'] },
    { key: 'orange',  label: 'Orange', nameKey: 'appearance.orange',  hex: '#f97316', aliases: ['orange', 'org', 'amber', 'tangerine', 'coral'] },
    { key: 'magenta', label: 'Magenta', nameKey: 'appearance.magenta', hex: '#d946ef', aliases: ['magenta', 'fuchsia', 'neonpink', 'hotpink'] },
    { key: 'cyan',    label: 'Cyan', nameKey: 'appearance.cyan',    hex: '#06b6d4', aliases: ['cyan', 'teal', 'aqua', 'turquoise', 'sky'] },
    { key: 'gold',    label: 'Gold', nameKey: 'appearance.gold',    hex: '#eab308', aliases: ['gold', 'yellow', 'ylw', 'mustard', 'sun'] },
    { key: 'crimson', label: 'Crimson', nameKey: 'appearance.crimson', hex: '#ef4444', aliases: ['crimson', 'red', 'scarlet', 'ruby'] },
    { key: 'blue',    label: 'Blue', nameKey: 'habits.color.blue',    hex: '#3b82f6', aliases: ['blue', 'blu', 'navy', 'cobalt', 'ocean'] },
    { key: 'rose',    label: 'Rose', nameKey: 'habits.color.rose',    hex: '#f43f5e', aliases: ['rose', 'pink', 'pnk', 'blush'] },
    { key: 'slate',   label: 'Silver / Slate', nameKey: 'appearance.silverSlate', hex: '#64748b', aliases: ['silver', 'slate', 'grey', 'gray'] }
];

const BASIC_HABITS_PRESETS = [
    { name: 'Morning Hydration (500ml)', nameKey: 'auth.morningHydration500ml', category: 'Health', color: 'blue', icon: '💧', targetPerWeek: 7 },
    { name: 'Read 20 Pages of Textbook', nameKey: 'ai.preset.read', category: 'Learning', color: 'violet', icon: '📚', targetPerWeek: 5 },
    { name: '45m Strength / Cardio', nameKey: 'ai.preset.cardio', category: 'Fitness', color: 'emerald', icon: '💪', targetPerWeek: 4 },
    { name: 'Deep Work Session (No Phone)', nameKey: 'auth.deepWorkSessionNoPhone', category: 'Productivity', color: 'amber', icon: '⚡', targetPerWeek: 5 },
    { name: '10m Evening Mindfulness', nameKey: 'setup.suggestion.mindfulness', category: 'Mindfulness', color: 'rose', icon: '🧘', targetPerWeek: 7 }
];

const EXTRA_HABITS_PRESETS = [
    { name: 'Eat a Healthy Balanced Meal', nameKey: 'ai.preset.meal', category: 'Health', color: 'emerald', icon: '🥗', targetPerWeek: 7 },
    { name: '30m Outdoor Walk / Run', nameKey: 'ai.preset.walk', category: 'Fitness', color: 'orange', icon: '🏃', targetPerWeek: 5 },
    { name: '1hr Coding / Problem Solving', nameKey: 'ai.preset.code', category: 'Learning', color: 'indigo', icon: '💻', targetPerWeek: 5 },
    { name: '8 Hours Quality Sleep', nameKey: 'ai.preset.sleep', category: 'Health', color: 'violet', icon: '💤', targetPerWeek: 7 },
    { name: '1hr Evening Digital Detox', nameKey: 'ai.preset.detox', category: 'Mindfulness', color: 'cyan', icon: '📵', targetPerWeek: 6 }
];

const ALL_HABIT_SUGGESTIONS = [...BASIC_HABITS_PRESETS, ...EXTRA_HABITS_PRESETS];

const SUGGESTED_TASK_KEYS = ['ai.preset.revision', 'ai.preset.problems', 'ai.preset.lab',
    'ai.preset.flashcards', 'ai.preset.outline', 'ai.preset.chapter'];

const SUGGESTED_COURSE_PRESETS = [
    { name: 'Biology', nameKey: 'ai.preset.biology', code: 'BI', color: '#10b981' },
    { name: 'Chemistry', nameKey: 'setup.suggestion.chemistry', code: 'CH', color: '#06b6d4' },
    { name: 'Data Structures', nameKey: 'auth.dataStructures', code: 'DS', color: '#8b5cf6' },
    { name: 'Linear Algebra', nameKey: 'ai.preset.algebra', code: 'LA', color: '#f97316' },
    { name: 'World History', nameKey: 'ai.preset.history', code: 'WH', color: '#eab308' },
    { name: 'English Literature', nameKey: 'ai.preset.literature', code: 'EL', color: '#f43f5e' }
];

function aiEntityMessage(type, plural = false) {
    return FPi18n.message('ai.entity.' + type + (plural ? 's' : ''));
}

function aiPickedName(item) {
    return item.nameKey ? FPi18n.translate(item.nameKey) : (item.name || item.title);
}

function hasAiHabitPreset(preset) {
    const names = Object.values(window.FocusPulseLocales).map(locale => locale.messages[preset.nameKey]?.toLowerCase());
    return (window.appState?.habits || []).some(habit => names.includes(habit.name.toLowerCase()));
}

function aiPickedList(items) {
    const labels = items.map(item => {
        const name = item.nameKey ? FPi18n.message(item.nameKey) : (item.name || item.title);
        return item.code ? FPi18n.message('ai.list.course', {name, code: item.code}) : name;
    });
    return labels.reduce((first, next) => FPi18n.message('ai.list.join', {first, next}));
}

function aiThemeMessage(idOrName) {
    const theme = FP_THEMES.find(t => t.id === idOrName || t.name === idOrName);
    return theme ? FPi18n.message(theme.nameKey) : idOrName;
}

function aiTimerPreset(name) {
    const keys = {Classic: 'ai.preset.classic', Extended: 'ai.preset.extended', Blitz: 'settings.preset.blitz'};
    return Object.hasOwn(keys, name) ? FPi18n.message(keys[name]) : name;
}

function aiColorMessage(color) {
    const known = AI_COLOR_PALETTE.find(c => c.hex === color.hex);
    return known ? FPi18n.message(known.nameKey) : (color.label || color.hex);
}

function pickAiVariant(variants) {
    if (!Array.isArray(variants) || variants.length === 0) return '';
    const idx = aiVariantCounter % variants.length;
    aiVariantCounter++;
    return variants[idx];
}

function saveGeminiApiKey(val) {
    window.appState.geminiApiKey = (val || '').trim();
    saveState();
    showNotification(
        FPi18n.message("settings.geminiSaved"),
        window.appState.geminiApiKey
            ? FPi18n.message("settings.geminiCustom")
            : FPi18n.message("settings.geminiDefault"),
        "success"
    );
}

// Route translated commands to the existing intent handlers. Capture names from the original input.
const aiQuickIntents = ['courses', 'habits', 'theme', 'settings', 'plan', 'priority', 'exam', 'stuck', 'progress', 'tips', 'energy', 'help'];
const viAiCommands = {
    'xin chào': 'hello', 'chào bạn': 'hello', 'chào': 'hello', 'trợ giúp': 'help',
    'giúp tôi làm bài tập': 'help me with my assignment', 'giải bài tập': 'help me with my assignment',
    'tất cả': 'all', 'cả hai': 'both', 'tôi cần lời giải': 'i need answers',
    'lưu vào ghi chú': 'save to notes', 'giải thích thêm': 'explain more',
    'ví dụ': 'give me an example', 'đồng ý': 'yes', 'có': 'yes', 'áp dụng': 'apply',
    'xác nhận': 'confirm', 'không': 'no', 'hủy': 'cancel', 'huỷ': 'cancel',
    'chế độ sáng': 'white mode', 'chế độ tối': 'dark mode', 'tắt âm báo': 'mute sound',
    'bật âm báo': 'enable sound', 'bật thông báo': 'enable notifications', 'tắt thông báo': 'disable notifications',
    'bắt đầu pomodoro': 'start pomodoro', 'tạm dừng pomodoro': 'pause pomodoro',
    'uống nước': 'log water', 'bây giờ là mấy giờ': 'current time', 'mấy giờ rồi': 'current time',
    'hôm nay là ngày bao nhiêu': 'current date', 'hôm nay là thứ mấy': 'what day is today'
};
const viEntityNames = {'công việc': 'task', 'thói quen': 'habit', 'môn học': 'course', 'kế hoạch': 'plan'};
function aiCommandInput(raw) {
    const text = raw.trim();
    const lookup = text.normalize('NFC').toLowerCase().replace(/[?!.]+$/, '').trim();
    if (Object.hasOwn(viAiCommands, lookup)) return viAiCommands[lookup];
    const messages = window.FocusPulseLocales;
    for (const intent of aiQuickIntents) {
        const key = 'ai.prompt.' + intent;
        if (lookup === messages.vi.messages[key].toLowerCase().replace(/[?!.]+$/, '')) return messages.en.messages[key];
    }
    const multi = /^(?:thêm|tạo)\s+(\d+)\s+(thói quen|công việc|môn học)(?=\s|:|$)(.*)$/iu.exec(text);
    if (multi) return 'add ' + multi[1] + ' ' + viEntityNames[multi[2].toLowerCase()] + 's' + multi[3];
    const named = /^(thêm|tạo|xóa|xoá|hoàn thành|ghi nhận)\s+(công việc|thói quen|môn học|kế hoạch)(?=\s|:|$)\s*:?\s*(.*)$/iu.exec(text);
    if (named) {
        const verbs = {'thêm': 'add', 'tạo': 'add', 'xóa': 'delete', 'xoá': 'delete', 'hoàn thành': 'complete', 'ghi nhận': 'log'};
        return verbs[named[1].toLowerCase()] + ' ' + viEntityNames[named[2].toLowerCase()] + (named[3] ? ': ' + named[3] : '');
    }
    return text.replace(/^đặt mục tiêu (?:uống )?nước\s*:?\s*/iu, 'set water goal to ')
        .replace(/^đặt dung tích ly\s*:?\s*/iu, 'set glass size to ')
        .replace(/^đặt pomodoro\s*:?\s*(\d+)\s*phút$/iu, 'set pomodoro to $1 mins');
}

// Normalize typos in user commands (including "Hello me with..." -> "help me with...", "adddd" -> "add", etc.)
function normalizeAiCommandText(raw) {
    const text = aiCommandInput(String(raw || ''));
    if (/^(?:add|create|delete|complete|log)\s+(?:\d+\s+)?(?:tasks?|habits?|courses?|plans?)\s*:/i.test(text)) return text;
    return text
        .replace(/^h+e+l+o+\s+me\b/i, 'help me')
        .replace(/\bh+l+p+\s+me\b/gi, 'help me')
        .replace(/\ba+s+i+g*n*m+e*n+t+(s?)\b/gi, 'assignment$1')
        .replace(/\ba+d{2,}\b/gi, 'add')
        .replace(/\be+d+i+t+\b/gi, 'edit')
        .replace(/\bc+h+a*n+g+e*\b/gi, 'change')
        .replace(/\bc+r+e+a+t+e*\b/gi, 'create')
        .replace(/\bd+e+l+e+t+e*\b/gi, 'delete')
        .replace(/\br+e+m+o+v+e*\b/gi, 'remove')
        .replace(/\bh+a+b+i+t+(s?)\b/gi, 'habit$1')
        .replace(/\bt+a+s+k+(s?)\b/gi, 'task$1')
        .replace(/\bc+o+u*r+[cs]+e*(s?)\b/gi, 'course$1')
        .replace(/\bc+o+l+o*u*r+(s?)\b/gi, 'color$1')
        .replace(/\bt+h+e+m+e*(s?)\b/gi, 'theme$1')
        .replace(/\bs+e+t+i+n+g*(s?)\b/gi, 'setting$1')
        .replace(/\bv+o+i+l+e+t+\b/gi, 'violet')
        .replace(/\bp+u+r+p+e+l+\b/gi, 'purple')
        .replace(/\s+/g, ' ')
        .trim();
}

// Parse number words or digits in requests like "Add a new two habits", "add 3 tasks", "add a couple of habits"
function extractRequestedItemCount(normText) {
    const wordMap = {
        'one': 1, 'a': 1, 'an': 1, 'single': 1,
        'two': 2, 'couple': 2, 'both': 2,
        'three': 3, 'few': 3,
        'four': 4,
        'five': 5,
        'six': 6,
        'seven': 7,
        'eight': 8,
        'nine': 9,
        'ten': 10
    };
    // Explicit digit (e.g. "add 2 habits", "add a new 3 habits")
    const digitMatch = normText.match(/\b(?:add|create|new|make)\s+(?:a\s+|new\s+|my\s+)*(\d+)\s+(?:new\s+|more\s+|custom\s+)?(?:habits?|tasks?|courses?)\b/i);
    if (digitMatch) {
        const n = parseInt(digitMatch[1], 10);
        if (n >= 1 && n <= 10) return n;
    }
    // Number word (e.g. "Add a new two habits", "add two new habits", "create three tasks")
    const wordMatch = normText.match(/\b(?:add|create|new|make)\s+(?:a\s+|new\s+|my\s+)*(one|two|three|four|five|six|seven|eight|nine|ten|couple|few|both)(?:\s+of)?\s+(?:new\s+|more\s+|custom\s+)?(?:habits?|tasks?|courses?)\b/i);
    if (wordMatch) {
        const w = wordMatch[1].toLowerCase();
        if (wordMap[w]) return wordMap[w];
    }
    return null;
}

function resolveAiColor(inputStr) {
    if (!inputStr) return null;
    const lower = normalizeAiCommandText(inputStr).toLowerCase();
    const hexMatch = lower.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i);
    if (hexMatch) {
        return { key: 'custom', label: hexMatch[0].toUpperCase(), hex: hexMatch[0] };
    }
    for (const col of AI_COLOR_PALETTE) {
        if (FPi18n.translate(col.nameKey).toLowerCase() === lower) return col;
        for (const alias of col.aliases) {
            const re = new RegExp(`\\b${alias}\\b`, 'i');
            if (re.test(lower)) {
                return col;
            }
        }
    }
    return null;
}

function getColorLabelByHex(hex) {
    if (!hex) return FPi18n.message('appearance.indigo');
    const found = AI_COLOR_PALETTE.find(c => c.hex.toLowerCase() === String(hex).toLowerCase());
    return found ? FPi18n.message('appearance.accentSwatch', {color: FPi18n.message(found.nameKey), hex: found.hex}) : hex;
}

function findCourseFromText(queryStr) {
    const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
    if (!queryStr || courses.length === 0) return null;
    const clean = queryStr.trim();
    const lower = clean.toLowerCase();

    if (/^\d+$/.test(clean)) {
        const idx = parseInt(clean, 10) - 1;
        if (idx >= 0 && idx < courses.length) return courses[idx];
    }

    const exact = courses.find(c =>
        c.name.toLowerCase() === lower ||
        (c.code && c.code.toLowerCase() === lower)
    );
    if (exact) return exact;

    const partial = courses.find(c =>
        lower.includes(c.name.toLowerCase()) ||
        c.name.toLowerCase().includes(lower) ||
        (c.code && new RegExp(`\\b${c.code.toLowerCase()}\\b`).test(lower))
    );
    return partial || null;
}

function findTaskFromText(queryStr) {
    const tasks = (window.appState && Array.isArray(window.appState.tasks)) ? window.appState.tasks : [];
    const pending = tasks.filter(t => !t.completed);
    const pool = pending.length > 0 ? pending : tasks;
    if (!queryStr || pool.length === 0) return null;
    const clean = queryStr.trim();
    const lower = clean.toLowerCase();

    if (/^\d+$/.test(clean)) {
        const idx = parseInt(clean, 10) - 1;
        if (idx >= 0 && idx < pool.length) return pool[idx];
    }
    if (/^(?:first|1st|top|one)\b/i.test(lower)) return pool[0];
    if (/^(?:second|2nd|two)\b/i.test(lower) && pool[1]) return pool[1];
    if (/^(?:third|3rd|three)\b/i.test(lower) && pool[2]) return pool[2];

    const exact = pool.find(t => t.title.toLowerCase() === lower);
    if (exact) return exact;

    // Match by course or keywords (e.g. "physics", "optics", "calculus", "integration", "cs101", "binary tree")
    const words = lower.split(/\s+/).filter(w => w.length >= 3 && !['the', 'and', 'for', 'with', 'assignment', 'homework', 'task', 'help', 'answer', 'answers', 'need'].includes(w));
    for (const t of pool) {
        const hay = `${t.title} ${t.course || ''} ${t.description || ''}`.toLowerCase();
        if (hay.includes(lower) || words.some(w => hay.includes(w))) {
            return t;
        }
    }
    return null;
}

function recordConversationTurn(role, text, intent = null, topic = null) {
    aiConversationMemory.messages.push({
        role,
        text: String(text || ''),
        intent,
        timestamp: Date.now()
    });
    if (aiConversationMemory.messages.length > 24) {
        aiConversationMemory.messages.shift();
    }
    if (intent) aiConversationMemory.lastIntent = intent;
    if (topic) aiConversationMemory.lastTopic = topic;
    if (role === 'ai' && text) {
        aiConversationMemory.lastAnswerText = String(text);
    }
}

function appendUserChatBubble(text) {
    recordConversationTurn('user', text);
    const history = document.getElementById('ai-chat-history');
    if (!history) return;
    history.insertAdjacentHTML('beforeend', `
        <div class="flex justify-end">
            <div class="v-accent-btn bg-indigo-600 text-white p-2.5 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm font-medium">${escapeHtml(text)}</div>
        </div>
    `);
    history.scrollTop = history.scrollHeight;
}

function appendAiChatBubble(replyText, isSuccessAction = false, intentTag = null) {
    replyText = FPi18n.resolve(replyText);
    recordConversationTurn('ai', replyText, intentTag);
    const history = document.getElementById('ai-chat-history');
    if (!history) return;
    // Use inline span styling for backtick commands so they never break onto awkward vertical lines
    const formattedHtml = escapeHtml(replyText)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<span class="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-mono text-[10px]" style="display:inline-block;white-space:nowrap;">$1</span>')
        .replace(/\n/g, '<br>');

    if (isSuccessAction) {
        history.insertAdjacentHTML('beforeend', `
            <div class="flex gap-2">
                <div class="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5"><i class="fa-solid fa-check text-[10px]"></i></div>
                <div class="bg-emerald-500/15 border border-emerald-500/30 p-2.5 rounded-2xl rounded-tl-none max-w-[88%] text-emerald-900 dark:text-emerald-200 font-semibold leading-relaxed">${formattedHtml}</div>
            </div>
        `);
    } else {
        history.insertAdjacentHTML('beforeend', `
            <div class="flex gap-2">
                <div class="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5" style="color:var(--v-accent)">
                    <i class="fa-solid fa-robot text-[10px]"></i>
                </div>
                <div class="bg-white/70 dark:bg-white/10 border border-white/60 dark:border-white/10 p-3 rounded-2xl rounded-tl-none max-w-[88%] text-slate-900 dark:text-slate-100 font-medium leading-relaxed shadow-sm">${formattedHtml}</div>
            </div>
        `);
    }
    history.scrollTop = history.scrollHeight;
}

function hideAiInlinePopupTray() {
    const tray = document.getElementById('ai-inline-popup-tray');
    if (tray) {
        tray.classList.add('hidden');
        tray.innerHTML = '';
    }
    const modal = document.getElementById('ai-confirm-modal');
    if (modal) modal.classList.add('hidden');
}

function dismissAiInteractiveFlow() {
    activeAiFlow = null;
    pendingAiAction = null;
    hideAiInlinePopupTray();
}

// Render the inline "Apply (Yes) / No" confirmation popup directly above #ai-chat-input
function stageAiPendingAction(actionCmd, chatNote) {
    pendingAiAction = actionCmd;
    if (chatNote) {
        appendAiChatBubble(chatNote, false, 'confirm_action');
    }

    const modal = document.getElementById('ai-confirm-modal');
    if (modal) modal.classList.add('hidden');

    const tray = document.getElementById('ai-inline-popup-tray');
    if (!tray) return;

    let badgeHtml = `<div class="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-500 flex items-center justify-center shrink-0 text-xs"><i class="fa-solid fa-wand-magic-sparkles"></i></div>`;
    if (actionCmd.previewBadge) {
        const col = actionCmd.previewBadge.color || '#8b5cf6';
        const code = (actionCmd.previewBadge.code || 'CR').slice(0, 2).toUpperCase();
        badgeHtml = `<div class="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black uppercase shrink-0 shadow-sm" style="background:${col}24;color:${col};border:1.5px solid ${col}66;">${escapeHtml(code)}</div>`;
    } else if (actionCmd.previewColor) {
        badgeHtml = `<div class="w-8 h-8 rounded-xl shrink-0 shadow-sm border border-white/30" style="background:${actionCmd.previewColor};"></div>`;
    }

    tray.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div class="flex items-center gap-2.5 min-w-0">
                ${badgeHtml}
                <div class="min-w-0">
                    <p class="text-[10px] font-extrabold uppercase tracking-wider text-violet-500 dark:text-violet-400"><span data-i18n="ai.ui.change">Confirm Change</span></p>
                    <p id="ai-inline-confirm-text" class="text-xs font-bold text-slate-900 dark:text-white leading-snug break-words">${FPi18n.messageHtml(actionCmd.summary)}</p>
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button type="button" onclick="cancelAiAction()" class="px-3.5 py-1.5 rounded-xl bg-white/70 dark:bg-white/10 hover:bg-rose-500/15 hover:text-rose-500 text-slate-800 dark:text-slate-200 text-xs font-extrabold transition border border-white/40 dark:border-white/10"><span data-i18n="ai.ui.no">No</span></button>
                <button type="button" onclick="confirmAiAction()" class="v-accent-btn px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition shadow-md flex items-center gap-1.5">
                    <i class="fa-solid fa-check text-[10px]"></i>
                    <span><span data-i18n="ai.ui.apply">Apply (Yes)</span></span>
                </button>
            </div>
        </div>
    `;
    tray.classList.remove('hidden');
}

// Render interactive multi-step selector popups directly above #ai-chat-input
function renderAiFlowPopup() {
    const tray = document.getElementById('ai-inline-popup-tray');
    if (!tray) return;
    if (!activeAiFlow) {
        hideAiInlinePopupTray();
        return;
    }

    // Multi-item collection popup (e.g. "Add a new two habits", "add 3 tasks", "add 2 courses")
    if (activeAiFlow.step === 'collect_multiple_items') {
        const { entityType, targetCount, collected } = activeAiFlow;
        const remaining = Math.max(0, targetCount - collected.length);

        let candidateButtons = '';
        if (entityType === 'habit') {
            candidateButtons = ALL_HABIT_SUGGESTIONS.map((h, i) => {
                const isPicked = collected.some(item => item.name.toLowerCase() === h.name.toLowerCase());
                return `
                    <button type="button" onclick="handleAiMultiItemPick(${i})"
                        class="px-2.5 py-1 rounded-xl border text-[11px] font-bold transition flex items-center gap-1.5 ${isPicked ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm' : 'bg-white/70 dark:bg-white/10 hover:bg-indigo-500/20 border-white/40 dark:border-white/10'}">
                        <span>${isPicked ? '✓' : h.icon}</span>
                        <span>${FPi18n.markup(h.nameKey)}</span>
                    </button>
                `;
            }).join('');
        } else if (entityType === 'task') {
            candidateButtons = SUGGESTED_TASK_KEYS.map((nameKey, i) => {
                const title = FPi18n.translate(nameKey);
                const isPicked = collected.some(item => item.nameKey === nameKey || item.title.toLowerCase() === title.toLowerCase());
                return `
                    <button type="button" onclick="handleAiMultiItemPick(${i})"
                        class="px-2.5 py-1 rounded-xl border text-[11px] font-bold transition flex items-center gap-1.5 ${isPicked ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm' : 'bg-white/70 dark:bg-white/10 hover:bg-indigo-500/20 border-white/40 dark:border-white/10'}">
                        <span>${isPicked ? '✓' : '📌'}</span>
                        <span>${FPi18n.markup(nameKey)}</span>
                    </button>
                `;
            }).join('');
        } else if (entityType === 'course') {
            candidateButtons = SUGGESTED_COURSE_PRESETS.map((c, i) => {
                const isPicked = collected.some(item => item.name.toLowerCase() === c.name.toLowerCase());
                return `
                    <button type="button" onclick="handleAiMultiItemPick(${i})"
                        class="px-2.5 py-1 rounded-xl border text-[11px] font-bold transition flex items-center gap-1.5 ${isPicked ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm' : 'bg-white/70 dark:bg-white/10 hover:bg-indigo-500/20 border-white/40 dark:border-white/10'}">
                        <span>${isPicked ? '✓' : '🎓'}</span>
                        <span>${FPi18n.markup(c.nameKey)} [${c.code}]</span>
                    </button>
                `;
            }).join('');
        }

        const selectedSummary = collected.length > 0
            ? `<div class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">${FPi18n.markup('ai.ui.selected', {count: collected.length, total: targetCount, items: aiPickedList(collected)})}</div>`
            : `<div class="text-[11px] font-medium text-slate-500 dark:text-slate-400">${FPi18n.markup('ai.ui.more', {count: remaining})}</div>`;

        tray.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                        <i class="fa-solid fa-list-check"></i> ${FPi18n.markup('ai.ui.selectCount', {count: targetCount, type: aiEntityMessage(entityType, true), remaining})}
                    </span>
                    <div class="flex items-center gap-1.5">
                        ${collected.length > 0 ? `<button type="button" onclick="finalizeMultiItemCollection()" class="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-extrabold">${FPi18n.markup('ai.ui.review', {count: collected.length})}</button>` : ''}
                        <button type="button" onclick="dismissAiInteractiveFlow()" aria-label="Close" data-i18n-aria-label="nav.close" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>
                ${selectedSummary}
                <div class="flex flex-wrap gap-1.5">
                    ${candidateButtons}
                </div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    // Assignment selector popup ("Hello me with my assignment" / "Help me with my assignment")
    if (activeAiFlow.step === 'select_assignment') {
        const pendingTasks = ((window.appState && window.appState.tasks) || []).filter(t => !t.completed);
        const taskButtons = pendingTasks.slice(0, 5).map((t, idx) => `
            <button type="button" onclick="handleAiAssignmentPick(${idx})"
                class="px-2.5 py-1.5 rounded-xl bg-white/75 dark:bg-white/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-[11px] font-bold transition flex items-center gap-1.5 text-left">
                <span class="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-[9px] font-black">${FPi18n.messageHtml(t.course || FPi18n.message('ai.study.task'))}</span>
                <span>${FPi18n.messageHtml(taskTitleMessage(t))}</span>
            </button>
        `).join('');

        tray.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5">
                        <i class="fa-solid fa-book-open-reader"></i> <span data-i18n="ai.ui.pickAssignment">Select an Assignment for Direct Answers & Solutions</span>
                    </span>
                    <button type="button" onclick="dismissAiInteractiveFlow()" aria-label="Close" data-i18n-aria-label="nav.close" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    ${pendingTasks.length > 1 ? `
                        <button type="button" onclick="handleAiAssignmentPick('all')"
                            class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition shadow-sm">
                            ${FPi18n.markup('ai.ui.solveAll', {count: pendingTasks.length})}
                        </button>
                    ` : ''}
                    ${taskButtons}
                </div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    // Post-answer follow-up action bar (Save solution to Quick Study Notes or Mark Assignment Complete)
    if (activeAiFlow.step === 'post_assignment_actions') {
        const taskObj = activeAiFlow.taskId
            ? ((window.appState.tasks || []).find(t => t.id === activeAiFlow.taskId))
            : null;
        tray.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                    <i class="fa-solid fa-lightbulb"></i> <span data-i18n="ai.ui.useSolution">Apply Solution to Workspace:</span>
                </span>
                <div class="flex flex-wrap items-center gap-1.5">
                    <button type="button" onclick="handleAiSaveAnswerToNotes()" class="px-2.5 py-1 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold transition">
                        <span data-i18n="ai.ui.saveSolution">📝 Save to Quick Study Notes</span>
                    </button>
                    ${taskObj && !taskObj.completed ? `
                        <button type="button" onclick="handleAiCompleteAssignmentTask('${escapeHtml(taskObj.id)}')" class="px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold transition">
                            ${FPi18n.markup('ai.ui.markDone', {title: taskTitleMessage(taskObj)})}
                        </button>
                    ` : ''}
                    <button type="button" onclick="dismissAiInteractiveFlow()" aria-label="Close" data-i18n-aria-label="nav.close" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    if (activeAiFlow.step === 'select_course') {
        const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
        const courseButtons = courses.map(c => {
            const col = c.color || '#5f5bf6';
            const code = (c.code || c.name.slice(0, 2)).slice(0, 2).toUpperCase();
            return `
                <button type="button" onclick="handleAiCourseSelectClick('${escapeHtml(c.id)}')"
                    class="px-2.5 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition hover:scale-[1.02]"
                    style="background:${col}15;border-color:${col}55;color:var(--v-fg);">
                    <span class="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black uppercase" style="background:${col}30;color:${col};">${escapeHtml(code)}</span>
                    <span>${escapeHtml(c.name)}</span>
                </button>
            `;
        }).join('');

        tray.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5">
                        <i class="fa-solid fa-graduation-cap"></i> <span data-i18n="ai.ui.pickCourse">Select a Course to Edit (or type course name below)</span>
                    </span>
                    <button type="button" onclick="dismissAiInteractiveFlow()" aria-label="Close" data-i18n-aria-label="nav.close" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    ${courseButtons}
                    <button type="button" onclick="handleAiStartAddNewCourse()" class="px-2.5 py-1.5 rounded-xl border border-dashed border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-bold transition flex items-center gap-1">
                        <i class="fa-solid fa-plus text-[10px]"></i> <span data-i18n="ai.ui.addCourse">Add Course</span>
                    </button>
                </div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    if (activeAiFlow.step === 'select_course_edit') {
        const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
        const course = courses.find(c => c.id === activeAiFlow.courseId);
        if (!course) {
            dismissAiInteractiveFlow();
            return;
        }
        const col = course.color || '#5f5bf6';
        const code = (course.code || course.name.slice(0, 2)).slice(0, 2).toUpperCase();

        const colorPills = AI_COLOR_PALETTE.slice(0, 10).map(item => `
            <button type="button" onclick="handleAiCourseColorPick('${item.key}')"
                class="px-2 py-1 rounded-lg border flex items-center gap-1.5 text-[11px] font-bold transition hover:scale-105"
                style="background:${item.hex}18;border-color:${item.hex}66;color:var(--v-fg);"
                ${FPi18n.attributeMarkup('title', 'ai.ui.colorTip', {color: aiColorMessage(item)})}>
                <span class="w-3 h-3 rounded-full shrink-0" style="background:${item.hex};"></span>
                <span>${FPi18n.messageHtml(aiColorMessage(item))}</span>
            </button>
        `).join('');

        tray.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <span class="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black uppercase" style="background:${col}28;color:${col};border:1px solid ${col}66;">${escapeHtml(code)}</span>
                        <span class="text-xs font-extrabold text-slate-900 dark:text-white">${FPi18n.markup('ai.ui.editing', {name: course.name})}</span>
                    </div>
                    <button type="button" onclick="dismissAiInteractiveFlow()" aria-label="Close" data-i18n-aria-label="nav.close" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    ${colorPills}
                </div>
                <div class="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/20 dark:border-white/10">
                    <button type="button" onclick="handleAiCourseEditModePick('name')" class="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold transition"><span data-i18n="ai.ui.changeName">✏️ Change Name</span></button>
                    <button type="button" onclick="handleAiCourseEditModePick('code')" class="px-2.5 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-700 dark:text-violet-300 text-[11px] font-bold transition"><span data-i18n="ai.ui.changeCode">🔤 Change 2-Letter Code</span></button>
                    <button type="button" onclick="handleAiCourseEditModePick('delete')" class="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 text-[11px] font-bold transition"><span data-i18n="ai.ui.deleteCourse">🗑️ Delete Course</span></button>
                </div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    if (activeAiFlow.step === 'await_course_name' || activeAiFlow.step === 'await_course_code' || activeAiFlow.step === 'await_new_course_name') {
        const labelMap = {await_course_name: 'ai.ui.newName', await_course_code: 'ai.ui.newCode',
            await_new_course_name: 'ai.ui.newCourse'};
        tray.innerHTML = `
            <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-indigo-600 dark:text-indigo-300 flex items-center gap-2">
                    <i class="fa-solid fa-keyboard"></i> ${FPi18n.markup(labelMap[activeAiFlow.step], {name: activeAiFlow.courseName})}
                </span>
                <button type="button" onclick="dismissAiInteractiveFlow()" class="px-2.5 py-1 rounded-lg bg-white/60 dark:bg-white/10 text-[11px] font-bold">${FPi18n.markup('account.cancel')}</button>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    if (activeAiFlow.step === 'select_theme') {
        const themePills = (typeof FP_THEMES !== 'undefined' ? FP_THEMES : []).map(t => `
            <button type="button" onclick="handleAiThemePick('solid', '${t.id}')"
                class="px-2.5 py-1 rounded-lg border flex items-center gap-1.5 text-[11px] font-bold transition hover:scale-105"
                style="background:var(--v-bg3);border-color:var(--v-bdr2);color:var(--v-fg);">
                <span class="w-3 h-3 rounded-full border border-white/30" style="background:${t.bg === '#ffffff' ? '#e2e8f0' : t.accent};"></span>
                <span>${FPi18n.markup(t.nameKey)}</span>
            </button>
        `).join('');

        const accentSwatches = AI_COLOR_PALETTE.slice(0, 9).map(col => `
            <button type="button" onclick="handleAiThemePick('accent', '${col.key}')"
                class="px-2 py-1 rounded-lg border flex items-center gap-1 text-[10px] font-bold transition hover:scale-105"
                style="background:${col.hex}18;border-color:${col.hex}66;color:var(--v-fg);">
                <span class="w-2.5 h-2.5 rounded-full" style="background:${col.hex};"></span>
                <span>${FPi18n.messageHtml(aiColorMessage(col))}</span>
            </button>
        `).join('');

        tray.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-fuchsia-500 dark:text-fuchsia-400 flex items-center gap-1.5">
                        <i class="fa-solid fa-palette"></i> <span data-i18n="ai.ui.pickTheme">Choose a Theme, Surface Mode, or Accent Colour</span>
                    </span>
                    <button type="button" onclick="dismissAiInteractiveFlow()" aria-label="Close" data-i18n-aria-label="nav.close" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="flex flex-wrap gap-1.5">${themePills}</div>
                <div class="flex flex-wrap gap-1.5 pt-1 border-t border-white/20 dark:border-white/10">
                    <button type="button" onclick="handleAiThemePick('surface', 'dark')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-white text-[11px] font-bold"><span data-i18n="ai.ui.dark">🌙 Dark Mode</span></button>
                    <button type="button" onclick="handleAiThemePick('surface', 'light')" class="px-2.5 py-1 rounded-lg bg-white text-slate-900 border border-slate-300 text-[11px] font-bold"><span data-i18n="ai.ui.light">☀️ White Mode</span></button>
                    <button type="button" onclick="handleAiThemePick('liquid', 'toggle')" class="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-[11px] font-bold"><span data-i18n="ai.ui.glass">✨ Toggle Liquid Glass</span></button>
                </div>
                <div class="flex flex-wrap gap-1 pt-1 border-t border-white/20 dark:border-white/10">${accentSwatches}</div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    if (activeAiFlow.step === 'select_habit') {
        const missingBasicCount = BASIC_HABITS_PRESETS.filter(preset => !hasAiHabitPreset(preset)).length;

        const presetButtons = ALL_HABIT_SUGGESTIONS.map((h, i) => `
            <button type="button" onclick="handleAiPresetHabitPick(${i})"
                class="px-2.5 py-1 rounded-xl bg-white/70 dark:bg-white/10 hover:bg-indigo-500/20 border border-white/40 dark:border-white/10 text-[11px] font-bold transition flex items-center gap-1.5">
                <span>${h.icon}</span>
                <span>${FPi18n.markup(h.nameKey)}</span>
            </button>
        `).join('');

        tray.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                        <i class="fa-solid fa-fire"></i> <span data-i18n="ai.ui.pickHabit">Pick a Habit to Add or Type Custom Habit(s) Below</span>
                    </span>
                    <button type="button" onclick="dismissAiInteractiveFlow()" aria-label="Close" data-i18n-aria-label="nav.close" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    ${missingBasicCount > 0 ? `
                        <button type="button" onclick="handleAiAddAllBasicHabitsPick()" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition shadow-sm">
                            <span data-i18n="ai.ui.addBasic">✨ Add 5 Core Basic Habits</span>
                        </button>
                    ` : `
                        <button type="button" onclick="handleAiAddAllExtraHabitsPick()" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition shadow-sm">
                            <span data-i18n="ai.ui.addExtra">🚀 Add 5 Extra Starter Habits</span>
                        </button>
                        <button type="button" onclick="handleAiAddAllBasicHabitsPick()" class="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold transition">
                            <span data-i18n="ai.ui.resetCore">🔄 Check the 5 core habits</span>
                        </button>
                    `}
                    ${presetButtons}
                </div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }

    if (activeAiFlow.step === 'select_setting') {
        tray.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-cyan-500 flex items-center gap-1.5">
                        <i class="fa-solid fa-sliders"></i> <span data-i18n="ai.ui.quickSettings">Quick Settings (Click Any Option to Confirm & Apply)</span>
                    </span>
                    <button type="button" onclick="dismissAiInteractiveFlow()" aria-label="Close" data-i18n-aria-label="nav.close" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1.5"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    <button type="button" onclick="handleAiSettingPick('pomo_classic')" class="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold"><span data-i18n="ai.ui.classic">⏱️ Classic (25/5m)</span></button>
                    <button type="button" onclick="handleAiSettingPick('pomo_extended')" class="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold"><span data-i18n="ai.ui.extended">⏱️ Extended (50/10m)</span></button>
                    <button type="button" onclick="handleAiSettingPick('pomo_blitz')" class="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold"><span data-i18n="ai.ui.blitz">⏱️ Blitz (15/3m)</span></button>
                    <button type="button" onclick="handleAiSettingPick('water_2500')" class="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 text-[11px] font-bold"><span data-i18n="ai.ui.waterSmall">💧 Goal 2500ml</span></button>
                    <button type="button" onclick="handleAiSettingPick('water_3000')" class="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 text-[11px] font-bold"><span data-i18n="ai.ui.waterLarge">💧 Goal 3000ml</span></button>
                    <button type="button" onclick="handleAiSettingPick('toggle_perf')" class="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 text-[11px] font-bold"><span data-i18n="ai.ui.performance">⚡ Performance Mode</span></button>
                    <button type="button" onclick="handleAiSettingPick('toggle_liquid')" class="px-2.5 py-1 rounded-lg bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-700 dark:text-fuchsia-300 text-[11px] font-bold"><span data-i18n="ai.ui.liquid">✨ Liquid Glass</span></button>
                    <button type="button" onclick="handleAiSettingPick('toggle_sound')" class="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold"><span data-i18n="ai.ui.sound">🔊 Toggle Sound</span></button>
                    <button type="button" onclick="handleAiSettingPick('toggle_notif')" class="px-2.5 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-700 dark:text-violet-300 text-[11px] font-bold"><span data-i18n="ai.ui.alerts">🔔 Toggle Alerts</span></button>
                </div>
            </div>
        `;
        tray.classList.remove('hidden');
        return;
    }
}

// Multi-item picker handler (when user asked to add N habits/tasks/courses)
function handleAiMultiItemPick(index) {
    if (!activeAiFlow || activeAiFlow.step !== 'collect_multiple_items') return;
    const { entityType, targetCount, collected } = activeAiFlow;

    if (entityType === 'habit') {
        const candidate = ALL_HABIT_SUGGESTIONS[index];
        if (!candidate) return;
        const existingIdx = collected.findIndex(x => x.name.toLowerCase() === candidate.name.toLowerCase());
        if (existingIdx >= 0) {
            collected.splice(existingIdx, 1);
        } else {
            collected.push({ ...candidate });
        }
    } else if (entityType === 'task') {
        const nameKey = SUGGESTED_TASK_KEYS[index];
        if (!nameKey) return;
        const title = FPi18n.translate(nameKey);
        const existingIdx = collected.findIndex(x => x.nameKey === nameKey || x.title.toLowerCase() === title.toLowerCase());
        if (existingIdx >= 0) {
            collected.splice(existingIdx, 1);
        } else {
            collected.push({title, nameKey});
        }
    } else if (entityType === 'course') {
        const c = SUGGESTED_COURSE_PRESETS[index];
        if (!c) return;
        const existingIdx = collected.findIndex(x => x.name.toLowerCase() === c.name.toLowerCase());
        if (existingIdx >= 0) {
            collected.splice(existingIdx, 1);
        } else {
            collected.push({ ...c });
        }
    }

    if (collected.length >= targetCount) {
        finalizeMultiItemCollection();
    } else {
        renderAiFlowPopup();
    }
}

function finalizeMultiItemCollection() {
    if (!activeAiFlow || activeAiFlow.step !== 'collect_multiple_items') return;
    const { entityType, collected } = activeAiFlow;
    if (!collected || collected.length === 0) return;

    activeAiFlow = null;
    if (entityType === 'habit') {
        const namesList = aiPickedList(collected);
        stageAiPendingAction(
            {
                type: 'add_multiple_habits',
                items: collected,
                summary: FPi18n.message('ai.summary.habits', {count: collected.length, names: namesList})
            },
            FPi18n.message('ai.review.habits', {count: collected.length, names: namesList})
        );
    } else if (entityType === 'task') {
        const namesList = aiPickedList(collected);
        stageAiPendingAction(
            {
                type: 'add_multiple_tasks',
                items: collected,
                summary: FPi18n.message('ai.summary.tasks', {count: collected.length, names: namesList})
            },
            FPi18n.message('ai.review.tasks', {count: collected.length, names: namesList})
        );
    } else if (entityType === 'course') {
        const namesList = aiPickedList(collected);
        stageAiPendingAction(
            {
                type: 'add_multiple_courses',
                items: collected,
                summary: FPi18n.message('ai.summary.courses', {count: collected.length, names: namesList})
            },
            FPi18n.message('ai.review.courses', {count: collected.length, names: namesList})
        );
    }
}

// Generate direct, substantive academic solutions for a user's assignment or task
function buildAssignmentSolutionText(taskObj) {
    if (!taskObj) return '';
    const title = FPi18n.resolve(taskTitleMessage(taskObj)) || FPi18n.translate('ai.study.assignment');
    const lower = `${title} ${taskObj.course || ''} ${taskObj.description || ''}`.toLowerCase();

    if (/optics|physics|refraction|snell|prism|quang học|vật l[ýí]|khúc xạ|lăng kính/u.test(lower)) {
        return FPi18n.translate('ai.study.optics', {title, course: taskObj.course || FPi18n.message('setup.suggestion.physics')});
    }

    if (/calculus|integration|integral|by parts|substitution|giải tích|tích phân/u.test(lower)) {
        return FPi18n.translate('ai.study.calculus', {title, course: taskObj.course || FPi18n.message('ai.study.calculusSubject')});
    }

    if (/binary tree|avl|red-black|cs101|data structure|cây nhị phân|cấu trúc dữ liệu/u.test(lower)) {
        return FPi18n.translate('ai.study.trees', {title, course: taskObj.course || 'CS101'});
    }

    return FPi18n.translate('ai.study.guide', {title, course: taskObj.course || FPi18n.message('ai.study.task'), notes: taskObj.description ? FPi18n.translate('ai.study.notes', {notes: taskObj.description}) : ''});
}

function handleAiAssignmentPick(idxOrAll) {
    const pendingTasks = ((window.appState && window.appState.tasks) || []).filter(t => !t.completed);
    if (idxOrAll === 'all') {
        appendUserChatBubble(FPi18n.translate('ai.study.solveAll'));
        if (pendingTasks.length === 0) {
            dismissAiInteractiveFlow();
            appendAiChatBubble(FPi18n.message('ai.study.noPending'), false, 'study_answer');
            return;
        }
        const combinedSolutions = pendingTasks.slice(0, 4).map(t => buildAssignmentSolutionText(t)).join('\n\n');
        activeAiFlow = { step: 'post_assignment_actions', taskId: pendingTasks[0].id };
        appendAiChatBubble(combinedSolutions, false, 'study_answer');
        renderAiFlowPopup();
        return;
    }

    const chosen = pendingTasks[idxOrAll];
    if (!chosen) return;
    appendUserChatBubble(chosen.title);
    const ans = buildAssignmentSolutionText(chosen);
    activeAiFlow = { step: 'post_assignment_actions', taskId: chosen.id };
    appendAiChatBubble(ans, false, 'study_answer');
    renderAiFlowPopup();
}

function handleAiSaveAnswerToNotes() {
    const cleanText = (aiConversationMemory.lastAnswerText || '').replace(/\*\*/g, '').trim();
    if (!cleanText) return;
    activeAiFlow = null;
    stageAiPendingAction(
        {
            type: 'append_study_notes',
            noteText: cleanText,
            summary: FPi18n.message('ai.summary.saveSolution')
        },
        FPi18n.message('ai.review.saveNotes')
    );
}

function handleAiCompleteAssignmentTask(taskId) {
    const taskObj = ((window.appState && window.appState.tasks) || []).find(t => t.id === taskId);
    if (!taskObj) return;
    activeAiFlow = null;
    stageAiPendingAction(
        {
            type: 'complete_task',
            query: taskObj.title,
            summary: FPi18n.message('ai.summary.finishAssignment', {title: taskObj.title})
        },
        FPi18n.message('ai.review.finishTask', {title: taskObj.title})
    );
}

// Handlers for clicking popup options above the typefield
function handleAiCourseSelectClick(courseId) {
    const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    appendUserChatBubble(course.name);
    activeAiFlow = { step: 'select_course_edit', courseId: course.id, courseName: course.name };
    const code = (course.code || course.name.slice(0, 2)).slice(0, 2).toUpperCase();
    appendAiChatBubble(
        FPi18n.message('ai.course.selected', {code, name: course.name, color: getColorLabelByHex(course.color)}),
        false,
        'course_flow'
    );
    renderAiFlowPopup();
}

function handleAiStartAddNewCourse() {
    activeAiFlow = { step: 'await_new_course_name' };
    appendAiChatBubble(FPi18n.message('ai.course.askName'), false, 'course_flow');
    renderAiFlowPopup();
    const input = document.getElementById('ai-chat-input');
    if (input) input.focus();
}

function handleAiCourseColorPick(colorKey) {
    if (!activeAiFlow || !activeAiFlow.courseId) return;
    const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
    const course = courses.find(c => c.id === activeAiFlow.courseId);
    const colObj = AI_COLOR_PALETTE.find(c => c.key === colorKey);
    if (!course || !colObj) return;
    const code = (course.code || course.name.slice(0, 2)).slice(0, 2).toUpperCase();
    activeAiFlow = null;
    stageAiPendingAction(
        {
            type: 'edit_course',
            courseId: course.id,
            newColor: colObj.hex,
            colorLabel: colObj.label,
            previewBadge: { code, color: colObj.hex },
            summary: FPi18n.message('ai.summary.courseColor', {name: course.name, code, color: aiColorMessage(colObj), hex: colObj.hex})
        },
        FPi18n.message('ai.review.courseColor', {name: course.name, code, color: aiColorMessage(colObj), hex: colObj.hex})
    );
}

function handleAiCourseEditModePick(mode) {
    if (!activeAiFlow || !activeAiFlow.courseId) return;
    const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
    const course = courses.find(c => c.id === activeAiFlow.courseId);
    if (!course) return;
    const code = (course.code || course.name.slice(0, 2)).slice(0, 2).toUpperCase();

    if (mode === 'name') {
        activeAiFlow = { step: 'await_course_name', courseId: course.id, courseName: course.name };
        appendAiChatBubble(FPi18n.message('ai.course.rename', {name: course.name, code}), false, 'course_flow');
        renderAiFlowPopup();
    } else if (mode === 'code') {
        activeAiFlow = { step: 'await_course_code', courseId: course.id, courseName: course.name };
        appendAiChatBubble(FPi18n.message('ai.course.code', {name: course.name, code}), false, 'course_flow');
        renderAiFlowPopup();
    } else if (mode === 'delete') {
        activeAiFlow = null;
        stageAiPendingAction(
            {
                type: 'delete_course',
                courseId: course.id,
                courseName: course.name,
                summary: FPi18n.message('ai.summary.deleteCourse', {name: course.name, code})
            },
            FPi18n.message('ai.review.deleteCourse', {name: course.name, code})
        );
    }
}

function handleAiThemePick(kind, value) {
    activeAiFlow = null;
    if (kind === 'solid') {
        const tObj = (typeof FP_THEMES !== 'undefined' ? FP_THEMES : []).find(t => t.id === value);
        const tName = tObj ? tObj.name : value;
        stageAiPendingAction(
            {
                type: 'set_solid_theme',
                themeId: value,
                themeName: tName,
                previewColor: tObj ? tObj.accent : '#5f5bf6',
                summary: FPi18n.message('ai.summary.theme', {theme: aiThemeMessage(tName)})
            },
            FPi18n.message('ai.review.theme', {theme: aiThemeMessage(tName)})
        );
    } else if (kind === 'surface') {
        stageAiPendingAction(
            {
                type: 'surface_mode',
                mode: value,
                summary: FPi18n.message('ai.summary.surface', {mode: FPi18n.message(value === 'light' ? 'settings.whiteMode' : 'settings.darkMode')})
            },
            FPi18n.message('ai.review.surface', {mode: FPi18n.message(value === 'light' ? 'settings.whiteMode' : 'settings.darkMode')})
        );
    } else if (kind === 'liquid') {
        const nextState = !window.appState.liquidEffect;
        stageAiPendingAction(
            {
                type: 'set_liquid_glass',
                enabled: nextState,
                summary: FPi18n.message('ai.summary.glassVisual', {action: FPi18n.message(nextState ? 'ai.verb.Enable' : 'ai.verb.Disable')})
            },
            FPi18n.message('ai.review.glass', {action: FPi18n.message(nextState ? 'ai.verb.enable' : 'ai.verb.disable')})
        );
    } else if (kind === 'accent') {
        const colObj = AI_COLOR_PALETTE.find(c => c.key === value);
        if (!colObj) return;
        stageAiPendingAction(
            {
                type: 'set_accent_color',
                hex: colObj.hex,
                label: colObj.label,
                previewColor: colObj.hex,
                summary: FPi18n.message('ai.summary.accent', {color: aiColorMessage(colObj), hex: colObj.hex})
            },
            FPi18n.message('ai.review.accent', {color: aiColorMessage(colObj), hex: colObj.hex})
        );
    }
}

function handleAiAddAllBasicHabitsPick() {
    activeAiFlow = null;
    stageAiPendingAction(
        {
            type: 'add_basic_habits',
            summary: FPi18n.message('ai.summary.refreshCore')
        },
        FPi18n.message('ai.review.coreHabits')
    );
}

function handleAiAddAllExtraHabitsPick() {
    activeAiFlow = null;
    stageAiPendingAction(
        {
            type: 'add_multiple_habits',
            items: EXTRA_HABITS_PRESETS,
            summary: FPi18n.message('ai.summary.extraHabits')
        },
        FPi18n.message('ai.review.extraHabits')
    );
}

function handleAiPresetHabitPick(idx) {
    const preset = ALL_HABIT_SUGGESTIONS[idx];
    if (!preset) return;
    activeAiFlow = null;
    stageAiPendingAction(
        {
            type: 'add_habit',
            nameKey: preset.nameKey,
            category: preset.category,
            color: preset.color,
            icon: preset.icon,
            targetPerWeek: preset.targetPerWeek,
            summary: FPi18n.message('ai.summary.habitPreset', {name: FPi18n.message(preset.nameKey), icon: preset.icon, category: categoryMessage(preset.category, habitCategoryKeys)})
        },
        FPi18n.message('ai.review.habitPreset', {name: FPi18n.message(preset.nameKey)})
    );
}

function handleAiSettingPick(settingKey) {
    activeAiFlow = null;
    if (settingKey === 'pomo_classic') {
        stageAiPendingAction({
            type: 'set_pomo_preset',
            name: 'Classic', focus: 25, short: 5, long: 15, count: 4,
            summary: FPi18n.message('ai.summary.classic')
        }, FPi18n.message('ai.review.classic'));
    } else if (settingKey === 'pomo_extended') {
        stageAiPendingAction({
            type: 'set_pomo_preset',
            name: 'Extended', focus: 50, short: 10, long: 20, count: 3,
            summary: FPi18n.message('ai.summary.extended')
        }, FPi18n.message('ai.review.extended'));
    } else if (settingKey === 'pomo_blitz') {
        stageAiPendingAction({
            type: 'set_pomo_preset',
            name: 'Blitz', focus: 15, short: 3, long: 10, count: 6,
            summary: FPi18n.message('ai.summary.blitz')
        }, FPi18n.message('ai.review.blitz'));
    } else if (settingKey === 'water_2500' || settingKey === 'water_3000') {
        const goal = settingKey === 'water_3000' ? 3000 : 2500;
        stageAiPendingAction({
            type: 'set_water_goal',
            goalMl: goal,
            summary: FPi18n.message('ai.summary.waterGoal', {goal})
        }, FPi18n.message('ai.review.waterGoal', {goal}));
    } else if (settingKey === 'toggle_perf') {
        const nextVal = !window.appState.performanceMode;
        stageAiPendingAction({
            type: 'set_performance_mode',
            enabled: nextVal,
            summary: FPi18n.message('ai.summary.performance', {action: FPi18n.message(nextVal ? 'ai.verb.Enable' : 'ai.verb.Disable')})
        }, FPi18n.message('ai.review.performance', {action: FPi18n.message(nextVal ? 'ai.verb.enable' : 'ai.verb.disable')}));
    } else if (settingKey === 'toggle_liquid') {
        const nextVal = !window.appState.liquidEffect;
        stageAiPendingAction({
            type: 'set_liquid_glass',
            enabled: nextVal,
            summary: FPi18n.message('ai.summary.glassMode', {action: FPi18n.message(nextVal ? 'ai.verb.Enable' : 'ai.verb.Disable')})
        }, FPi18n.message('ai.review.glassMode', {action: FPi18n.message(nextVal ? 'ai.verb.enable' : 'ai.verb.disable')}));
    } else if (settingKey === 'toggle_sound') {
        const nextVal = window.appState.soundEnabled === false;
        stageAiPendingAction({
            type: 'set_sound_enabled',
            enabled: nextVal,
            summary: FPi18n.message('ai.summary.sound', {action: FPi18n.message(nextVal ? 'ai.verb.Enable' : 'ai.verb.Mute')})
        }, FPi18n.message('ai.review.sound', {action: FPi18n.message(nextVal ? 'ai.verb.enable' : 'ai.verb.mute')}));
    } else if (settingKey === 'toggle_notif') {
        const nextVal = window.appState.notificationsEnabled === false;
        stageAiPendingAction({
            type: 'set_notifications_enabled',
            enabled: nextVal,
            summary: FPi18n.message('ai.summary.alerts', {action: FPi18n.message(nextVal ? 'ai.verb.Enable' : 'ai.verb.Disable')})
        }, FPi18n.message('ai.review.alerts', {action: FPi18n.message(nextVal ? 'ai.verb.enable' : 'ai.verb.disable')}));
    }
}

function sendQuickAiPrompt(text) {
    const input = document.getElementById('ai-chat-input');
    if (input) {
        input.value = text;
        handleAiChatSubmit(new Event('submit'));
    }
}

// Parse comma/and-separated list of item names typed by the user (e.g. "Morning Run, Read 10 Pages" or "Coding and Stretching")
function splitMultiItemInput(rawStr) {
    const cleaned = rawStr
        .replace(/^(?:add|create|new|make)\s+(?:a\s+|new\s+)*(?:\d+|one|two|three|four|five|couple|few|both)?\s*(?:new\s+)?(?:habits?|tasks?|courses?)[:\s-]*/i, '')
        .trim();
    if (!cleaned) return [];
    if (cleaned.includes(',')) {
        return cleaned.split(',').map(s => s.replace(/^\s*(?:and|&)\s+/i, '').trim()).filter(Boolean);
    }
    if (/\s+(?:and|&)\s+/i.test(cleaned)) {
        return cleaned.split(/\s+(?:and|&)\s+/i).map(s => s.trim()).filter(Boolean);
    }
    return [cleaned];
}

// Handle user input when an interactive multi-step flow (activeAiFlow) is active
function processActiveAiFlowInput(rawPrompt) {
    if (!activeAiFlow) return false;
    const clean = rawPrompt.trim();
    const norm = normalizeAiCommandText(clean).toLowerCase();

    if (/^(?:cancel|exit|stop|nevermind|quit)$/i.test(norm)) {
        dismissAiInteractiveFlow();
        appendAiChatBubble(FPi18n.message('ai.flow.cancelled'));
        return true;
    }

    // Step 0A: Multi-item collection flow ("Add a new two habits", "add 3 tasks", "add 2 courses")
    if (activeAiFlow.step === 'collect_multiple_items') {
        // Check if the user switched to an unrelated global command (like "change settings" or "edit my courses")
        if (/^(?:change|edit)\s+(?:my\s+)?(?:settings?|themes?|courses?)\b/i.test(norm) || /\bhelp\b.*\bassignment/i.test(norm)) {
            activeAiFlow = null;
            hideAiInlinePopupTray();
            return false;
        }

        const { entityType, targetCount, collected } = activeAiFlow;
        const parts = splitMultiItemInput(clean);
        if (parts.length === 0) return false;

        for (const p of parts) {
            if (entityType === 'habit') {
                // Check if user typed a number referring to suggestion chip index (1-10)
                if (/^\d+$/.test(p)) {
                    const idx = parseInt(p, 10) - 1;
                    if (ALL_HABIT_SUGGESTIONS[idx]) {
                        collected.push({ ...ALL_HABIT_SUGGESTIONS[idx] });
                        continue;
                    }
                }
                const matchedPreset = ALL_HABIT_SUGGESTIONS.find(h => h.name.toLowerCase().includes(p.toLowerCase()));
                if (matchedPreset && p.length >= 4) {
                    collected.push({ ...matchedPreset });
                } else {
                    collected.push({ name: p, category: 'Productivity', color: 'violet', icon: '⚡', targetPerWeek: 5 });
                }
            } else if (entityType === 'task') {
                collected.push({ title: p });
            } else if (entityType === 'course') {
                const code = p.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CR';
                collected.push({ name: p, code, color: '#8b5cf6' });
            }
        }

        if (collected.length >= targetCount) {
            finalizeMultiItemCollection();
            return true;
        } else {
            const remaining = targetCount - collected.length;
            const latestName = aiPickedName(collected[collected.length - 1]);
            const ordinal = collected.length === 1 ? 'ai.order.second' : (collected.length === 2 ? 'ai.order.third' : 'ai.order.next');
            appendAiChatBubble(
                FPi18n.message('ai.flow.nextItem', {count: collected.length, name: latestName, order: FPi18n.message(ordinal), type: aiEntityMessage(entityType), remaining}),
                false,
                'multi_item_flow'
            );
            renderAiFlowPopup();
            return true;
        }
    }

    // Step 0B: Waiting for assignment selection ("Hello me with my assignment" -> "I need answers" / "1" / "Physics")
    if (activeAiFlow.step === 'select_assignment') {
        const pendingTasks = ((window.appState && window.appState.tasks) || []).filter(t => !t.completed);
        if (/\b(?:i\s+need\s+answers?|give\s+(?:me\s+)?answers?|all|everything|both|solve\s+all|yes|sure|ok)\b/i.test(norm)) {
            if (pendingTasks.length === 0) {
                dismissAiInteractiveFlow();
                appendAiChatBubble(FPi18n.message('ai.study.askDirectly'), false, 'study_answer');
                return true;
            }
            const combined = pendingTasks.slice(0, 4).map(t => buildAssignmentSolutionText(t)).join('\n\n');
            activeAiFlow = { step: 'post_assignment_actions', taskId: pendingTasks[0].id };
            appendAiChatBubble(combined, false, 'study_answer');
            renderAiFlowPopup();
            return true;
        }

        const matchedTask = findTaskFromText(clean);
        if (matchedTask) {
            const ans = buildAssignmentSolutionText(matchedTask);
            activeAiFlow = { step: 'post_assignment_actions', taskId: matchedTask.id };
            appendAiChatBubble(ans, false, 'study_answer');
            renderAiFlowPopup();
            return true;
        }

        // If user typed a custom assignment topic/question directly while in select_assignment flow, exit flow and answer it!
        activeAiFlow = null;
        hideAiInlinePopupTray();
        return false;
    }

    // Step 0C: Post-assignment action tray active
    if (activeAiFlow.step === 'post_assignment_actions') {
        if (/\b(?:save|note|notes)\b/i.test(norm)) {
            handleAiSaveAnswerToNotes();
            return true;
        }
        if (/\b(?:complete|done|finish|mark)\b/i.test(norm) && activeAiFlow.taskId) {
            handleAiCompleteAssignmentTask(activeAiFlow.taskId);
            return true;
        }
        activeAiFlow = null;
        hideAiInlinePopupTray();
        return false;
    }

    // Step A: Waiting for user to pick a course to edit
    if (activeAiFlow.step === 'select_course') {
        if (/^(?:add|new|create)\b/i.test(norm)) {
            const afterAdd = clean.replace(/^(?:add|new|create)\s*(?:course)?[:\s-]*/i, '').trim();
            if (afterAdd) {
                const code = afterAdd.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CR';
                activeAiFlow = null;
                stageAiPendingAction(
                    {
                        type: 'add_course',
                        name: afterAdd,
                        code,
                        color: '#8b5cf6',
                        previewBadge: { code, color: '#8b5cf6' },
                        summary: FPi18n.message('ai.summary.addCourse', {name: afterAdd, code})
                    },
                    FPi18n.message('ai.review.addCourse', {name: afterAdd, code})
                );
                return true;
            }
            handleAiStartAddNewCourse();
            return true;
        }

        const matchedCourse = findCourseFromText(clean);
        if (matchedCourse) {
            activeAiFlow = { step: 'select_course_edit', courseId: matchedCourse.id, courseName: matchedCourse.name };
            const code = (matchedCourse.code || matchedCourse.name.slice(0, 2)).slice(0, 2).toUpperCase();
            appendAiChatBubble(
                FPi18n.message('ai.course.selected', {code, name: matchedCourse.name, color: getColorLabelByHex(matchedCourse.color)}),
                false,
                'course_flow'
            );
            renderAiFlowPopup();
            return true;
        }
        activeAiFlow = null;
        hideAiInlinePopupTray();
        return false;
    }

    // Step B: Course is selected; waiting for which edit to perform (color, code/letters, name, delete)
    if (activeAiFlow.step === 'select_course_edit') {
        const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
        const course = courses.find(c => c.id === activeAiFlow.courseId);
        if (!course) {
            dismissAiInteractiveFlow();
            return false;
        }
        const curCode = (course.code || course.name.slice(0, 2)).slice(0, 2).toUpperCase();

        if (/^(?:delete|remove|drop)\b/i.test(norm)) {
            activeAiFlow = null;
            stageAiPendingAction(
                {
                    type: 'delete_course',
                    courseId: course.id,
                    courseName: course.name,
                    summary: FPi18n.message('ai.summary.deleteCourse', {name: course.name, code: curCode})
                },
                FPi18n.message('ai.review.deleteCourse', {name: course.name, code: curCode})
            );
            return true;
        }

        const matchedColor = resolveAiColor(clean);
        if (matchedColor && (norm.includes('color') || norm.includes('to ') || norm.split(' ').length <= 3)) {
            activeAiFlow = null;
            stageAiPendingAction(
                {
                    type: 'edit_course',
                    courseId: course.id,
                    newColor: matchedColor.hex,
                    colorLabel: matchedColor.label,
                    previewBadge: { code: curCode, color: matchedColor.hex },
                    summary: FPi18n.message('ai.summary.courseColor', {name: course.name, code: curCode, color: aiColorMessage(matchedColor), hex: matchedColor.hex})
                },
                FPi18n.message('ai.review.editColor', {name: course.name, code: curCode, color: aiColorMessage(matchedColor), hex: matchedColor.hex})
            );
            return true;
        }

        if (/\b(?:letter|letters|code|badge|short|initials)\b/i.test(norm)) {
            const codeMatch = clean.match(/(?:to|as|is|:)\s*([A-Za-z0-9]{1,3})\s*$/i) || clean.match(/\b(?:letters?|code|badge)\s+([A-Za-z0-9]{1,3})\s*$/i);
            if (codeMatch) {
                const newCode = codeMatch[1].slice(0, 2).toUpperCase();
                activeAiFlow = null;
                stageAiPendingAction(
                    {
                        type: 'edit_course',
                        courseId: course.id,
                        newCode,
                        previewBadge: { code: newCode, color: course.color || '#5f5bf6' },
                        summary: FPi18n.message('ai.summary.changeCode', {name: course.name, oldCode: curCode, newCode})
                    },
                    FPi18n.message('ai.review.editCode', {name: course.name, code: newCode})
                );
                return true;
            } else {
                activeAiFlow = { step: 'await_course_code', courseId: course.id, courseName: course.name };
                appendAiChatBubble(FPi18n.message('ai.course.askCode', {name: course.name}), false, 'course_flow');
                renderAiFlowPopup();
                return true;
            }
        }

        if (/\b(?:name|rename|title|call\s+it)\b/i.test(norm)) {
            const nameMatch = clean.match(/(?:name\s+to|rename\s+to|to|as|:)\s*(.+)$/i);
            if (nameMatch && nameMatch[1].trim() && !/^(?:change|edit|name|letters|code)$/i.test(nameMatch[1].trim())) {
                const newName = nameMatch[1].trim();
                const autoCode = course.code || newName.slice(0, 2).toUpperCase();
                activeAiFlow = null;
                stageAiPendingAction(
                    {
                        type: 'edit_course',
                        courseId: course.id,
                        newName,
                        previewBadge: { code: autoCode, color: course.color || '#5f5bf6' },
                        summary: FPi18n.message('ai.summary.rename', {name: course.name, newName})
                    },
                    FPi18n.message('ai.review.rename', {name: course.name, newName})
                );
                return true;
            } else {
                activeAiFlow = { step: 'await_course_name', courseId: course.id, courseName: course.name };
                appendAiChatBubble(FPi18n.message('ai.course.askRename', {name: course.name}), false, 'course_flow');
                renderAiFlowPopup();
                return true;
            }
        }

        const otherCourse = findCourseFromText(clean);
        if (otherCourse && otherCourse.id !== course.id) {
            handleAiCourseSelectClick(otherCourse.id);
            return true;
        }

        if (/^[A-Za-z0-9]{2}$/.test(clean)) {
            const newCode = clean.toUpperCase();
            activeAiFlow = null;
            stageAiPendingAction(
                {
                    type: 'edit_course',
                    courseId: course.id,
                    newCode,
                    previewBadge: { code: newCode, color: course.color || '#5f5bf6' },
                    summary: FPi18n.message('ai.summary.newCode', {name: course.name, code: newCode})
                },
                FPi18n.message('ai.review.editCode', {name: course.name, code: newCode})
            );
            return true;
        }

        appendAiChatBubble(
            FPi18n.message('ai.course.editChoices', {name: course.name, code: curCode}),
            false,
            'course_flow'
        );
        renderAiFlowPopup();
        return true;
    }

    // Step C: Waiting for new course name
    if (activeAiFlow.step === 'await_course_name') {
        const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
        const course = courses.find(c => c.id === activeAiFlow.courseId);
        if (!course) { dismissAiInteractiveFlow(); return false; }
        const newName = clean.replace(/^(?:change\s+name\s+to|rename\s+to|to)\s+/i, '').trim();
        const curCode = (course.code || newName.slice(0, 2)).slice(0, 2).toUpperCase();
        activeAiFlow = null;
        stageAiPendingAction(
            {
                type: 'edit_course',
                courseId: course.id,
                newName,
                previewBadge: { code: curCode, color: course.color || '#5f5bf6' },
                summary: FPi18n.message('ai.summary.rename', {name: course.name, newName})
            },
            FPi18n.message('ai.review.rename', {name: course.name, newName})
        );
        return true;
    }

    // Step D: Waiting for new 2-letter course code
    if (activeAiFlow.step === 'await_course_code') {
        const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
        const course = courses.find(c => c.id === activeAiFlow.courseId);
        if (!course) { dismissAiInteractiveFlow(); return false; }
        const cleanedCode = clean.replace(/^(?:change\s+(?:letters?|code)\s+to|to)\s+/i, '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
        if (!cleanedCode) {
            appendAiChatBubble(FPi18n.message('ai.course.invalidCode'), false, 'course_flow');
            return true;
        }
        activeAiFlow = null;
        stageAiPendingAction(
            {
                type: 'edit_course',
                courseId: course.id,
                newCode: cleanedCode,
                previewBadge: { code: cleanedCode, color: course.color || '#5f5bf6' },
                summary: FPi18n.message('ai.summary.newCode', {name: course.name, code: cleanedCode})
            },
            FPi18n.message('ai.review.editCode', {name: course.name, code: cleanedCode})
        );
        return true;
    }

    // Step E: Waiting for brand-new course name to add
    if (activeAiFlow.step === 'await_new_course_name') {
        const newName = clean.replace(/^(?:add\s+course|course)[:\s-]*/i, '').trim();
        const code = newName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CR';
        const matchedColor = resolveAiColor(newName) || { hex: '#8b5cf6', label: 'Violet' };
        activeAiFlow = null;
        stageAiPendingAction(
            {
                type: 'add_course',
                name: newName,
                code,
                color: matchedColor.hex,
                previewBadge: { code, color: matchedColor.hex },
                summary: FPi18n.message('ai.summary.addCourse', {name: newName, code})
            },
            FPi18n.message('ai.review.newCourse', {name: newName, code})
        );
        return true;
    }

    // Step F: Waiting for theme or accent selection
    if (activeAiFlow.step === 'select_theme') {
        const directTheme = parseThemeOrColorCommand(clean);
        if (directTheme) {
            activeAiFlow = null;
            stageAiPendingAction(directTheme, FPi18n.message('ai.review.themeAction', {summary: directTheme.summary}));
            return true;
        }
        const matchedCol = resolveAiColor(clean);
        if (matchedCol) {
            activeAiFlow = null;
            stageAiPendingAction(
                {
                    type: 'set_accent_color',
                    hex: matchedCol.hex,
                    label: matchedCol.label,
                    previewColor: matchedCol.hex,
                    summary: FPi18n.message('ai.summary.accent', {color: aiColorMessage(matchedCol), hex: matchedCol.hex})
                },
                FPi18n.message('ai.review.changeAccent', {color: aiColorMessage(matchedCol), hex: matchedCol.hex})
            );
            return true;
        }
        activeAiFlow = null;
        hideAiInlinePopupTray();
        return false;
    }

    // Step G: Waiting for habit name or basic/extra habits selection
    if (activeAiFlow.step === 'select_habit') {
        // If user asked for a specific quantity while inside habit flow (e.g. "Add a new two habits")
        const reqCount = extractRequestedItemCount(norm);
        if (reqCount && reqCount >= 2) {
            activeAiFlow = null;
            hideAiInlinePopupTray();
            return false; // Let startInteractiveAiFlowIfMatched handle the multi-item flow
        }
        if (/\b(?:extra|starter|more)\b/i.test(norm)) {
            handleAiAddAllExtraHabitsPick();
            return true;
        }
        if (/\b(?:basic|sample|default|core|all)\b/i.test(norm)) {
            handleAiAddAllBasicHabitsPick();
            return true;
        }
        // Check if user typed another global command
        if (/^(?:change|edit)\s+(?:my\s+)?(?:settings?|themes?|courses?)\b/i.test(norm) || /\bhelp\b.*\bassignment/i.test(norm)) {
            activeAiFlow = null;
            hideAiInlinePopupTray();
            return false;
        }
        const habitTitle = clean.replace(/^(?:add\s+habit|new\s+habit|create\s+habit|habit)[:\s-]*/i, '').trim();
        if (habitTitle) {
            activeAiFlow = null;
            stageAiPendingAction(
                {
                    type: 'add_habit',
                    name: habitTitle,
                    summary: FPi18n.message('ai.summary.customHabit', {name: habitTitle})
                },
                FPi18n.message('ai.review.customHabit', {name: habitTitle})
            );
            return true;
        }
        activeAiFlow = null;
        hideAiInlinePopupTray();
        return false;
    }

    // Step H: Waiting for setting selection
    if (activeAiFlow.step === 'select_setting') {
        const directCmd = parseAiActionCommand(clean);
        if (directCmd) {
            activeAiFlow = null;
            stageAiPendingAction(directCmd, FPi18n.message('ai.review.settingAction', {summary: directCmd.summary}));
            return true;
        }
        activeAiFlow = null;
        hideAiInlinePopupTray();
        return false;
    }

    return false;
}

function parseThemeOrColorCommand(prompt) {
    const norm = normalizeAiCommandText(prompt).toLowerCase();

    if (/\b(?:white\s+mode|light\s+mode|switch\s+to\s+white|switch\s+to\s+light)\b/.test(norm)) {
        return {
            type: 'surface_mode',
            mode: 'light',
            summary: FPi18n.message('ai.summary.white')
        };
    }
    if (/\b(?:dark\s+mode|switch\s+to\s+dark)\b/.test(norm)) {
        return {
            type: 'surface_mode',
            mode: 'dark',
            summary: FPi18n.message('ai.summary.dark')
        };
    }

    if (/\bliquid\s*glass\b/.test(norm)) {
        const turnOff = /\b(?:off|disable|solid|remove)\b/.test(norm);
        const turnOn = /\b(?:on|enable|activate|use)\b/.test(norm);
        const nextVal = turnOff ? false : (turnOn ? true : !window.appState.liquidEffect);
        return {
            type: 'set_liquid_glass',
            enabled: nextVal,
            summary: FPi18n.message('ai.summary.glassVisual', {action: FPi18n.message(nextVal ? 'ai.verb.Enable' : 'ai.verb.Disable')})
        };
    }

    const themesList = [
        { id: 'obsidian',  name: 'Obsidian',       match: /\bobsidian\b/, accent: '#64748b' },
        { id: 'midnight',  name: 'Midnight Navy',  match: /\bmidnight(?:\s*navy)?\b/, accent: '#4f46e5' },
        { id: 'forest',    name: 'Forest Emerald', match: /\bforest(?:\s*emerald)?\b/, accent: '#10b981' },
        { id: 'cyberpunk', name: 'Cyberpunk',      match: /\bcyber\s*punk\b/, accent: '#d946ef' },
        { id: 'sunset',    name: 'Sunset Crimson', match: /\bsunset(?:\s*crimson)?\b/, accent: '#ef4444' },
        { id: 'pureblack', name: 'Pure Black',     match: /\bpure\s*black\b|\boled\b/, accent: '#0f172a' },
        { id: 'purewhite', name: 'Pure White',     match: /\bpure\s*white\b/, accent: '#4f46e5' }
    ];
    for (const t of themesList) {
        if (t.match.test(norm)) {
            return {
                type: 'set_solid_theme',
                themeId: t.id,
                themeName: t.name,
                previewColor: t.accent,
                summary: FPi18n.message('ai.summary.solid', {theme: aiThemeMessage(t.name)})
            };
        }
    }

    if (/\b(?:accent|theme|color|change|set|switch)\b/.test(norm) && !/\bcourse\b/.test(norm)) {
        const col = resolveAiColor(norm);
        if (col) {
            return {
                type: 'set_accent_color',
                hex: col.hex,
                label: col.label,
                previewColor: col.hex,
                summary: FPi18n.message('ai.summary.accent', {color: aiColorMessage(col), hex: col.hex})
            };
        }
    }

    return null;
}

// Parse one-shot commands & natural language system intents
function parseAiActionCommand(prompt) {
    const clean = prompt.trim();
    const norm = normalizeAiCommandText(clean);
    const lower = norm.toLowerCase();

    // 1. Add Basic Habits (only if some are missing; if all 5 exist, let startInteractiveAiFlowIfMatched offer Extra Starter Habits!)
    if (/\b(?:add|restore|load|reset|create|get|include)\s+(?:the\s+|my\s+|our\s+)?(?:basic|sample|default|starter|core)\s+habits?\b/i.test(norm) ||
        /^basic\s+habits?$/i.test(norm)) {
        const missingCount = BASIC_HABITS_PRESETS.filter(preset => !hasAiHabitPreset(preset)).length;
        if (missingCount > 0 || /\b(?:reset|restore)\b/i.test(norm)) {
            return {
                type: 'add_basic_habits',
                summary: FPi18n.message('ai.summary.coreHabits')
            };
        }
        // When all 5 basic habits already exist, return null here so startInteractiveAiFlowIfMatched opens the smart Extra/Basic Habit chooser!
        return null;
    }

    // 2. Multi-item inline list (e.g. "add 2 habits: Morning Run, Read 10 Pages" or "add habits Coding and Stretching")
    const inlineMultiHabitMatch = norm.match(/^(?:add|create|new)\s+(?:a\s+|new\s+)*(?:\d+|two|three|four|five|couple|few|both)?\s*(?:new\s+)?habits?\s*[:,-]\s*(.+)$/i);
    if (inlineMultiHabitMatch) {
        const parts = splitMultiItemInput(inlineMultiHabitMatch[1]);
        if (parts.length >= 2) {
            const items = parts.map(p => ({ name: p, category: 'Productivity', color: 'violet', icon: '⚡', targetPerWeek: 5 }));
            return {
                type: 'add_multiple_habits',
                items,
                summary: FPi18n.message('ai.summary.habitList', {count: items.length, names: items.map(x => `"${x.name}"`).join(', ')})
            };
        }
    }

    // 3. Mark / Complete ALL Habits Today
    if (/\b(?:check|complete|mark|finish|log)\s+all\s+habits?\b/i.test(norm)) {
        return {
            type: 'mark_all_habits',
            summary: FPi18n.message('ai.summary.checkAll')
        };
    }

    // 4. Add Task (with title, excluding multi-count requests like "add 2 tasks")
    if (!extractRequestedItemCount(norm)) {
        const addTaskMatch = norm.match(/^(?:add|create|new)\s+task[:\s,-]+(.+)$/i);
        if (addTaskMatch) {
            const rawTitle = addTaskMatch[1].trim();
            return {
                type: 'add_task',
                title: rawTitle,
                summary: FPi18n.message('ai.summary.newTask', {title: rawTitle})
            };
        }
    }
    if (lower === 'add task' || lower === 'new task' || lower === 'create task') {
        return {
            type: 'add_task',
            title: FPi18n.translate('ai.preset.focusTask'),
            summary: FPi18n.message('ai.summary.focusTask')
        };
    }

    // 5. Complete / Delete Task (explicit or natural phrasing like "I finished my physics lab")
    const completeTaskMatch = norm.match(/^(?:complete|finish|done|mark|check)\s+task[:\s,-]+(.+)$/i) ||
                              norm.match(/^(?:i\s+)?(?:finished|completed|did|done\s+with)\s+(?:my\s+|the\s+)?(.+)$/i);
    if (completeTaskMatch) {
        const queryTitle = completeTaskMatch[1].trim();
        const matched = findTaskFromText(queryTitle);
        if (matched || /^complete|finish|done|mark|check/i.test(norm)) {
            const targetLabel = matched ? matched.title : queryTitle;
            return {
                type: 'complete_task',
                query: targetLabel,
                summary: FPi18n.message('ai.summary.completeTask', {title: targetLabel})
            };
        }
    }
    const deleteTaskMatch = norm.match(/^(?:delete|remove)\s+task[:\s,-]+(.+)$/i);
    if (deleteTaskMatch) {
        const queryTitle = deleteTaskMatch[1].trim();
        return {
            type: 'delete_task',
            query: queryTitle,
            summary: FPi18n.message('ai.summary.deleteTask', {query: queryTitle})
        };
    }

    // 6. Add single Habit with specific name provided (only when not a quantified request like "Add a new two habits")
    if (!extractRequestedItemCount(norm)) {
        const addHabitMatch = norm.match(/^(?:add|create|new)\s+habit[:\s,-]+(.+)$/i);
        if (addHabitMatch && !/^(?:basic|sample|default|extra|starter|habits?)$/i.test(addHabitMatch[1].trim())) {
            const rawHabit = addHabitMatch[1].trim();
            return {
                type: 'add_habit',
                name: rawHabit,
                summary: FPi18n.message('ai.summary.customHabit', {name: rawHabit})
            };
        }
    }

    // 7. Check / Delete Habit
    const checkHabitMatch = norm.match(/^(?:check|complete|log|done)\s+habit[:\s,-]+(.+)$/i);
    if (checkHabitMatch) {
        const queryHabit = checkHabitMatch[1].trim();
        return {
            type: 'check_habit',
            query: queryHabit,
            summary: FPi18n.message('ai.summary.checkHabit', {query: queryHabit})
        };
    }
    const deleteHabitMatch = norm.match(/^(?:delete|remove)\s+habit[:\s,-]+(.+)$/i);
    if (deleteHabitMatch) {
        const queryHabit = deleteHabitMatch[1].trim();
        return {
            type: 'delete_habit',
            query: queryHabit,
            summary: FPi18n.message('ai.summary.deleteHabit', {query: queryHabit})
        };
    }

    // 8. Direct One-Shot Course Edits (e.g. "change CS101 colour to violet", "add course Biology", "delete course Physics")
    if (!extractRequestedItemCount(norm)) {
        const addCourseMatch = norm.match(/^(?:add|create|new)\s+course[:\s,-]+(.+)$/i);
        if (addCourseMatch) {
            const rawCourse = addCourseMatch[1].trim();
            const code = rawCourse.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CR';
            const col = resolveAiColor(rawCourse) || { hex: '#8b5cf6', label: 'Violet' };
            return {
                type: 'add_course',
                name: rawCourse,
                code,
                color: col.hex,
                previewBadge: { code, color: col.hex },
                summary: FPi18n.message('ai.summary.addCourse', {name: rawCourse, code})
            };
        }
    }
    const delCourseMatch = norm.match(/^(?:delete|remove|drop)\s+course[:\s,-]+(.+)$/i);
    if (delCourseMatch) {
        const target = findCourseFromText(delCourseMatch[1]);
        if (target) {
            const code = (target.code || target.name.slice(0, 2)).slice(0, 2).toUpperCase();
            return {
                type: 'delete_course',
                courseId: target.id,
                courseName: target.name,
                summary: FPi18n.message('ai.summary.deleteCourse', {name: target.name, code})
            };
        }
    }
    if (/\bcourses?\b/i.test(norm) || (window.appState.courses || []).some(c => lower.includes(c.name.toLowerCase()))) {
        const matchedCourse = findCourseFromText(norm);
        if (matchedCourse && /\b(?:change|edit|set|update|make|color|letter|code|name|rename)\b/i.test(norm)) {
            const curCode = (matchedCourse.code || matchedCourse.name.slice(0, 2)).slice(0, 2).toUpperCase();
            const col = resolveAiColor(norm);
            if (col) {
                return {
                    type: 'edit_course',
                    courseId: matchedCourse.id,
                    newColor: col.hex,
                    colorLabel: col.label,
                    previewBadge: { code: curCode, color: col.hex },
                    summary: FPi18n.message('ai.summary.courseColor', {name: matchedCourse.name, code: curCode, color: aiColorMessage(col), hex: col.hex})
                };
            }
            const codeMatch = norm.match(/\b(?:letters?|code|badge)\s+(?:to\s+)?([A-Za-z0-9]{1,2})\b/i);
            if (codeMatch) {
                const newCode = codeMatch[1].toUpperCase();
                return {
                    type: 'edit_course',
                    courseId: matchedCourse.id,
                    newCode,
                    previewBadge: { code: newCode, color: matchedCourse.color || '#5f5bf6' },
                    summary: FPi18n.message('ai.summary.newCode', {name: matchedCourse.name, code: newCode})
                };
            }
            const renameMatch = norm.match(/\b(?:rename|name)\s+(?:to\s+)(.+)$/i);
            if (renameMatch) {
                const newName = renameMatch[1].trim();
                return {
                    type: 'edit_course',
                    courseId: matchedCourse.id,
                    newName,
                    previewBadge: { code: curCode, color: matchedCourse.color || '#5f5bf6' },
                    summary: FPi18n.message('ai.summary.rename', {name: matchedCourse.name, newName})
                };
            }
        }
    }

    // 9. Theme, Surface Mode, Liquid Glass, Accent Colour
    const themeCmd = parseThemeOrColorCommand(norm);
    if (themeCmd) return themeCmd;

    // 10. Add Plan / Schedule
    const addPlanMatch = norm.match(/^(?:add|create|new)\s+(?:plan|schedule)[:\s,-]*(.*)$/i);
    if (addPlanMatch) {
        const rawPlan = addPlanMatch[1].trim() || FPi18n.translate('ai.preset.focusPlan');
        return {
            type: 'add_plan',
            presetName: rawPlan,
            hours: 4,
            sessions: 4,
            summary: FPi18n.message('ai.summary.newPlan', {name: rawPlan})
        };
    }

    // 11. Start / Pause Pomodoro Timer & Timer Presets/Minutes
    if (lower === 'start timer' || lower === 'start pomodoro' || lower === 'start focus') {
        return {
            type: 'start_timer',
            summary: FPi18n.message('ai.summary.startTimer', {minutes: window.appState.timerSettings.pomodoro || 25})
        };
    }
    if (lower === 'pause timer' || lower === 'stop timer') {
        return {
            type: 'pause_timer',
            summary: FPi18n.message('ai.summary.pauseTimer')
        };
    }
    if (lower === 'classic' || lower === 'classic preset') {
        return { type: 'set_pomo_preset', name: 'Classic', focus: 25, short: 5, long: 15, count: 4, summary: FPi18n.message('ai.summary.classicShort') };
    }
    if (lower === 'extended' || lower === 'extended preset') {
        return { type: 'set_pomo_preset', name: 'Extended', focus: 50, short: 10, long: 20, count: 3, summary: FPi18n.message('ai.summary.extendedShort') };
    }
    if (lower === 'blitz' || lower === 'blitz preset') {
        return { type: 'set_pomo_preset', name: 'Blitz', focus: 15, short: 3, long: 10, count: 6, summary: FPi18n.message('ai.summary.blitzShort') };
    }
    const pomoMinsMatch = norm.match(/\b(?:set|change)\s+(?:pomodoro|focus|timer)(?:\s+duration|\s+time)?\s+(?:to\s+)?(\d+)\s*(?:m|min|mins|minutes)?\b/i);
    if (pomoMinsMatch) {
        const mins = Math.max(1, Math.min(180, parseInt(pomoMinsMatch[1], 10)));
        return {
            type: 'set_pomo_minutes',
            minutes: mins,
            summary: FPi18n.message('ai.summary.duration', {minutes: mins})
        };
    }

    // 12. Hydration / Water Logging, Reset, and Goal Settings (including natural "I drank water")
    if (lower.includes('reset water') || lower.includes('reset hydration')) {
        return {
            type: 'reset_water',
            summary: FPi18n.message('ai.summary.resetWater')
        };
    }
    if (lower.includes('log water') || lower.includes('drink water') || lower === 'hydrate' || lower === 'add water' ||
        /\b(?:i\s+drank|just\s+drank|had\s+a\s+glass\s+of)\s+water\b/i.test(norm)) {
        return {
            type: 'log_water',
            summary: FPi18n.message('ai.summary.logWater', {amount: window.appState.glassSizeMl || 250})
        };
    }
    const waterGoalMatch = norm.match(/\b(?:set|change)\s+(?:daily\s+)?(?:water|hydration)\s+goal\s+(?:to\s+)?(\d+)\s*(?:ml)?\b/i);
    if (waterGoalMatch) {
        const goalMl = Math.max(500, Math.min(10000, parseInt(waterGoalMatch[1], 10)));
        return {
            type: 'set_water_goal',
            goalMl,
            summary: FPi18n.message('ai.summary.waterGoal', {goal: goalMl})
        };
    }
    const glassSizeMatch = norm.match(/\b(?:set|change)\s+glass\s+size\s+(?:to\s+)?(\d+)\s*(?:ml)?\b/i);
    if (glassSizeMatch) {
        const glassMl = Math.max(50, Math.min(2000, parseInt(glassSizeMatch[1], 10)));
        return {
            type: 'set_glass_size',
            glassMl,
            summary: FPi18n.message('ai.summary.glassSize', {size: glassMl})
        };
    }

    // 13. Performance Mode, UI Scale, Sound, Notifications, Streak, User Profile Name, Quick Notes
    if (/\b(?:performance\s+mode|low\s*spec\s+mode)\b/i.test(norm)) {
        const off = /\b(?:off|disable)\b/i.test(norm);
        const on = /\b(?:on|enable)\b/i.test(norm);
        const nextVal = off ? false : (on ? true : !window.appState.performanceMode);
        return {
            type: 'set_performance_mode',
            enabled: nextVal,
            summary: FPi18n.message('ai.summary.performance', {action: FPi18n.message(nextVal ? 'ai.verb.Enable' : 'ai.verb.Disable')})
        };
    }
    const scaleMatch = norm.match(/\b(?:set|change)\s+ui\s+scale\s+(?:to\s+)?([+-]?\d+)\b/i);
    if (scaleMatch) {
        const stepVal = Math.max(-5, Math.min(5, parseInt(scaleMatch[1], 10)));
        return {
            type: 'set_ui_scale',
            scale: stepVal,
            summary: FPi18n.message('ai.summary.scale', {percent: 100 + stepVal * 5, step: stepVal})
        };
    }
    if (/\b(?:mute\s+sound|disable\s+sound|sound\s+off)\b/i.test(norm)) {
        return { type: 'set_sound_enabled', enabled: false, summary: FPi18n.message('ai.summary.mute') };
    }
    if (/\b(?:enable\s+sound|unmute\s+sound|sound\s+on)\b/i.test(norm)) {
        return { type: 'set_sound_enabled', enabled: true, summary: FPi18n.message('ai.summary.unmute') };
    }
    if (/\b(?:disable\s+notifications?|notifications?\s+off|mute\s+notifications?)\b/i.test(norm)) {
        return { type: 'set_notifications_enabled', enabled: false, summary: FPi18n.message('ai.summary.disableAlerts') };
    }
    if (/\b(?:enable\s+notifications?|notifications?\s+on)\b/i.test(norm)) {
        return { type: 'set_notifications_enabled', enabled: true, summary: FPi18n.message('ai.summary.enableAlerts') };
    }
    if (/\b(?:hide\s+streak|disable\s+streak)\b/i.test(norm)) {
        return { type: 'set_streak_visibility', visible: false, summary: FPi18n.message('ai.summary.hideStreak') };
    }
    if (/\b(?:show\s+streak|enable\s+streak)\b/i.test(norm)) {
        return { type: 'set_streak_visibility', visible: true, summary: FPi18n.message('ai.summary.showStreak') };
    }
    const profileNameMatch = norm.match(/\b(?:change|set|update)\s+(?:my\s+)?(?:profile\s+|user\s+)?name\s+to\s+(.+)$/i) ||
                             norm.match(/\bcall\s+me\s+([A-Za-z0-9_ -]{2,25})$/i);
    if (profileNameMatch) {
        const newUser = profileNameMatch[1].trim();
        return {
            type: 'set_profile_name',
            name: newUser,
            summary: FPi18n.message('ai.summary.profile', {name: newUser})
        };
    }
    if (/\b(?:save|add|copy)\s+(?:this|that|it|answer|solution)\s+(?:to|into|in)\s+(?:my\s+)?notes?\b/i.test(norm) && aiConversationMemory.lastAnswerText) {
        return {
            type: 'append_study_notes',
            noteText: aiConversationMemory.lastAnswerText.replace(/\*\*/g, ''),
            summary: FPi18n.message('ai.summary.saveAnswer')
        };
    }

    // 14. Natural Language Intent Analyzer (analyzes what the user wants to do in the system from conversational sentences)
    if (/\b(?:remind\s+me\s+to|i\s+need\s+to\s+submit|i\s+have\s+to\s+finish|add\s+to\s+my\s+to\s*do)\s+(.+)$/i.test(norm)) {
        const m = norm.match(/\b(?:remind\s+me\s+to|i\s+need\s+to\s+submit|i\s+have\s+to\s+finish|add\s+to\s+my\s+to\s*do)\s+(.+)$/i);
        if (m && m[1].trim()) {
            const taskTitle = m[1].trim();
            return {
                type: 'add_task',
                title: taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1),
                summary: FPi18n.message('ai.summary.newTask', {title: taskTitle})
            };
        }
    }
    if (/\b(?:too\s+bright|my\s+eyes\s+hurt|make\s+it\s+dark)\b/i.test(norm)) {
        return { type: 'surface_mode', mode: 'dark', summary: FPi18n.message('ai.summary.dark') };
    }
    if (/\b(?:make\s+text\s+bigger|font\s+too\s+small|zoom\s+in)\b/i.test(norm)) {
        const nextScale = Math.min(5, (window.appState.uiScale || 0) + 2);
        return { type: 'set_ui_scale', scale: nextScale, summary: FPi18n.message('ai.summary.increaseScale', {percent: 100 + nextScale * 5}) };
    }

    return null;
}

// Check if the user is starting an interactive multi-step flow (Multi-Item Add, Assignments, Courses, Themes, Habits, Settings)
function startInteractiveAiFlowIfMatched(prompt) {
    const clean = prompt.trim();
    const norm = normalizeAiCommandText(clean).toLowerCase();

    // 0A. Quantified Multi-Item Creation Flow ("Add a new two habits", "add 2 habits", "add 3 tasks", "add two courses")
    const reqCount = extractRequestedItemCount(norm);
    if (reqCount && reqCount >= 1) {
        let entityType = null;
        if (/\bhabits?\b/i.test(norm)) entityType = 'habit';
        else if (/\btasks?\b/i.test(norm)) entityType = 'task';
        else if (/\bcourses?\b/i.test(norm)) entityType = 'course';

        if (entityType && reqCount >= 2) {
            activeAiFlow = {
                step: 'collect_multiple_items',
                entityType,
                targetCount: reqCount,
                collected: []
            };
            const exampleStr = FPi18n.message('ai.example.' + entityType);
            appendAiChatBubble(
                FPi18n.message('ai.flow.collect', {count: reqCount, type: aiEntityMessage(entityType, true), group: aiEntityMessage(entityType, true), example: exampleStr}),
                false,
                'multi_item_flow'
            );
            renderAiFlowPopup();
            return true;
        }
    }

    // 0B. Assignment & Homework Help Flow ("Hello me with my assignment", "help me with my assignment", "I need answers")
    const isAssignmentRequest = /\b(?:assignment|assignments|homework|lab\s+report|problem\s+set)\b/i.test(norm) ||
        /\bhelp\s+me\s+with\s+(?:my\s+)?(?:study|studies|work|task|tasks|course|courses)\b/i.test(norm) ||
        (/^(?:i\s+need\s+answers?|give\s+(?:me\s+)?answers?|need\s+answers?|solve\s+it|solve\s+my\s+tasks?)$/i.test(norm));

    if (isAssignmentRequest) {
        const pendingTasks = ((window.appState && window.appState.tasks) || []).filter(t => !t.completed);

        // If user said "I need answers" right after asking for assignment help, or asked to solve all, deliver the answers immediately!
        if (/^(?:i\s+need\s+answers?|give\s+(?:me\s+)?answers?|need\s+answers?|solve\s+all)$/i.test(norm)) {
            if (pendingTasks.length > 0) {
                const solutions = pendingTasks.slice(0, 3).map(t => buildAssignmentSolutionText(t)).join('\n\n');
                activeAiFlow = { step: 'post_assignment_actions', taskId: pendingTasks[0].id };
                appendAiChatBubble(solutions, false, 'study_answer');
                renderAiFlowPopup();
                return true;
            }
        }

        // Check if user mentioned a specific assignment/subject in the message (e.g. "help me with my physics assignment")
        const specificTask = findTaskFromText(norm);
        if (specificTask && !/^(?:hello|help)\s+me\s+with\s+(?:my\s+)?assignments?$/i.test(norm)) {
            const ans = buildAssignmentSolutionText(specificTask);
            activeAiFlow = { step: 'post_assignment_actions', taskId: specificTask.id };
            appendAiChatBubble(ans, false, 'study_answer');
            renderAiFlowPopup();
            return true;
        }

        // Otherwise show their active assignments from the workspace and ask which one they want solved!
        activeAiFlow = { step: 'select_assignment' };
        if (pendingTasks.length > 0) {
            const taskLines = pendingTasks.slice(0, 5).map((t, idx) => `${idx + 1}. **[${t.course || FPi18n.translate('ai.study.task')}] ${FPi18n.resolve(taskTitleMessage(t))}**`).join('\n');
            appendAiChatBubble(
                FPi18n.message('ai.study.choose', {count: pendingTasks.length, list: taskLines}),
                false,
                'assignment_help'
            );
        } else {
            appendAiChatBubble(
                FPi18n.message('ai.study.prompt'),
                false,
                'assignment_help'
            );
        }
        renderAiFlowPopup();
        return true;
    }

    // 1. Interactive Course Editor ("edit my courses", "change my courses", "manage courses", "courses")
    if (/\b(?:edit|change|manage|update|customize|modify|show|list|my)\s+(?:my\s+|available\s+)?courses?\b/.test(norm) ||
        norm === 'courses' || norm === 'course' || norm === 'edit course' || norm === 'change course') {
        const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
        const withoutKeywords = norm.replace(/\b(?:edit|change|manage|update|my|available|courses?)\b/g, '').trim();
        const specificCourse = withoutKeywords ? findCourseFromText(withoutKeywords) : null;

        if (specificCourse) {
            activeAiFlow = { step: 'select_course_edit', courseId: specificCourse.id, courseName: specificCourse.name };
            const code = (specificCourse.code || specificCourse.name.slice(0, 2)).slice(0, 2).toUpperCase();
            appendAiChatBubble(
                FPi18n.message('ai.course.selectedOptions', {code, name: specificCourse.name, color: getColorLabelByHex(specificCourse.color)}),
                false,
                'course_flow'
            );
            renderAiFlowPopup();
            return true;
        }

        activeAiFlow = { step: 'select_course' };
        const listLines = courses.map((c, idx) => {
            const code = (c.code || c.name.slice(0, 2)).slice(0, 2).toUpperCase();
            return FPi18n.translate('ai.course.listItem', {index: idx + 1, name: c.name, code, color: getColorLabelByHex(c.color)});
        }).join('\n');

        appendAiChatBubble(
            FPi18n.message('ai.course.available', {count: courses.length, list: listLines || FPi18n.message('setup.noCoursesAddedYet')}),
            false,
            'course_flow'
        );
        renderAiFlowPopup();
        return true;
    }

    // 2. Interactive Habit Creator ("adddd habit", "add habit", or "add basic habits" when all 5 core habits already exist)
    if (/^(?:add|create|new|make)\s+(?:a\s+|new\s+)?habits?$/i.test(norm) ||
        /\b(?:add|create)\s+(?:a\s+|new\s+|basic\s+|starter\s+)?habits?\b/i.test(norm)) {
        activeAiFlow = { step: 'select_habit' };
        const missingBasic = BASIC_HABITS_PRESETS.filter(preset => !hasAiHabitPreset(preset));

        if (/\bbasic\b/i.test(norm) && missingBasic.length === 0) {
            appendAiChatBubble(
                FPi18n.message('ai.habit.offerExtra'),
                false,
                'habit_flow'
            );
        } else {
            appendAiChatBubble(
                FPi18n.message('ai.habit.offer'),
                false,
                'habit_flow'
            );
        }
        renderAiFlowPopup();
        return true;
    }

    // 3. Interactive Theme & Colour Picker ("change my theme", "change theme", "themes", "change colour")
    if (/\b(?:change|edit|switch|update|choose|pick|my)\s+(?:my\s+|app\s+|site\s+)?(?:themes?|colors?|accents?|appearance)\b/.test(norm) ||
        norm === 'theme' || norm === 'themes' || norm === 'color' || norm === 'colors') {
        activeAiFlow = { step: 'select_theme' };
        const curTheme = window.appState.solidTheme || 'obsidian';
        const curAccent = getColorLabelByHex(window.appState.accentColor || '#5f5bf6');
        appendAiChatBubble(
            FPi18n.message('ai.theme.offer', {theme: aiThemeMessage(curTheme), accent: curAccent}),
            false,
            'theme_flow'
        );
        renderAiFlowPopup();
        return true;
    }

    // 4. Interactive Settings Controller ("change settings", "edit settings", "my settings", "settings")
    if (/\b(?:change|edit|update|manage|modify|adjust|my)\s+(?:my\s+|app\s+|site\s+)?settings?\b/.test(norm) ||
        norm === 'settings' || norm === 'setting') {
        activeAiFlow = { step: 'select_setting' };
        appendAiChatBubble(
            FPi18n.message('ai.settings.offer'),
            false,
            'setting_flow'
        );
        renderAiFlowPopup();
        return true;
    }

    return false;
}

async function handleAiChatSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('ai-chat-input');
    const prompt = (input ? input.value : '').trim();
    if (!prompt) return;
    input.value = '';

    const norm = normalizeAiCommandText(prompt).toLowerCase();

    // 1. If a confirmation popup is waiting above the typefield, allow typing "yes"/"apply" or "no"/"cancel"
    if (pendingAiAction) {
        if (/^(?:yes|y|apply|confirm|ok|sure|do\s+it)$/i.test(norm)) {
            appendUserChatBubble(prompt);
            confirmAiAction();
            return;
        }
        if (/^(?:no|n|cancel|stop|nevermind|nope)$/i.test(norm)) {
            appendUserChatBubble(prompt);
            cancelAiAction();
            return;
        }
        pendingAiAction = null;
        hideAiInlinePopupTray();
    }

    // 2. If a multi-step interactive flow is active, process the step input
    if (activeAiFlow) {
        appendUserChatBubble(prompt);
        const handledByFlow = processActiveAiFlowInput(prompt);
        if (handledByFlow) return;
        // Note: user bubble was already appended above, so pass a flag to avoid double user bubble below
        await executeAiChatCallAfterUserBubble(prompt);
        return;
    }

    // 3. Check one-shot action commands & natural language system intents (Always asks for Apply Yes/No confirmation above the typefield!)
    const actionCmd = parseAiActionCommand(prompt);
    if (actionCmd) {
        appendUserChatBubble(prompt);
        stageAiPendingAction(
            actionCmd,
            FPi18n.message('ai.review.apply', {summary: actionCmd.summary})
        );
        return;
    }

    // 4. Check interactive multi-step flows (Multi-item habits/tasks/courses, Assignments, Courses, Habits, Themes, Settings)
    if (startInteractiveAiFlowIfMatched(prompt)) {
        const history = document.getElementById('ai-chat-history');
        if (history && history.children.length >= 1) {
            const lastAi = history.lastElementChild;
            const userDiv = document.createElement('div');
            userDiv.className = 'flex justify-end';
            userDiv.innerHTML = `<div class="v-accent-btn bg-indigo-600 text-white p-2.5 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm font-medium">${escapeHtml(prompt)}</div>`;
            history.insertBefore(userDiv, lastAi);
            history.scrollTop = history.scrollHeight;
            recordConversationTurn('user', prompt);
        }
        return;
    }

    // 5. Standard factual question, study help, or context-aware follow-up
    await executeAiChatCall(prompt);
}

async function executeAiChatCallAfterUserBubble(promptText) {
    // Re-check one-shot commands and interactive flows if an earlier flow exited onto a new command
    const actionCmd = parseAiActionCommand(promptText);
    if (actionCmd) {
        stageAiPendingAction(
            actionCmd,
            FPi18n.message('ai.review.apply', {summary: actionCmd.summary})
        );
        return;
    }
    if (startInteractiveAiFlowIfMatched(promptText)) {
        return;
    }
    await runCoreAiAnswerPipeline(promptText);
}

// Normalize typos in user queries for reliable offline factual matching
function normalizeQueryText(raw) {
    return String(raw || '')
        .toLowerCase()
        .replace(/prime\s*m(?:i|in|ni)st(?:e|a)?r/g, 'prime minister')
        .replace(/\bpm\b/g, 'prime minister')
        .replace(/pres(?:i|e)d(?:e|a)nt/g, 'president')
        .replace(/cap(?:i|a)t(?:a|o)l/g, 'capital')
        .replace(/[^a-z0-9+\-*/().^%\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const aiFactTopics = {
    'quang hợp': 'photosynthesis', 'ty thể': 'mitochondria', 'ti thể': 'mitochondria',
    'định luật ii newton': 'newton second law', 'định luật i newton': 'newton first law',
    'định luật iii newton': 'newton third law', 'định luật ohm': 'ohm law',
    'định luật snell': 'snell law', 'khúc xạ': 'refraction', 'định lý pythagoras': 'pythagorean theorem',
    'công thức nghiệm bậc hai': 'quadratic formula', 'tích phân từng phần': 'integration by parts',
    'tốc độ ánh sáng': 'speed of light', 'tìm kiếm nhị phân': 'binary search', 'cây đỏ đen': 'red black tree',
    'cây avl': 'avl tree', 'đệ quy': 'recursion', 'phân biệt ram và rom': 'difference between ram and rom'
};
const aiCountryCodes = {india: 'IN', usa: 'US', 'united states': 'US', america: 'US', uk: 'GB', 'united kingdom': 'GB',
    france: 'FR', germany: 'DE', japan: 'JP', china: 'CN', russia: 'RU', canada: 'CA', australia: 'AU',
    italy: 'IT', spain: 'ES', brazil: 'BR', 'south korea': 'KR', uae: 'AE', 'saudi arabia': 'SA', ukraine: 'UA'};
function aiFactQuery(text) {
    const query = text.toLowerCase().replace(/[?.!]+$/, '').trim();
    const topic = query.replace(/^(?:giải thích|cho tôi biết về)\s+/u, '').replace(/\s+là gì$/u, '');
    if (Object.hasOwn(aiFactTopics, topic)) return aiFactTopics[topic];
    const place = /^(thủ đô|thủ tướng|tổng thống|chủ tịch nước)\s+(?:của\s+)?(.+?)(?:\s+là (?:gì|ai|thành phố nào))?$/u.exec(query);
    if (place) {
        const regions = new Intl.DisplayNames(['vi'], {type: 'region'});
        const aliases = {'mỹ': 'usa', 'hoa kỳ': 'usa', 'anh': 'uk', 'nga': 'russia', 'hàn quốc': 'south korea'};
        const country = aliases[place[2]] || Object.keys(aiCountryCodes).find(k => regions.of(aiCountryCodes[k]).toLowerCase() === place[2]);
        if (country) return ({'thủ đô': 'capital of ', 'thủ tướng': 'prime minister of ',
            'tổng thống': 'president of ', 'chủ tịch nước': 'president of '})[place[1]] + country;
    }
    return text;
}

// Instant offline factual knowledge lookup (returns a short, exact answer or null if not matched)
function lookupInstantFactAnswer(promptText) {
    const clean = aiCommandInput(promptText);
    const norm = normalizeQueryText(aiFactQuery(clean));

    // 1. Safe Math & Arithmetic Expressions (e.g. "25 * 4", "what is 144 / 12", "2^10")
    const mathCandidate = clean
        .replace(/^(?:what\s+is|calculate|solve|compute|evaluate|tính)\s+/i, '')
        .replace(/[?=]+$/g, '')
        .trim();
    if (/^[0-9+\-*/().\s^%]+$/.test(mathCandidate) && /[0-9]/.test(mathCandidate) && /[+\-*/^%]/.test(mathCandidate)) {
        try {
            const safeExpr = mathCandidate.replace(/\^/g, '**');
            const result = Function('"use strict"; return (' + safeExpr + ')')();
            if (typeof result === 'number' && isFinite(result)) {
                return FPi18n.translate('ai.fact.math', {expression: mathCandidate, result: FPi18n.formatNumber(Number(result.toFixed(6)), {maximumFractionDigits: 6})});
            }
        } catch (e) {}
    }

    // 2. Current Date / Time / Day queries
    if (/^(?:what\s+time\s+is\s+it|current\s+time|time\s+now)$/.test(norm)) {
        return FPi18n.translate('ai.fact.time', {time: FPi18n.formatDate(new Date(), {hour: '2-digit', minute: '2-digit'})});
    }
    if (/^(?:what\s+(?:is\s+)?(?:today\s*s?\s+)?date|current\s+date|what\s+day\s+is\s+(?:it|today))$/.test(norm)) {
        return FPi18n.translate('ai.fact.date', {date: FPi18n.formatDate(new Date(), {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})});
    }

    // 3. World Leaders & Government Systems (including misconceptions like "Prime Minister of America")
    const hasPM = norm.includes('prime minister');
    const hasPres = norm.includes('president');
    const isUSA = /\b(?:america|usa|u s a|u s|united states|us)\b/.test(norm);

    if (isUSA && hasPM) {
        return FPi18n.translate('ai.fact.usGovernment');
    }
    if (isUSA && hasPres) {
        return FPi18n.translate('ai.fact.usPresident');
    }
    if (/\b(?:india)\b/.test(norm) && hasPM) {
        return FPi18n.translate('ai.fact.indiaPM');
    }
    if (/\b(?:india)\b/.test(norm) && hasPres) {
        return FPi18n.translate('ai.fact.indiaPresident');
    }
    if (/\b(?:uk|united kingdom|britain|great britain|england)\b/.test(norm) && hasPM) {
        return FPi18n.translate('ai.fact.ukPM');
    }
    if (/\b(?:uk|united kingdom|britain|great britain|england)\b/.test(norm) && hasPres) {
        return FPi18n.translate('ai.fact.ukGovernment');
    }
    if (/\b(?:canada)\b/.test(norm) && hasPM) {
        return FPi18n.translate('ai.fact.canadaPM');
    }
    if (/\b(?:australia)\b/.test(norm) && hasPM) {
        return FPi18n.translate('ai.fact.australiaPM');
    }
    if (/\b(?:france)\b/.test(norm) && hasPres) {
        return FPi18n.translate('ai.fact.francePresident');
    }
    if (/\b(?:russia)\b/.test(norm) && hasPres) {
        return FPi18n.translate('ai.fact.russiaPresident');
    }
    if (/\b(?:china)\b/.test(norm) && hasPres) {
        return FPi18n.translate('ai.fact.chinaPresident');
    }
    if (/\b(?:ukraine)\b/.test(norm) && hasPres) {
        return FPi18n.translate('ai.fact.ukrainePresident');
    }
    if (/\b(?:kerala)\b/.test(norm) && /\b(?:chief minister|cm)\b/.test(norm)) {
        return FPi18n.translate('ai.fact.keralaCM');
    }

    // 4. World Capitals
    const capitals = {
        'india': 'New Delhi',
        'usa': 'Washington, D.C.',
        'united states': 'Washington, D.C.',
        'america': 'Washington, D.C.',
        'uk': 'London',
        'united kingdom': 'London',
        'england': 'London',
        'france': 'Paris',
        'germany': 'Berlin',
        'japan': 'Tokyo',
        'china': 'Beijing',
        'russia': 'Moscow',
        'canada': 'Ottawa',
        'australia': 'Canberra',
        'italy': 'Rome',
        'spain': 'Madrid',
        'brazil': 'Brasília',
        'south korea': 'Seoul',
        'uae': 'Abu Dhabi',
        'saudi arabia': 'Riyadh',
        'kerala': 'Thiruvananthapuram'
    };
    if (norm.includes('capital of')) {
        for (const [place, cap] of Object.entries(capitals)) {
            if (norm.includes(place)) {
                const label = place.length <= 3 ? place.toUpperCase() : place.replace(/\b\w/g, c => c.toUpperCase());
                return FPi18n.translate('ai.fact.capital', {place: FPi18n.getCurrentLanguage() === 'vi' && aiCountryCodes[place]
                    ? new Intl.DisplayNames(['vi'], {type: 'region'}).of(aiCountryCodes[place]) : label, capital: cap});
            }
        }
    }

    // 5. Core Science, Math & Computer Science Quick Facts
    const quickFacts = [
        { match: /\bphotosynthesis\b/, ans: FPi18n.translate('ai.fact.photosynthesis') },
        { match: /\bmitochondria\b/, ans: FPi18n.translate('ai.fact.mitochondria') },
        { match: /\bnewton.*second law\b|\bf\s*=\s*m\s*a\b/, ans: FPi18n.translate('ai.fact.newtonSecond') },
        { match: /\bnewton.*first law\b|\blaw of inertia\b/, ans: FPi18n.translate('ai.fact.newtonFirst') },
        { match: /\bnewton.*third law\b/, ans: FPi18n.translate('ai.fact.newtonThird') },
        { match: /\bohm.*law\b/, ans: FPi18n.translate('ai.fact.ohm') },
        { match: /\bsnell.*law\b|\brefraction\b/, ans: FPi18n.translate('ai.fact.snell') },
        { match: /\bpythagor(?:ean|as)\b/, ans: FPi18n.translate('ai.fact.pythagoras') },
        { match: /\bquadratic formula\b/, ans: FPi18n.translate('ai.fact.quadratic') },
        { match: /\bintegration by parts\b/, ans: FPi18n.translate('ai.fact.integration') },
        { match: /\bspeed of light\b/, ans: FPi18n.translate('ai.fact.lightSpeed') },
        { match: /\bbinary search\b/, ans: FPi18n.translate('ai.fact.binarySearch') },
        { match: /\bred black tree\b/, ans: FPi18n.translate('ai.fact.redBlack') },
        { match: /\bavl tree\b/, ans: FPi18n.translate('ai.fact.avl') },
        { match: /\brecursion\b/, ans: FPi18n.translate('ai.fact.recursion') },
        { match: /\bdifference between ram and rom\b/, ans: FPi18n.translate('ai.fact.memory') },
        { match: /\bwho (?:created|made|developed|built) focuspulse\b|\bfoc it\b|\bazmee\b/, ans: FPi18n.translate('ai.fact.developer') }
    ];
    for (const item of quickFacts) {
        if (item.match.test(norm)) {
            return item.ans;
        }
    }

    return null;
}

// Built-in FocusPulse study & productivity coach responses (NO unsolicited Pomodoro/Task stat spamming!)
function generateSmartLocalAiResponse(promptText) {
    // 1. Check direct factual answers first
    const directFact = lookupInstantFactAnswer(promptText);
    if (directFact) return directFact;

    const q = normalizeAiCommandText(promptText).toLowerCase();
    const state = window.appState;
    const userName = (state.user && state.user.name) ? state.user.name.split(' ')[0] : FPi18n.translate('nav.scholar');
    const subjects = (state.user && state.user.subjects) ? state.user.subjects : FPi18n.translate('ai.study.subjects');
    const pendingTasks = (state.tasks || []).filter(t => !t.completed);
    const completedTasks = (state.tasks || []).filter(t => t.completed);
    const habits = state.habits || [];
    const todayKey = formatDateKey(new Date());
    const habitsDoneToday = habits.filter(h => h.logs && h.logs[todayKey]).length;
    const uncheckedHabitsToday = habits.filter(h => !(h.logs && h.logs[todayKey]));
    const waterPct = Math.min(100, Math.round(((state.waterIntakeMl || 0) / (state.dailyWaterGoalMl || 2500)) * 100));
    const focusMins = Math.round((state.timer.totalFocusSecs || 0) / 60);
    const topTask = pendingTasks.length > 0 ? taskTitleMessage(pendingTasks[0]) : FPi18n.message('ai.study.reviewing', {subject: subjects.split(',')[0]});
    const nextHabitName = uncheckedHabitsToday.length > 0 ? habitNameMessage(uncheckedHabitsToday[0]) : FPi18n.message('ai.study.habits');

    // 2. Context-aware follow-up check (e.g. if user says "explain more", "give me an example", "what about the second one?")
    if (/^(?:explain\s+more|tell\s+me\s+more|give\s+(?:me\s+)?an?\s+example|elaborate)$/i.test(q) && aiConversationMemory.lastAnswerText) {
        return FPi18n.translate('ai.coach.explain');
    }
    if (/\b(?:second|2nd|next)\s+(?:one|assignment|task)\b/i.test(q) && pendingTasks[1]) {
        return buildAssignmentSolutionText(pendingTasks[1]);
    }
    if (/\b(?:third|3rd|last)\s+(?:one|assignment|task)\b/i.test(q) && pendingTasks[2]) {
        return buildAssignmentSolutionText(pendingTasks[2]);
    }

    // 3. Standalone Greetings ONLY (never matches "hello me with my assignment", and NEVER spams task/Pomodoro stats!)
    const isStandaloneGreeting = /^(?:hi|hello|hey|yo|sup|howdy|good\s*(?:morning|afternoon|evening)|how\s+are\s+you|what'?s\s+up)[!.?]*$/i.test(q);
    if (isStandaloneGreeting) {
        return FPi18n.translate('ai.coach.hello', {name: userName});
    }

    // 4. Daily Planning & Schedules
    if (q.includes('plan my day') || q.includes('schedule') || q.includes('timeblock')) {
        const secondTask = pendingTasks.length > 1 ? taskTitleMessage(pendingTasks[1]) : FPi18n.message('ai.study.recall', {subject: subjects});
        return FPi18n.translate('ai.coach.plan', {name: userName, focus: state.timerSettings.pomodoro, first: topTask, rest: state.timerSettings.short, water: state.glassSizeMl, habit: nextHabitName, second: secondTask});
    }

    // 5. Task Prioritization
    if (q.includes('prioritize') || q === 'tasks' || q === 'my tasks' || q.includes('urgent') || q.includes('backlog')) {
        if (pendingTasks.length === 0) {
            return FPi18n.translate('ai.coach.emptyQueue');
        }
        const sorted = [...pendingTasks].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        const listStr = sorted.slice(0, 4).map((t, idx) => FPi18n.translate('ai.study.priorityItem', {index: idx + 1, course: t.course || FPi18n.message('ai.study.task'), title: taskTitleMessage(t), date: FPi18n.dateMessage(t.dueDate)})).join('\n');
        return FPi18n.translate('ai.coach.priority', {count: pendingTasks.length, list: listStr});
    }

    // 6. Procrastination / Stuck
    if (q.includes('procrastinat') || q.includes('lazy') || q.includes('stuck') || q.includes('unmotivated')) {
        return FPi18n.translate('ai.coach.twoMinutes', {task: topTask});
    }

    // 7. Burnout / Stress / Tired
    if (q.includes('overwhelm') || q.includes('stress') || q.includes('tired') || q.includes('burnout')) {
        return FPi18n.translate('ai.coach.energy');
    }

    // 8. Exam Strategy
    if (q.includes('exam') || q.includes('revision') || q.includes('active recall') || q.includes('spaced repetition')) {
        return FPi18n.translate('ai.coach.exam');
    }

    // 9. Habit Tips / Status (only when explicitly asking for habit tips or status)
    if (q === 'habit tips' || q === 'habit status' || q === 'my habits' || q.includes('streak')) {
        return FPi18n.translate('ai.coach.habit', {done: habitsDoneToday, total: habits.length, streak: state.streakCount, next: nextHabitName});
    }

    // 10. Progress Report & Stats (ONLY shown when user explicitly asks for stats/progress/report!)
    if (q.includes('stats') || q.includes('progress') || q.includes('report') || q.includes('summary')) {
        const totalTasks = pendingTasks.length + completedTasks.length;
        const taskPct = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 100;
        const habitPct = habits.length > 0 ? Math.round((habitsDoneToday / habits.length) * 100) : 0;
        return FPi18n.translate('ai.coach.progress', {minutes: focusMins, streak: state.streakCount, tasksDone: completedTasks.length, tasks: totalTasks, taskPct, habitsDone: habitsDoneToday, habits: habits.length, habitPct, water: state.waterIntakeMl, goal: state.dailyWaterGoalMl, waterPct});
    }

    // 11. Help / Commands
    if (q === 'help' || q.includes('ai commands') || q.includes('what can you do')) {
        return FPi18n.translate('ai.coach.help');
    }

    return null;
}

// Fetch a short, accurate, context-aware answer from live cloud AI or Wikipedia when online
async function fetchShortAccurateOnlineAnswer(promptText, geminiKey) {
    const recentHistory = aiConversationMemory.messages
        .slice(-4)
        .map(m => `${m.role === 'user' ? 'User' : 'Zenith AI'}: ${m.text}`)
        .join('\n');
    const pendingTaskNames = ((window.appState && window.appState.tasks) || [])
        .filter(t => !t.completed)
        .map(t => `${t.title} (${t.course || 'General'})`)
        .join('; ');

    const responseLanguage = FPi18n.getCurrentLanguage();
    const sysInstruction = `You are Zenith AI inside FocusPulse. Answer the user's question directly, accurately, and concisely (1 to 3 sentences). Do NOT spam Pomodoro timers or task counts unless asked. Active user assignments: ${pendingTaskNames || 'None'}. Recent chat context:\n${recentHistory}\n\n${FPi18n.translate('ai.system.language')}`;

    // 1. Try Google Gemini API if a valid AIza... key is configured
    if (/^AIza[0-9A-Za-z_-]{25,}$/.test(geminiKey)) {
        const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        for (const modelName of models) {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: `${sysInstruction}\n\nUser: ${promptText}` }] }]
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (text.trim()) return text.trim();
                }
            } catch (e) {}
        }
    }

    // 2. Try Free Keyless Cloud AI endpoint (Pollinations OpenAI-compatible API) with conversation history
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5500);
        const res = await fetch('https://text.pollinations.ai/openai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ctrl.signal,
            body: JSON.stringify({
                model: 'openai',
                messages: [
                    { role: 'system', content: sysInstruction },
                    ...aiConversationMemory.messages.slice(-4).map(m => ({
                        role: m.role === 'user' ? 'user' : 'assistant',
                        content: m.text
                    })),
                    { role: 'user', content: promptText }
                ],
                temperature: 0.2
            })
        });
        clearTimeout(timer);
        if (res.ok) {
            const data = await res.json();
            const msg = data?.choices?.[0]?.message?.content || '';
            if (msg && msg.trim().length > 2) {
                return msg.trim();
            }
        }
    } catch (e) {}

    // 3. Try Wikipedia OpenSearch + Summary API ONLY for genuine factual/encyclopedia queries
    // Never send conversational, first-person, or app-control phrases ("I need answers", "help me", "add a new two habits") to Wikipedia!
    const normCheck = normalizeAiCommandText(promptText).toLowerCase();
    const isConversationalOrAppPhrase = /\b(?:i\s+need|help\s+me|hello\s+me|can\s+you|could\s+you|please|my|our|site|app|edit|change|add|create|make|delete|remove|update|switch|course|theme|habit|task|assignment|homework|answer|answers|setting|color|timer|pomodoro|water|streak)\b/.test(normCheck);

    if (responseLanguage === 'en' && !isConversationalOrAppPhrase) {
        try {
            const cleanQuery = promptText
                .replace(/^(?:who\s+is|what\s+is|what\s+are|where\s+is|when\s+was|tell\s+me\s+about|define|explain)\s+(?:the\s+|a\s+|an\s+)?/i, '')
                .replace(/[?!.]+$/g, '')
                .trim();
            if (cleanQuery.length >= 2) {
                const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&utf8=&format=json&origin=*&srlimit=1`;
                const sRes = await fetch(searchUrl);
                if (sRes.ok) {
                    const sData = await sRes.json();
                    const topTitle = sData?.query?.search?.[0]?.title;
                    if (topTitle) {
                        const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`;
                        const sumRes = await fetch(sumUrl);
                        if (sumRes.ok) {
                            const sumData = await sumRes.json();
                            if (sumData && sumData.extract && sumData.type !== 'disambiguation' && !/may refer to:/i.test(sumData.extract)) {
                                const sentences = sumData.extract.match(/[^.!?]+[.!?]+/g) || [sumData.extract];
                                return sentences.slice(0, 2).join(' ').trim();
                            }
                        }
                    }
                }
            }
        } catch (e) {}
    }

    return null;
}

async function runCoreAiAnswerPipeline(promptText) {
    // 1. Check built-in instant facts, assignment solver, & context-aware intents first (0ms latency)
    let replyText = generateSmartLocalAiResponse(promptText);

    // 2. If not a built-in coaching command or cached fact, fetch a short, accurate answer online
    if (!replyText) {
        const history = document.getElementById('ai-chat-history');
        const loadingId = 'ai-loading-' + (++aiRequestSequence);
        if (history) {
            history.insertAdjacentHTML('beforeend', `
                <div id="${loadingId}" class="flex gap-2">
                    <div class="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5" style="color:var(--v-accent)">
                        <i class="fa-solid fa-robot text-[10px]"></i>
                    </div>
                    <div class="bg-white/70 dark:bg-white/10 border border-white/60 dark:border-white/10 p-2.5 rounded-2xl rounded-tl-none text-slate-600 dark:text-slate-300 text-[11px] font-semibold" data-i18n="ai.ui.thinking">Thinking...</div>
                </div>
            `);
            history.scrollTop = history.scrollHeight;
        }

        const rawKey = (
            (window.appState && window.appState.geminiApiKey) ||
            (window.FP_PRIVATE_CONFIG && window.FP_PRIVATE_CONFIG.geminiApiKey) ||
            ''
        ).trim();

        // A reply belongs to the language used in its request. Retry once if the user switched mid-turn.
        const requestedLanguage = FPi18n.getCurrentLanguage();
        replyText = await fetchShortAccurateOnlineAnswer(promptText, rawKey);
        if (requestedLanguage !== FPi18n.getCurrentLanguage()) {
            const retryLanguage = FPi18n.getCurrentLanguage();
            replyText = await fetchShortAccurateOnlineAnswer(promptText, rawKey);
            if (retryLanguage !== FPi18n.getCurrentLanguage()) replyText = FPi18n.translate('ai.ui.langChanged');
        }

        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
    }

    // 3. Context-aware fallback if offline
    if (!replyText) {
        const matchedTask = findTaskFromText(promptText);
        if (matchedTask) {
            replyText = buildAssignmentSolutionText(matchedTask);
            activeAiFlow = { step: 'post_assignment_actions', taskId: matchedTask.id };
            appendAiChatBubble(replyText, false, 'study_answer');
            renderAiFlowPopup();
            return;
        }
        replyText = FPi18n.translate('ai.coach.offline');
    }

    appendAiChatBubble(replyText, false, 'general_qa');
}

async function executeAiChatCall(promptText) {
    appendUserChatBubble(promptText);
    await runCoreAiAnswerPipeline(promptText);
}

function confirmAiAction() {
    hideAiInlinePopupTray();
    if (!pendingAiAction) return;

    const act = pendingAiAction;
    pendingAiAction = null;
    activeAiFlow = null;

    let confirmMsg = FPi18n.message('ai.result.executed');
    try {
        if (act.type === 'add_basic_habits') {
            if (!Array.isArray(window.appState.habits)) window.appState.habits = [];
            let addedCount = 0;
            BASIC_HABITS_PRESETS.forEach((preset, idx) => {
                if (!hasAiHabitPreset(preset)) {
                    window.appState.habits.push({
                        id: 'h-basic-' + Date.now() + '-' + idx,
                        name: preset.name,
                        category: preset.category,
                        color: preset.color,
                        icon: preset.icon,
                        targetPerWeek: preset.targetPerWeek,
                        logs: {}
                    });
                    addedCount++;
                }
            });
            if (addedCount === 0) {
                confirmMsg = FPi18n.message('ai.result.corePresent');
            } else {
                confirmMsg = FPi18n.message('ai.result.coreAdded', {count: addedCount});
            }
            if (typeof renderHabitsSection === 'function') renderHabitsSection();
        } else if (act.type === 'add_multiple_habits') {
            if (!Array.isArray(window.appState.habits)) window.appState.habits = [];
            const items = Array.isArray(act.items) ? act.items : [];
            const addedNames = [];
            items.forEach((item, idx) => {
                const name = (aiPickedName(item) || '').trim();
                if (!name) return;
                window.appState.habits.unshift({
                    id: 'h-multi-' + Date.now() + '-' + idx,
                    name,
                    category: item.category || 'Productivity',
                    color: item.color || 'violet',
                    icon: item.icon || '⚡',
                    targetPerWeek: item.targetPerWeek || 5,
                    logs: {}
                });
                addedNames.push(`"${name}"`);
            });
            if (typeof renderHabitsSection === 'function') renderHabitsSection();
            confirmMsg = FPi18n.message('ai.result.habitsAdded', {count: addedNames.length, names: addedNames.join(', ')});
        } else if (act.type === 'add_multiple_tasks') {
            if (!Array.isArray(window.appState.tasks)) window.appState.tasks = [];
            const items = Array.isArray(act.items) ? act.items : [];
            const defaultCourse = (window.appState.courses && window.appState.courses[0]) ? window.appState.courses[0].name : 'CS101';
            const addedNames = [];
            items.forEach((item, idx) => {
                const title = (aiPickedName(item) || '').trim();
                if (!title) return;
                window.appState.tasks.unshift({
                    id: 't-multi-' + Date.now() + '-' + idx,
                    title,
                    category: 'Studies',
                    subcategory: 'General',
                    course: item.course || defaultCourse,
                    dueDate: formatDateKey(new Date()),
                    description: FPi18n.translate('ai.preset.description'),
                    completed: false,
                    completedAt: null
                });
                addedNames.push(`"${title}"`);
            });
            confirmMsg = FPi18n.message('ai.result.tasksAdded', {count: addedNames.length, names: addedNames.join(', ')});
        } else if (act.type === 'add_multiple_courses') {
            if (!Array.isArray(window.appState.courses)) window.appState.courses = [];
            const items = Array.isArray(act.items) ? act.items : [];
            const addedNames = [];
            items.forEach((item, idx) => {
                const name = (aiPickedName(item) || '').trim();
                if (!name) return;
                const code = (item.code || name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2)).slice(0, 2).toUpperCase() || 'CR';
                window.appState.courses.push({
                    id: 'course-multi-' + Date.now() + '-' + idx,
                    name,
                    code,
                    color: item.color || '#8b5cf6'
                });
                addedNames.push(`"${name}" [${code}]`);
            });
            window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
            if (typeof renderCoursesSettingsManager === 'function') renderCoursesSettingsManager();
            confirmMsg = FPi18n.message('ai.result.coursesAdded', {count: addedNames.length, names: addedNames.join(', ')});
        } else if (act.type === 'append_study_notes') {
            const prevNotes = (window.appState.quickNotes || '').trim();
            const addition = (act.noteText || '').trim();
            window.appState.quickNotes = prevNotes ? `${prevNotes}\n\n${addition}` : addition;
            const notesArea = document.getElementById('quick-notes-area');
            if (notesArea) notesArea.value = window.appState.quickNotes;
            confirmMsg = FPi18n.message('ai.result.notesSaved');
        } else if (act.type === 'mark_all_habits') {
            const todayKey = formatDateKey(new Date());
            (window.appState.habits || []).forEach(h => {
                if (!h.logs) h.logs = {};
                h.logs[todayKey] = true;
            });
            if (typeof renderHabitsSection === 'function') renderHabitsSection();
            confirmMsg = FPi18n.message('ai.result.allChecked', {count: (window.appState.habits || []).length});
        } else if (act.type === 'add_habit') {
            if (!Array.isArray(window.appState.habits)) window.appState.habits = [];
            const name = aiPickedName(act);
            window.appState.habits.unshift({
                id: 'h-' + Date.now(),
                name,
                category: act.category || 'Productivity',
                color: act.color || 'violet',
                icon: act.icon || '⚡',
                targetPerWeek: act.targetPerWeek || 5,
                logs: {}
            });
            if (typeof renderHabitsSection === 'function') renderHabitsSection();
            confirmMsg = FPi18n.message('ai.result.habitAdded', {name});
        } else if (act.type === 'check_habit') {
            const qLower = (act.query || '').toLowerCase();
            const match = (window.appState.habits || []).find(h => h.name.toLowerCase().includes(qLower));
            if (match) {
                if (!match.logs) match.logs = {};
                match.logs[formatDateKey(new Date())] = true;
                if (typeof renderHabitsSection === 'function') renderHabitsSection();
                confirmMsg = FPi18n.message('ai.result.habitChecked', {name: match.name});
            } else {
                confirmMsg = FPi18n.message('ai.result.noHabit', {query: act.query});
            }
        } else if (act.type === 'delete_habit') {
            const qLower = (act.query || '').toLowerCase();
            const match = (window.appState.habits || []).find(h => h.name.toLowerCase().includes(qLower));
            if (match) {
                window.appState.habits = window.appState.habits.filter(h => h.id !== match.id);
                if (typeof renderHabitsSection === 'function') renderHabitsSection();
                confirmMsg = FPi18n.message('ai.result.habitDeleted', {name: match.name});
            } else {
                confirmMsg = FPi18n.message('ai.result.noHabit', {query: act.query});
            }
        } else if (act.type === 'add_course') {
            if (!Array.isArray(window.appState.courses)) window.appState.courses = [];
            const code = (act.code || act.name.slice(0, 2)).slice(0, 2).toUpperCase();
            window.appState.courses.push({
                id: 'course-' + Date.now(),
                name: act.name,
                code,
                color: act.color || '#8b5cf6'
            });
            window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
            if (typeof renderCoursesSettingsManager === 'function') renderCoursesSettingsManager();
            confirmMsg = FPi18n.message('ai.result.courseAdded', {name: act.name, code});
        } else if (act.type === 'edit_course') {
            const courseObj = (window.appState.courses || []).find(c => c.id === act.courseId);
            if (courseObj) {
                const oldName = courseObj.name;
                if (act.newName) {
                    courseObj.name = act.newName;
                    (window.appState.tasks || []).forEach(t => {
                        if (t.course === oldName) t.course = act.newName;
                    });
                }
                if (act.newCode) {
                    courseObj.code = act.newCode.slice(0, 2).toUpperCase();
                }
                if (act.newColor) {
                    courseObj.color = act.newColor;
                }
                window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
                if (typeof renderCoursesSettingsManager === 'function') renderCoursesSettingsManager();
                const code = (courseObj.code || courseObj.name.slice(0, 2)).slice(0, 2).toUpperCase();
                confirmMsg = FPi18n.message('ai.result.courseUpdated', {name: courseObj.name, code, color: getColorLabelByHex(courseObj.color)});
            }
        } else if (act.type === 'delete_course') {
            const target = (window.appState.courses || []).find(c => c.id === act.courseId);
            if (target) {
                window.appState.courses = window.appState.courses.filter(c => c.id !== act.courseId);
                window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
                if (typeof renderCoursesSettingsManager === 'function') renderCoursesSettingsManager();
                confirmMsg = FPi18n.message('ai.result.courseDeleted', {name: target.name});
            }
        } else if (act.type === 'set_solid_theme') {
            if (typeof setSolidTheme === 'function') {
                setSolidTheme(act.themeId);
            } else {
                window.appState.solidTheme = act.themeId;
                applyThemeVariables();
            }
            confirmMsg = FPi18n.message('ai.result.theme', {theme: aiThemeMessage(act.themeName || act.themeId)});
        } else if (act.type === 'set_accent_color') {
            if (typeof setAccentColor === 'function') {
                setAccentColor(act.hex);
            } else {
                window.appState.accentColor = act.hex;
                applyThemeVariables();
            }
            confirmMsg = FPi18n.message('ai.result.accent', {color: aiColorMessage({hex: act.hex, label: act.label})});
        } else if (act.type === 'surface_mode') {
            if (typeof setSurfaceMode === 'function') setSurfaceMode(act.mode);
            confirmMsg = FPi18n.message('ai.result.surface', {mode: FPi18n.message(act.mode === 'light' ? 'settings.whiteMode' : 'settings.darkMode')});
        } else if (act.type === 'set_liquid_glass') {
            window.appState.liquidEffect = Boolean(act.enabled);
            if (typeof applyLiquidGlass === 'function') applyLiquidGlass(window.appState.liquidEffect);
            confirmMsg = FPi18n.message('ai.result.glass', {action: FPi18n.message(window.appState.liquidEffect ? 'ai.verb.Enabled' : 'ai.verb.Disabled')});
        } else if (act.type === 'add_task') {
            window.appState.tasks.unshift({
                id: Date.now().toString(),
                title: act.title,
                category: 'Studies',
                subcategory: 'General',
                course: (window.appState.courses && window.appState.courses[0]) ? window.appState.courses[0].name : 'CS101',
                dueDate: formatDateKey(new Date()),
                description: FPi18n.translate('ai.preset.description'),
                completed: false,
                completedAt: null
            });
            confirmMsg = FPi18n.message('ai.result.taskAdded', {title: act.title});
        } else if (act.type === 'complete_task') {
            const qLower = (act.query || '').toLowerCase();
            const match = (window.appState.tasks || []).find(t => !t.completed && t.title.toLowerCase().includes(qLower)) || findTaskFromText(act.query);
            if (match) {
                match.completed = true;
                match.completedAt = Date.now();
                confirmMsg = FPi18n.message('ai.result.taskChecked', {title: match.title});
            } else {
                confirmMsg = FPi18n.message('ai.result.noPendingTask', {query: act.query});
            }
        } else if (act.type === 'delete_task') {
            const qLower = (act.query || '').toLowerCase();
            const match = (window.appState.tasks || []).find(t => t.title.toLowerCase().includes(qLower));
            if (match) {
                window.appState.tasks = window.appState.tasks.filter(t => t.id !== match.id);
                confirmMsg = FPi18n.message('ai.result.taskDeleted', {title: match.title});
            } else {
                confirmMsg = FPi18n.message('ai.result.noTask', {query: act.query});
            }
        } else if (act.type === 'add_plan') {
            window.appState.schedules.push({
                id: Date.now().toString(),
                presetName: act.presetName,
                hours: act.hours || 4,
                sessions: act.sessions || 4,
                days: 'Mon, Tue, Wed, Thu, Fri'
            });
            confirmMsg = FPi18n.message('ai.result.plan', {name: act.presetName});
        } else if (act.type === 'start_timer') {
            if (typeof startTimer === 'function') startTimer();
            confirmMsg = FPi18n.message('ai.result.timerStart', {minutes: window.appState.timerSettings.pomodoro || 25});
        } else if (act.type === 'pause_timer') {
            if (typeof pauseTimer === 'function') pauseTimer();
            confirmMsg = FPi18n.message('ai.result.timerPause');
        } else if (act.type === 'set_pomo_preset') {
            if (typeof selectPomoPreset === 'function') {
                selectPomoPreset(act.name, act.focus, act.short, act.long, act.count);
            } else {
                window.appState.timerSettings = { pomodoro: act.focus, short: act.short, long: act.long, sessionsTotal: act.count };
            }
            confirmMsg = FPi18n.message('ai.result.preset', {name: aiTimerPreset(act.name), focus: act.focus, rest: act.short});
        } else if (act.type === 'set_pomo_minutes') {
            window.appState.timerSettings.pomodoro = act.minutes;
            if (!window.appState.timer.isRunning && window.appState.timer.mode === 'pomodoro') {
                window.appState.timer.secondsLeft = act.minutes * 60;
            }
            if (typeof renderTimerDisplay === 'function') renderTimerDisplay();
            confirmMsg = FPi18n.message('ai.result.focus', {minutes: act.minutes});
        } else if (act.type === 'reset_water') {
            window.appState.waterIntakeMl = 0;
            confirmMsg = FPi18n.message('ai.result.waterReset');
        } else if (act.type === 'log_water') {
            window.appState.waterIntakeMl = (window.appState.waterIntakeMl || 0) + (window.appState.glassSizeMl || 250);
            confirmMsg = FPi18n.message('ai.result.waterLogged', {amount: window.appState.glassSizeMl || 250});
        } else if (act.type === 'set_water_goal') {
            window.appState.dailyWaterGoalMl = act.goalMl;
            confirmMsg = FPi18n.message('ai.result.waterGoal', {goal: act.goalMl});
        } else if (act.type === 'set_glass_size') {
            window.appState.glassSizeMl = act.glassMl;
            confirmMsg = FPi18n.message('ai.result.glassSize', {size: act.glassMl});
        } else if (act.type === 'set_performance_mode') {
            if (typeof togglePerformanceMode === 'function') {
                togglePerformanceMode(act.enabled);
            } else {
                window.appState.performanceMode = Boolean(act.enabled);
                applyThemeVariables();
            }
            confirmMsg = FPi18n.message('ai.result.performance', {action: FPi18n.message(act.enabled ? 'ai.verb.Enabled' : 'ai.verb.Disabled')});
        } else if (act.type === 'set_ui_scale') {
            if (typeof setUiScaleDirect === 'function') {
                setUiScaleDirect(act.scale);
            } else {
                window.appState.uiScale = act.scale;
                applyThemeVariables();
            }
            confirmMsg = FPi18n.message('ai.result.scale', {percent: 100 + act.scale * 5});
        } else if (act.type === 'set_sound_enabled') {
            window.appState.soundEnabled = Boolean(act.enabled);
            confirmMsg = FPi18n.message('ai.result.sound', {action: FPi18n.message(act.enabled ? 'ai.verb.Enabled' : 'ai.verb.Muted')});
        } else if (act.type === 'set_notifications_enabled') {
            window.appState.notificationsEnabled = Boolean(act.enabled);
            confirmMsg = FPi18n.message('ai.result.alerts', {action: FPi18n.message(act.enabled ? 'ai.verb.Enabled' : 'ai.verb.Disabled')});
        } else if (act.type === 'restore_missed_streak') {
            if (typeof restoreMissedStreak === 'function') {
                restoreMissedStreak();
            }
            confirmMsg = FPi18n.message('ai.result.streakRestore');
    } else if (act.type === 'set_streak_visibility') {
            window.appState.showStreak = Boolean(act.visible);
            if (typeof toggleStreakBadgeVisibility === 'function') toggleStreakBadgeVisibility(act.visible);
            confirmMsg = FPi18n.message('ai.result.streakBadge', {action: FPi18n.message(act.visible ? 'ai.verb.Showing' : 'ai.verb.Hid')});
        } else if (act.type === 'set_profile_name') {
            window.appState.user.name = act.name;
            window.appState.user.isCustomName = true;
            confirmMsg = FPi18n.message('ai.result.profile', {name: act.name});
        }

        saveState(true);
        if (typeof window.updateUI === 'function') window.updateUI();
        showNotification(FPi18n.message('ai.ui.notice'), confirmMsg, 'success');
        appendAiChatBubble(confirmMsg, true);
    } catch (err) {
        showNotification(FPi18n.message('ai.ui.notice'), FPi18n.message('ai.ui.failed'), 'warning');
    }
}

function cancelAiAction() {
    hideAiInlinePopupTray();
    pendingAiAction = null;
    activeAiFlow = null;
    appendAiChatBubble(FPi18n.message('ai.result.cancelled'));
    showNotification(FPi18n.message('ai.ui.cancelled'), FPi18n.message('ai.ui.noChanges'), 'info');
}
