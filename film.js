// film.js

// Конфигурация TMDB (такая же, как в script.js)
const TMDB_API_KEY = "c62338407764b89796db0ebc6d3af4ed";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const TMDB_CACHE_KEY = 'tmdb_cache';

// Вспомогательная функция для чтения из кеша
function getMovieDataFromCache(title, year) {
    const cache = JSON.parse(localStorage.getItem(TMDB_CACHE_KEY) || '{}');
    const cacheKey = `${title}_${year}`;
    const cached = cache[cacheKey];
    if (cached && (Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000)) {
        console.log(`✅ Из кеша (film.js): ${title}`);
        return cached.data;
    }
    return null;
}

document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('film-detail');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const filmId = urlParams.get('id');

    if (!filmId) {
        container.innerHTML = '<p style="color: red;">Ошибка: не указан ID фильма</p>';
        return;
    }

    fetch('films.json')
        .then(response => {
            if (!response.ok) throw new Error('Ошибка загрузки данных');
            return response.json();
        })
        .then(async films => {  // ← добавили async
            const film = films.find(f => f.id == filmId);
            if (!film) {
                container.innerHTML = '<p style="color: red;">Фильм не найден</p>';
                return;
            }

            // Сначала пытаемся получить из кеша
            let filmData = getMovieDataFromCache(film.title, film.year);

            // Если в кеше нет, делаем прямой запрос к TMDB
            if (!filmData) {
                container.innerHTML = '<p style="text-align: center;">Загрузка данных о фильме...</p>';
                filmData = await fetchMovieDataDirectly(film.title, film.year, film.original_title);
            }

            // Объединяем данные (приоритет: исходный JSON, затем TMDB, но жанры оставляем свои)
            const enrichedFilm = {
                ...film,
                poster: filmData?.poster || film.poster,
                genres: film.genres,  // всегда оставляем жанры из JSON
                rating: filmData?.rating || film.rating,
                description: filmData?.description || film.description || '',
                director: filmData?.director || film.director || '',
                duration: filmData?.duration || film.duration || '—',
            };

            renderFilmDetail(enrichedFilm, container);
            initRatingSystem(film.id);
        })
        .catch(error => {
            console.error('Ошибка:', error);
            container.innerHTML = '<p style="color: red;">Не удалось загрузить информацию о фильме</p>';
        });
});

