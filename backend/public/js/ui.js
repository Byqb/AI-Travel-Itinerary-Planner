function displayItinerary(itinerary) {
    const itineraryContainer = document.getElementById('itinerary');
    itineraryContainer.innerHTML = '';
    const lang = document.documentElement.lang;
    const dayText = lang === 'ar' ? 'اليوم' : 'Day';

    itinerary.forEach(day => {
        const section = document.createElement('div');
        section.className = 'day-section';

        const title = document.createElement('h3');
        title.className = 'day-title';
        title.textContent = `${dayText} ${day.day}`;
        section.appendChild(title);

        day.activities.forEach(activity => {
            const div = document.createElement('div');
            div.className = 'activity';

            const atitle = document.createElement('h4');
            atitle.className = 'activity-title';
            atitle.textContent = activity.title;

            const desc = document.createElement('p');
            desc.className = 'activity-description';
            desc.textContent = activity.description;

            div.appendChild(atitle);
            div.appendChild(desc);
            section.appendChild(div);
        });

        itineraryContainer.appendChild(section);
    });
}
