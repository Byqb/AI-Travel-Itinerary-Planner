async function generateItinerary(event) {
    event.preventDefault();

    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const destination = document.getElementById('destination').value;
    const preferences = Array.from(document.querySelectorAll('input[name="preferences"]:checked'))
        .map(cb => cb.value);

    if (!startDate || !endDate || !destination) {
        const lang = document.documentElement.lang;
        alert(lang === 'ar' ? 'الرجاء ملء جميع الحقول المطلوبة' : 'Please fill in all required fields');
        return;
    }

    const loadingElement = document.querySelector('.loading');
    const itineraryContainer = document.getElementById('itinerary');
    loadingElement.classList.add('active');
    itineraryContainer.innerHTML = '';

    try {
        const res = await fetch('/api/generate-itinerary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate, destination, preferences, language: document.documentElement.lang })
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error?.message || 'Failed to generate itinerary');
        }

        const data = await res.json();
        displayItinerary(data.itinerary);
    } catch (err) {
        const lang = document.documentElement.lang;
        itineraryContainer.innerHTML = `<div class="error-message">❌ ${lang === 'ar' ? 'حدث خطأ:' : 'Error:'} ${err.message}</div>`;
    } finally {
        loadingElement.classList.remove('active');
    }
}
