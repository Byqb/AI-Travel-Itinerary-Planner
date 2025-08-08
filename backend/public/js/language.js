function setLanguage(lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('language', lang);
    document.querySelector('.lang-text').textContent = lang === 'ar' ? 'English' : 'العربية';

    document.querySelectorAll('[data-ar]').forEach(el => {
        el.textContent = el.getAttribute(`data-${lang}`);
    });
    document.querySelectorAll('[data-ar-placeholder]').forEach(el => {
        el.placeholder = el.getAttribute(`data-${lang}-placeholder`);
    });
}

function toggleLanguage() {
    const currentLang = document.documentElement.lang;
    setLanguage(currentLang === 'ar' ? 'en' : 'ar');
}

const savedLang = localStorage.getItem('language') || 'ar';
setLanguage(savedLang);
