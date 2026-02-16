// film.js

document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('film-detail');
    if (!container) return;

    // Получаем id из URL (например, film.html?id=5)
    const urlParams = new URLSearchParams(window.location.search);
    const filmId = urlParams.get('id');

    if (!filmId) {
        container.innerHTML = '<p style="color: red;">Ошибка: не указан ID фильма</p>';
        return;
    }

    // Загружаем films.json
    fetch('films.json')
        .then(response => {
            if (!response.ok) throw new Error('Ошибка загрузки данных');
            return response.json();
        })
        .then(films => {
            // Ищем фильм по id (сравниваем как числа, т.к. filmId из URL — строка)
            const film = films.find(f => f.id == filmId);
            if (!film) {
                container.innerHTML = '<p style="color: red;">Фильм не найден</p>';
                return;
            }

            // Отображаем информацию о фильме
            renderFilmDetail(film, container);
        })
        .catch(error => {
            console.error('Ошибка:', error);
            container.innerHTML = '<p style="color: red;">Не удалось загрузить информацию о фильме</p>';
        });
});

function renderFilmDetail(film, container) {
    // Генерируем HTML для жанров
    const genresHtml = film.genres.map(genre => {
        const genreClass = slugify(genre);
        return `<span class="film-genre genre-${genreClass}">${escapeHtml(genre)}</span>`;
    }).join('');

    // Ссылка на видео
    const videoLink = film.videoUrl 
        ? `<p><strong>Смотреть:</strong> <a href="${film.videoUrl}" target="_blank">${film.videoUrl}</a></p>`
        : '<p><em>Ссылка на видео пока не добавлена</em></p>';

    // Постер (если есть)
    const posterHtml = film.poster
        ? `<img src="${film.poster}" alt="${escapeHtml(film.title)}" style="max-width: 300px; border-radius: 8px;">`
        : '<div class="poster-placeholder">Нет постера</div>';

    const durationText = film.duration ? film.duration : '—';
    const ratingText = film.rating && film.rating !== '' ? `⭐ ${film.rating}` : '';

    // Формируем разметку
    const html = `
        <div class="film-detail-card">
            <div class="film-detail-poster">
                ${posterHtml}
            </div>
            <div class="film-detail-info">
                <h2>${escapeHtml(film.title)} (${film.year})</h2>
                <p><strong>Режиссёр:</strong> ${escapeHtml(film.director)}</p>
                <p><strong>Жанры:</strong></p>
                <div class="film-genres">${genresHtml}</div>
                <p><strong>Длительность:</strong> ${durationText}</p>
                ${ratingText ? `<p><strong>Рейтинг:</strong> ${ratingText}</p>` : ''}
                ${videoLink}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Вспомогательные функции (копируем из script.js)
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function slugify(text) {
    if (!text) return '';
    const translitMap = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
        'Ж': 'ZH', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
        'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
        'Ф': 'F', 'Х': 'KH', 'Ц': 'TS', 'Ч': 'CH', 'Ш': 'SH', 'Щ': 'SHCH',
        'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'YU', 'Я': 'YA',
        ' ': '-', ',': '', '.': '', '(': '', ')': '', '!': '', '?': '', ':': '', ';': '', '"': '', "'": ''
    };
    let result = '';
    for (let char of text) {
        result += translitMap[char] !== undefined ? translitMap[char] : char;
    }
    result = result.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    return result.toLowerCase();
}