// ---------- Новая функция для прямого запроса к TMDB (как в script.js) ----------
async function fetchMovieDataDirectly(title, year, originalTitle) {
    const PROXY = 'https://corsproxy.io/?';
    const searchQuery = originalTitle || title;

    try {
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchQuery)}&year=${year}&language=ru-RU`;
        const searchResp = await fetch(PROXY + encodeURIComponent(searchUrl));
        if (!searchResp.ok) throw new Error(`Ошибка поиска: ${searchResp.status}`);
        const searchData = await searchResp.json();

        if (!searchData.results || searchData.results.length === 0) {
            console.warn(`❌ Не найдено фильмов по запросу "${title}"`);
            return null;
        }

        const movie = searchData.results[0];

        // Получаем жанры (используем ту же функцию getGenres, её нужно будет вызвать)
        // Для этого нужно либо скопировать сюда getGenres, либо сделать её глобальной.
        // Пока упростим: оставим жанры пустыми, они нам не критичны для детальной страницы,
        // так как мы хотим сохранить исходные жанры из JSON.
        const genreNames = []; // Не будем загружать жанры, чтобы не усложнять

        const detailUrl = `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=ru-RU&append_to_response=credits`;
        const detailResp = await fetch(PROXY + encodeURIComponent(detailUrl));
        if (!detailResp.ok) throw new Error(`Ошибка получения деталей: ${detailResp.status}`);
        const detailData = await detailResp.json();

        let director = '';
        if (detailData.credits && detailData.credits.crew) {
            const directorObj = detailData.credits.crew.find(person => person.job === 'Director');
            director = directorObj ? directorObj.name : '';
        }

        const result = {
            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
            genres: genreNames, // Оставляем пустым, чтобы не затереть исходные
            rating: movie.vote_average ? movie.vote_average.toFixed(1) : '',
            description: movie.overview || '',
            year: movie.release_date ? movie.release_date.split('-')[0] : year,
            director: director,
            duration: detailData.runtime ? `${Math.floor(detailData.runtime / 60)} ч ${detailData.runtime % 60} мин` : '',
        };

        // Сохраняем в кеш
        const cacheKey = `${title}_${year}`;
        const cache = JSON.parse(localStorage.getItem(TMDB_CACHE_KEY) || '{}');
        cache[cacheKey] = { data: result, timestamp: Date.now() };
        localStorage.setItem(TMDB_CACHE_KEY, JSON.stringify(cache));

        console.log(`💾 Прямой запрос и сохранение в кеш: ${title}`);
        return result;
    } catch (error) {
        console.error(`🔥 Ошибка прямого запроса для "${title}":`, error);
        return null;
    }
}

function renderFilmDetail(film, container) {
    const genresHtml = film.genres.map(genre => {
        return `<span class="film-genre">${escapeHtml(genre)}</span>`;
    }).join('');

    const videoLink = film.videoUrl
        ? `<p><strong>Смотреть:</strong> <a href="${film.videoUrl}" target="_blank">${film.videoUrl}</a></p>`
        : '<p><em>Ссылка на видео пока не добавлена</em></p>';

    const descriptionHtml = film.description ? `<p><strong>Описание:</strong> ${escapeHtml(film.description)}</p>` : '';

    const posterHtml = film.poster
        ? `<img src="${film.poster}" alt="${escapeHtml(film.title)}" style="max-width: 300px; border-radius: 8px;">`
        : '<div class="poster-placeholder">Нет постера</div>';

    const durationText = film.duration ? film.duration : '—';
    const ratingText = film.rating && film.rating !== '' ? `⭐ ${film.rating}` : '';

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
                ${descriptionHtml}
            </div>
        </div>
        <div class="rating-section">
            <h3>Оцени фильм</h3>
            <div class="rating-scales">
                <div class="scale-item scale-base">
                    <div class="scale-header">
                        <span class="scale-name">Сценарий</span>
                        <span class="scale-value" id="scale1-value">5</span>
                    </div>
                    <input type="range" id="scale1" min="1" max="10" step="1" value="5">
                </div>
                <div class="scale-item scale-base">
                    <div class="scale-header">
                        <span class="scale-name">Режиссура</span>
                        <span class="scale-value" id="scale2-value">5</span>
                    </div>
                    <input type="range" id="scale2" min="1" max="10" step="1" value="5">
                </div>
                <div class="scale-item scale-base">
                    <div class="scale-header">
                        <span class="scale-name">Визуал + музыка</span>
                        <span class="scale-value" id="scale3-value">5</span>
                    </div>
                    <input type="range" id="scale3" min="1" max="10" step="1" value="5">
                </div>
                <div class="scale-item scale-base">
                    <div class="scale-header">
                        <span class="scale-name">Актёрский состав</span>
                        <span class="scale-value" id="scale4-value">5</span>
                    </div>
                    <input type="range" id="scale4" min="1" max="10" step="1" value="5">
                </div>
                <div class="scale-item scale-base">
                    <div class="scale-header">
                        <span class="scale-name">Хорош в рамках жанра + для своего времени?</span>
                        <span class="scale-value" id="scale5-value">5</span>
                    </div>
                    <input type="range" id="scale5" min="1" max="10" step="1" value="5">
                </div>
                <div class="scale-item scale-subj">
                    <div class="scale-header">
                        <span class="scale-name">Общее впечатление</span>
                        <span class="scale-value" id="subj-value">5</span>
                    </div>
                    <input type="range" id="subj" min="1" max="10" step="1" value="5">
                </div>
            </div>
            <div class="total-rating">
                <strong>Итоговая оценка:</strong> <span id="total-score" class="score-badge">0</span>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// ---------- Система оценок (с градиентной заливкой ползунков, левая часть цветная, правая серая) ----------
function initRatingSystem(filmId) {
    const scale1 = document.getElementById('scale1');
    const scale2 = document.getElementById('scale2');
    const scale3 = document.getElementById('scale3');
    const scale4 = document.getElementById('scale4');
    const scale5 = document.getElementById('scale5');
    const subj = document.getElementById('subj');

    const scale1value = document.getElementById('scale1-value');
    const scale2value = document.getElementById('scale2-value');
    const scale3value = document.getElementById('scale3-value');
    const scale4value = document.getElementById('scale4-value');
    const scale5value = document.getElementById('scale5-value');
    const subjvalue = document.getElementById('subj-value');
    const totalSpan = document.getElementById('total-score');

    if (!scale1 || !scale2 || !scale3 || !scale4 || !scale5 || !subj) return;

    // Функция обновления фона ползунка:
    // левая часть до текущего значения – градиент от startColor к endColor,
    // правая часть – серая (#e2e8f0)
    function updateRangeBackground(range, startColor, endColor) {
        const min = parseFloat(range.min);
        const max = parseFloat(range.max);
        const val = parseFloat(range.value);
        const percent = ((val - min) / (max - min)) * 100;
        // Формируем градиент: от startColor до endColor на ширину percent,
        // затем резкий переход на серый цвет до конца
        range.style.background = `linear-gradient(to right, ${startColor} 0%, ${endColor} ${percent}%, #e2e8f0 ${percent}%, #e2e8f0 100%)`;
    }

    // Цвета для итоговой оценки (без изменений)
    const colorPairs = [
        { max: 3, bg: '#ef4444', border: '#b91c1c' },
        { max: 5, bg: '#f87171', border: '#b91c1c' },
        { max: 7, bg: '#fde047', border: '#eab308' },
        { max: 8.5, bg: '#86efac', border: '#22c55e' },
        { max: 10, bg: '#22c55e', border: '#16a34a' },
        { max: Infinity, bg: '#8b5cf6', border: '#6b21a8' }
    ];

    function setScoreColor(score, element) {
        const pair = colorPairs.find(p => score < p.max) || colorPairs[colorPairs.length - 1];
        element.style.backgroundColor = pair.bg;
        element.style.borderColor = pair.border;
    }

    function updateTotal() {
        const s1 = parseFloat(scale1.value);
        const s2 = parseFloat(scale2.value);
        const s3 = parseFloat(scale3.value);
        const s4 = parseFloat(scale4.value);
        const s5 = parseFloat(scale5.value);
        const m = parseFloat(subj.value);

        scale1value.textContent = s1;
        scale2value.textContent = s2;
        scale3value.textContent = s3;
        scale4value.textContent = s4;
        scale5value.textContent = s5;
        subjvalue.textContent = m;

        // Обновляем фон ползунков
        updateRangeBackground(scale1, '#3498db', '#9b59b6');
        updateRangeBackground(scale2, '#3498db', '#9b59b6');
        updateRangeBackground(scale3, '#3498db', '#9b59b6');
        updateRangeBackground(scale4, '#3498db', '#9b59b6');
        updateRangeBackground(scale5, '#3498db', '#9b59b6');
        updateRangeBackground(subj, '#9b59b6', '#d8b4ff'); // для субъективной более светлый конец

        const avgBase = (s1 + s2 + s3 + s4 + s5) / 5;
        const diff = m - avgBase;

        let additionalWeight = 0;
        if (diff >= 0) {
            const part1 = diff * (-0.2 * Math.pow(diff, 2) + 50) / 100;
            const part2 = (0.5 * Math.pow(m, 2) + 50) / 100;
            additionalWeight = part1 * part2;
        } else {
            const part1 = diff * (-0.2 * Math.pow(diff, 2) + 50) / 100;
            const part2 = (-0.5 * Math.pow(m, 2) + 100) / 100;
            additionalWeight = part1 * part2;
        }

        const total = avgBase + additionalWeight;
        const roundedTotal = Math.round(total * 10) / 10;
        totalSpan.textContent = roundedTotal;

        setScoreColor(roundedTotal, totalSpan);

        const ratingData = { s1, s2, s3, s4, s5, m };
        localStorage.setItem(`filmRating_${filmId}`, JSON.stringify(ratingData));
    }

    // Загружаем сохранённые значения, если есть
    const saved = localStorage.getItem(`filmRating_${filmId}`);
    if (saved) {
        const data = JSON.parse(saved);
        scale1.value = data.s1;
        scale2.value = data.s2;
        scale3.value = data.s3;
        scale4.value = data.s4;
        scale5.value = data.s5;
        subj.value = data.m;
    }

    // Применяем фон после установки сохранённых значений
    updateRangeBackground(scale1, '#3498db', '#9b59b6');
    updateRangeBackground(scale2, '#3498db', '#9b59b6');
    updateRangeBackground(scale3, '#3498db', '#9b59b6');
    updateRangeBackground(scale4, '#3498db', '#9b59b6');
    updateRangeBackground(scale5, '#3498db', '#9b59b6');
    updateRangeBackground(subj, '#9b59b6', '#d8b4ff');

    scale1.addEventListener('input', updateTotal);
    scale2.addEventListener('input', updateTotal);
    scale3.addEventListener('input', updateTotal);
    scale4.addEventListener('input', updateTotal);
    scale5.addEventListener('input', updateTotal);
    subj.addEventListener('input', updateTotal);

    updateTotal(); // первый вызов для установки всех значений и фона
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
