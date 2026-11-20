(() => {
    'use strict';

    const catalogs = window.FocusPulseLocales;
    const defaultLanguage = 'en';
    const storageKey = 'focuspulse_locale';
    const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
    let currentLanguage = defaultLanguage;

    try {
        const saved = localStorage.getItem(storageKey);
        if (hasOwn(catalogs, saved)) currentLanguage = saved;
    } catch {
        // Storage can be unavailable in a private or restricted WebView.
    }
    document.documentElement.lang = currentLanguage;

    const locale = () => ({en: 'en-US', vi: 'vi-VN'}[currentLanguage] || currentLanguage);
    const formatNumber = (value, options) => new Intl.NumberFormat(locale(), options).format(value);
    function formatDate(value, options) {
        if (value == null || value === '') return '';
        const calendarDate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
        const date = new Date(calendarDate ? value + 'T00:00:00' : value);
        return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale(), options).format(date);
    }

    // Messages can be retained by an open dialog or toast and resolved again after a switch.
    const message = (key, params = {}) => ({key, params});
    const dateMessage = (date, options) => ({date, options});
    function resolve(value) {
        if (value && typeof value === 'object' && hasOwn(value, 'date')) return formatDate(value.date, value.options);
        if (value && typeof value === 'object' && hasOwn(value, 'key')) return translate(value.key, value.params);
        return value == null ? '' : String(value);
    }

    function translate(key, params = {}) {
        if (typeof key !== 'string') return '';
        const messages = catalogs[currentLanguage].messages;
        const fallback = catalogs[defaultLanguage].messages;
        const catalog = hasOwn(messages, key) ? messages : fallback;
        if (!hasOwn(catalog, key)) return key;
        return catalog[key].replace(/\{(\w+)\}/g, (placeholder, name) =>
            hasOwn(params, name) ? (typeof params[name] === 'number' ? formatNumber(params[name]) : resolve(params[name])) : placeholder
        );
    }

    const escape = text => String(text).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);

    function markup(key, params) {
        const args = params ? ' data-i18n-params="' + escape(JSON.stringify(params)) + '"' : '';
        return '<span data-i18n="' + escape(key) + '"' + args + '>' + escape(translate(key, params)) + '</span>';
    }

    function messageHtml(value) {
        return value && typeof value === 'object' ? markup(value.key, value.params) : escape(resolve(value));
    }

    const attributes = ['title', 'aria-label', 'placeholder', 'alt'];
    function attributeMarkup(attribute, key, params) {
        if (!attributes.includes(attribute)) return '';
        const args = params ? ' data-i18n-params="' + escape(JSON.stringify(params)) + '"' : '';
        return attribute + '="' + escape(translate(key, params)) + '" data-i18n-' + attribute + '="' + escape(key) + '"' + args;
    }
    const selector = ['[data-i18n]', ...attributes.map(a => '[data-i18n-' + a + ']')].join(',');
    function applyLabel(element) {
        const params = element.dataset.i18nParams ? JSON.parse(element.dataset.i18nParams) : {};
        if (element.dataset.i18n) {
            const text = translate(element.dataset.i18n, params);
            if (element.textContent !== text) element.textContent = text;
        }
        for (const attribute of attributes) {
            const key = element.getAttribute('data-i18n-' + attribute);
            if (key) element.setAttribute(attribute, translate(key, params));
        }
    }

    // Rebind an existing text node without replacing a focused control or its listeners.
    function bind(element, key, params) {
        if (!element) return;
        element.dataset.i18n = key;
        if (params) element.dataset.i18nParams = JSON.stringify(params);
        else delete element.dataset.i18nParams;
        applyLabel(element);
    }

    function apply(root) {
        if (root.nodeType === 1 && root.matches(selector)) applyLabel(root);
        root.querySelectorAll(selector).forEach(applyLabel);
    }

    function refreshLabels() {
        apply(document);
        for (const select of document.querySelectorAll('[data-language-select]')) {
            select.value = currentLanguage;
            select.title = translate('language.current', {language: catalogs[currentLanguage].name});
        }
    }

    function setLanguage(language) {
        if (!hasOwn(catalogs, language)) return false;
        if (language === currentLanguage) return true;
        currentLanguage = language;
        document.documentElement.lang = language;
        try {
            localStorage.setItem(storageKey, language);
        } catch {
            // The current page can still switch languages in memory.
        }
        refreshLabels();
        window.dispatchEvent(new CustomEvent('focuspulse:languagechange', {detail: {language}}));
        return true;
    }

    window.FPi18n = {getCurrentLanguage: () => currentLanguage, setLanguage, translate,
        message, dateMessage, resolve, bind, markup, attributeMarkup, messageHtml, apply, formatDate, formatNumber, getLocale: locale};

    document.addEventListener('DOMContentLoaded', () => {
        for (const select of document.querySelectorAll('[data-language-select]')) {
            for (const [language, catalog] of Object.entries(catalogs)) {
                const option = new Option(catalog.name, language);
                option.lang = language;
                select.add(option);
            }
            select.addEventListener('change', () => setLanguage(select.value));
        }
        refreshLabels();
        document.addEventListener('invalid', event => {
            const input = event.target;
            if (!input.closest('#pomo-inline-settings, #fp-onboarding-shell, #view-section-account, #account-modal, #view-section-settings, #settings-modal')) return;
            const validity = input.validity;
            if (!validity || validity.customError) return;
            let key = 'validation.invalid';
            if (validity.valueMissing) key = 'validation.required';
            else if (validity.typeMismatch && input.type === 'email') key = 'validation.email';
            else if (validity.tooShort) key = 'validation.minLength';
            else if (validity.rangeUnderflow) key = 'validation.minimum';
            else if (validity.rangeOverflow) key = 'validation.maximum';
            input.setCustomValidity(translate(key, {
                min: validity.tooShort ? input.minLength : input.min, max: input.max
            }));
            // Let the browser display the message, then return validation to the native constraints.
            Promise.resolve().then(() => input.setCustomValidity(''));
        }, true);
        // Each renderer owns its DOM. Only hydrate marked nodes it inserts, never redraw its form.
        new MutationObserver(records => {
            for (const record of records) {
                for (const node of record.addedNodes) {
                    if (node.nodeType === 1 && node.isConnected) apply(node);
                }
            }
        }).observe(document.body, {childList: true, subtree: true});
    });
})();
