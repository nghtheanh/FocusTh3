const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(language) {
    const context = vm.createContext({
        window: {},
        document: {documentElement: {}, addEventListener() {}},
        localStorage: {getItem: () => language}
    });
    for (const file of ['locales/en.js', 'locales/vi.js', 'i18n.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
    }
    return context.window;
}

test('English and Vietnamese cover the same keys and named parameters', () => {
    const {en, vi} = load('en').FocusPulseLocales;
    assert.deepEqual(Object.keys(en.messages).sort(), Object.keys(vi.messages).sort());
    const params = text => [...new Set(text.match(/\{\w+\}/g))].sort();
    for (const [key, english] of Object.entries(en.messages)) {
        const vietnamese = vi.messages[key];
        assert.ok(english.trim() && vietnamese.trim(), key);
        assert.deepEqual(params(vietnamese), params(english), key);
        assert.doesNotMatch(vietnamese, /\uFFFD/, key);
    }
});

test('locale formatting preserves the calendar day and formats numeric quantities', () => {
    const options = {day: '2-digit', month: '2-digit', year: 'numeric'};
    const en = load('en').FPi18n;
    const vi = load('vi').FPi18n;
    assert.equal(en.formatDate('2024-02-29', options), '02/29/2024');
    assert.equal(vi.formatDate('2024-02-29', options), '29/02/2024');
    assert.equal(en.formatNumber(12345.5), '12,345.5');
    assert.equal(vi.formatNumber(12345.5), '12.345,5');
});

test('literal translation keys in HTML and JavaScript resolve in the base catalog', () => {
    const {en} = load('en').FocusPulseLocales;
    const root = path.join(__dirname, '..');
    const files = ['index.html', ...fs.readdirSync(path.join(root, 'js'))
        .filter(name => name.endsWith('.js')).map(name => 'js/' + name)];
    const binding = /(?:FPi18n\.(?:translate|message|markup)\(\s*|data-i18n(?:-(?:alt|title|aria-label|placeholder))?=)\\?["']([\w]+(?:\.[\w]+)+)\\?["']/g;
    for (const file of files) {
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        for (const [, key] of source.matchAll(binding)) {
            assert.ok(Object.hasOwn(en.messages, key), file + ' references ' + key);
        }
    }
});

test('message parameters preserve user input, escape markup and follow the selected language', () => {
    const {FPi18n: i18n, FocusPulseLocales: catalogs} = load('vi');
    const name = 'Settings <img src=x> & "Health"';
    const notice = i18n.message('auth.welcome', {name});
    assert.ok(i18n.resolve(notice).includes(name));
    assert.ok(!i18n.messageHtml(notice).includes('<img'));
    assert.equal(i18n.messageHtml('Settings'), 'Settings');
    const color = i18n.message('appearance.indigo');
    assert.equal(i18n.translate('appearance.accentSwatch', {color, hex: '#123456'}), 'Chàm (#123456)');
    delete catalogs.vi.messages['auth.welcome'];
    assert.equal(i18n.resolve(notice), 'Welcome, ' + name + '! 👋');
});

test('a selected week is reformatted from its original calendar dates after a switch', () => {
    const en = load('en').FPi18n;
    const vi = load('vi').FPi18n;
    const options = {month: 'short', day: 'numeric'};
    const week = en.message('stats.dateRange', {
        start: en.dateMessage('2024-02-26', options),
        end: en.dateMessage('2024-03-03', options)
    });
    const stored = JSON.stringify(week);
    assert.equal(en.resolve(week), 'Feb 26 – Mar 3');
    assert.equal(vi.resolve(JSON.parse(stored)),
        vi.formatDate('2024-02-26', options) + ' – ' + vi.formatDate('2024-03-03', options));
    assert.equal(JSON.stringify(week), stored);
    const tooltip = vi.attributeMarkup('title', 'stats.markDay', {
        name: 'Read "<b>"', day: vi.dateMessage('2024-02-29', {weekday: 'short'}),
        date: vi.dateMessage('2024-02-29')
    });
    assert.match(tooltip, /29\/2\/2024/);
    assert.match(tooltip, /&quot;&lt;b&gt;&quot;/);
    assert.doesNotMatch(tooltip, /<b>|undefined/);
});

test('rebinding the same timer label replaces its previous key and parameters', () => {
    const vi = load('vi').FPi18n;
    const element = {dataset: {}, textContent: '', getAttribute() { return null; }};
    vi.bind(element, 'timer.session', {current: 2, total: 4});
    assert.equal(element.textContent, 'Phiên 2/4');
    vi.bind(element, 'timer.pause');
    assert.equal(element.textContent, 'Tạm dừng');
    assert.equal(element.dataset.i18n, 'timer.pause');
    assert.equal(element.dataset.i18nParams, undefined);
    vi.bind(element, 'timer.start');
    assert.equal(element.textContent, 'Bắt đầu');
});

function loadModuleUI(language) {
    const {FPi18n, FocusPulseLocales} = load(language);
    const context = vm.createContext({
        FPi18n,
        window: {FocusPulseLocales, addEventListener() {}},
        document: {addEventListener() {}}
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8'), context);
    return context;
}

function loadCoach(language) {
    const context = loadModuleUI(language);
    Object.assign(context, {AbortController, setTimeout, clearTimeout});
    context.window.appState = {tasks: [], habits: [], courses: []};
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ai.js'), 'utf8'), context);
    return context;
}

test('Zenith routes translated commands while preserving typed names and pending actions', () => {
    const vi = loadCoach('vi');
    const en = load('en').FPi18n;
    const title = 'HỌC "adddd" <b> & AI';
    const command = vi.parseAiActionCommand('Thêm công việc: ' + title);
    assert.equal(command.type, 'add_task');
    assert.equal(command.title, title);
    assert.deepEqual(vi.window.appState.tasks, []);
    for (const i18n of [en, vi.FPi18n]) {
        assert.equal(i18n.resolve(command.summary), i18n.translate('ai.summary.newTask', {title}));
        assert.ok(!i18n.messageHtml(command.summary).includes('<b>'));
    }
    assert.equal(vi.aiCommandInput('Thêm 2 thói quen'), 'add 2 habits');
    for (const intent of ['courses', 'habits', 'theme', 'settings', 'plan', 'priority', 'exam', 'stuck', 'progress', 'tips', 'energy', 'help']) {
        const key = 'ai.prompt.' + intent;
        assert.equal(vi.aiCommandInput(vi.FPi18n.translate(key)), en.translate(key));
    }
});

test('offline Zenith uses Vietnamese queries, school subjects and numeric formatting', () => {
    const vi = loadCoach('vi');
    const en = loadCoach('en');
    assert.match(vi.lookupInstantFactAnswer('Tính 5 / 2'), /2,5/);
    assert.match(en.lookupInstantFactAnswer('calculate 5 / 2'), /2\.5/);
    assert.equal(vi.lookupInstantFactAnswer('Quang hợp là gì?'), vi.FPi18n.translate('ai.fact.photosynthesis'));
    const task = {title: 'Tích phân của An', course: 'Toán'};
    assert.equal(vi.buildAssignmentSolutionText(task), vi.FPi18n.translate('ai.study.calculus', {title: task.title, course: task.course}));
    const habit = {id: 'h-basic-123-1', name: 'Read 20 Pages of Textbook'};
    assert.equal(vi.FPi18n.resolve(vi.habitNameMessage(habit)), vi.FPi18n.translate('ai.preset.read'));
    assert.equal(vi.habitNameMessage({...habit, name: 'My new name'}), 'My new name');
    assert.equal(vi.habitNameMessage({...habit, id: 'custom'}), habit.name);
});

test('confirming the core habit set twice preserves existing habits, logs and translated names', () => {
    const coach = loadCoach('vi');
    const habits = coach.window.appState.habits;
    const personal = {id: 'custom-1', name: 'My Habit', logs: {'2026-04-12': true}};
    const selected = {id: 'custom-2', name: coach.FPi18n.translate('ai.preset.read'), logs: {}};
    habits.push(personal, selected);
    coach.document.getElementById = () => null;
    coach.window.updateUI = () => {};
    coach.saveState = () => {};
    coach.renderHabitsSection = () => {};
    let lastNotice;
    coach.showNotification = (title, msg, type) => { lastNotice = {msg, type}; };
    coach.handleAiAddAllBasicHabitsPick();
    coach.confirmAiAction();
    assert.equal(habits.length, 6);
    assert.equal(lastNotice.type, 'success');
    const snapshot = JSON.stringify(habits);
    coach.handleAiAddAllBasicHabitsPick();
    coach.confirmAiAction();
    assert.equal(lastNotice.msg.key, 'ai.result.corePresent');
    assert.equal(JSON.stringify(coach.window.appState.habits), snapshot);
    assert.equal(habits[0], personal);
    assert.equal(habits[1], selected);
});

test('both Zenith providers receive the active language and the original question', async () => {
    const question = 'Giải thích từ “closure” trong JavaScript';
    for (const language of ['vi', 'en']) {
        const coach = loadCoach(language);
        const instruction = coach.FPi18n.translate('ai.system.language');
        const calls = [];
        coach.fetch = async (url, options) => {
            calls.push({url, body: JSON.parse(options.body)});
            return {ok: true, json: async () => ({
                candidates: [{content: {parts: [{text: 'Gemini reply'}]}}],
                choices: [{message: {content: 'Pollinations reply'}}]
            })};
        };
        const key = 'AIza' + '0'.repeat(26);
        assert.equal(await coach.fetchShortAccurateOnlineAnswer(question, key), 'Gemini reply');
        assert.equal(await coach.fetchShortAccurateOnlineAnswer(question, ''), 'Pollinations reply');
        assert.ok(calls[0].url.endsWith('/gemini-2.5-flash:generateContent?key=' + key));
        const prompt = calls[0].body.contents[0].parts[0].text;
        assert.ok(prompt.includes(instruction) && prompt.endsWith(question));
        assert.equal(calls[1].url, 'https://text.pollinations.ai/openai');
        assert.equal(calls[1].body.model, 'openai');
        assert.ok(calls[1].body.messages[0].content.includes(instruction));
        assert.deepEqual(calls[1].body.messages.at(-1), {role: 'user', content: question});
    }
});

test('only identified sample records translate a matching name', () => {
    const ui = loadModuleUI('vi');
    const title = "Plan today's top priorities";
    assert.equal(ui.FPi18n.resolve(ui.taskTitleMessage({id: '1', title})), 'Lên danh sách việc ưu tiên hôm nay');
    assert.equal(ui.taskTitleMessage({id: 'task-2', title}), title);
    for (const id of ['1', 'sched-ob-1', 'sched-balanced-123']) {
        assert.equal(ui.FPi18n.resolve(ui.scheduleNameMessage({id, presetName: 'Balanced Weekdays'})),
            ui.FPi18n.translate('auth.balancedWeekdays'));
    }
    assert.equal(ui.scheduleNameMessage({id: '123', presetName: 'Balanced Weekdays'}), 'Balanced Weekdays');
    assert.equal(ui.scheduleNameMessage({id: '2', presetName: 'My <Plan>'}), 'My <Plan>');
});

test('the plan editor loads saved weekday codes, including legacy ranges', () => {
    const ui = loadModuleUI('vi');
    const inputs = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(value => ({value}));
    ui.document.querySelectorAll = () => inputs;
    for (const [days, expected] of [
        ['Sat, Sun', ['Sat', 'Sun']],
        ['Mon - Fri', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']],
        ['Fri – Mon', ['Mon', 'Fri', 'Sat', 'Sun']]
    ]) {
        ui.populateScheduleDays(days);
        assert.deepEqual(inputs.filter(input => input.checked).map(input => input.value), expected);
        assert.ok(inputs.every(input => input.checked === input.defaultChecked));
    }
    assert.match(ui.scheduleDaysHtml('Sat, Sun'), /Thứ 7/);
    assert.match(ui.scheduleDaysHtml('Sat, Sun'), /CN/);
});
