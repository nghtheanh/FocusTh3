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
