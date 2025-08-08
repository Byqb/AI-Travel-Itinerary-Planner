function generatePrompt(startDate, endDate, destination, preferences, language) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const isArabic = language === 'ar';

    return `${isArabic ? 'إنشاء' : 'Create'} a detailed ${days}-day travel itinerary for ${destination}. 
${isArabic ? 'تبدأ الرحلة في' : 'The trip starts on'} ${startDate} ${isArabic ? 'وتنتهي في' : 'and ends on'} ${endDate}.
${isArabic ? 'الاهتمامات:' : 'Travel preferences:'} ${preferences.join(', ')}.

${isArabic ? 'يرجى تقديم خطة يومية تتضمن:' : 'Please provide a day-by-day itinerary with:'}
1. ${isArabic ? '3-4 نشاطات في اليوم' : '3-4 activities per day'}
2. ${isArabic ? 'وصف مختصر لكل نشاط' : 'Brief descriptions for each activity'}
3. ${isArabic ? 'مراعاة الاهتمامات المذكورة' : 'Consider the preferences mentioned'}
4. ${isArabic ? 'جعلها واقعية وعملية' : 'Make it realistic and practical'}

${isArabic ? 'قم بتنسيق الرد كمصفوفة JSON من الأيام، حيث يحتوي كل يوم على:' : 'Format the response as a JSON array of days, where each day has:'}
- day: number
- activities: array of {title: string, description: string}

${isArabic ? 'مثال على التنسيق:' : 'Example format:'}
[
    {
        "day": 1,
        "activities": [
            {
                "title": "${isArabic ? 'نشاط الصباح' : 'Morning Activity'}",
                "description": "${isArabic ? 'الوصف هنا' : 'Description here'}"
            }
        ]
    }
]`;
}

module.exports = generatePrompt;