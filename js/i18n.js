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

    function translate(key, params = {}) {
        const messages = catalogs[currentLanguage].messages;
        const fallback = catalogs[defaultLanguage].messages;
        const catalog = hasOwn(messages, key) ? messages : fallback;
        if (!hasOwn(catalog, key)) return key;
        return catalog[key].replace(/\{(\w+)\}/g, (placeholder, name) =>
            hasOwn(params, name) ? String(params[name]) : placeholder
        );
    }

    function refreshLabels() {
        // Mark leaf nodes only, so updating a label preserves icons, controls and drafts.
        for (const element of document.querySelectorAll('[data-i18n]')) {
            element.textContent = translate(element.dataset.i18n);
        }
        for (const attribute of ['title', 'aria-label', 'placeholder', 'alt']) {
            const binding = 'data-i18n-' + attribute;
            for (const element of document.querySelectorAll('[' + binding + ']')) {
                element.setAttribute(attribute, translate(element.getAttribute(binding)));
            }
        }
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

    window.FPi18n = {getCurrentLanguage: () => currentLanguage, setLanguage, translate};

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
    });
})();
