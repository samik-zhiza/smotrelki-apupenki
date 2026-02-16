// film.js

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
        .then(films => {
            const film = films.find(f => f.id == filmId);
            if (!film) {
                container.innerHTML = '<p style="color: red;">Фильм не найден</p>';
                return;
            }

            renderFilmDetail(film, container);
            initRatingSystem(film.id); // Инициализация системы оценок
        })
        .catch(error => {
            console.error('Ошибка:', error);
            container.innerHTML = '<p style="color: red;">Не удалось загрузить информацию о фильме</p>';
        });
});

function renderFilmDetail(film, container) {
    const genresHtml = film.genres.map(genre => {
        const genreClass = slugify(genre);
        return `<span class="film-genre genre-${genreClass}">${escapeHtml(genre)}</span>`;
    }).join('');

    const videoLink = film.videoUrl 
        ? `<p><strong>Смотреть:</strong> <a href="${film.videoUrl}" target="_blank">${film.videoUrl}</a></p>`
        : '<p><em>Ссылка на видео пока не добавлена</em></p>';

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
            </div>
        </div>
        <div class="rating-section">
            <h3>Оцени фильм</h3>

            
            <div class="rating-scales">
                <!-- Базовые шкалы с синей рамкой -->
                <div class="scale-item scale-base">
                    <div class="scale-header">
                        <span class="scale-name">Сценарий:</span>
                        <span class="scale-value" id="scale1-value">5</span>
                    </div>
                    <input type="range" id="scale1" min="0" max="10" step="1" value="5">
                </div>
                <div class="scale-item scale-base">
                    <div class="scale-header">
                        <span class="scale-name">Режиссура:</span>
                        <span class="scale-value" id="scale2-value">5</span>
                    </div>
                    <input type="range" id="scale2" min="0" max="10" step="1" value="5">
                </div>
                <div class="scale-item scale-base">
                    <div class="scale-header">
                        <span class="scale-name">Визуал + музыка:</span>
                        <span class="scale-value" id="scale3-value">5</span>
                    </div>
                    <input type="range" id="scale3" min="0" max="10" step="1" value="5">
                </div>
                <div class="scale-item scale-base">
                    <div class="scale-header">
                        <span class="scale-name">Каст:</span>
                        <span class="scale-value" id="scale4-value">5</span>
                    </div>
                    <input type="range" id="scale4" min="0" max="10" step="1" value="5">
                </div>
                <div class="scale-item scale-base">
                    <div class="scale-header">
                        <span class="scale-name">Хорош в рамках жанра + для своего времени?</span>
                        <span class="scale-value" id="scale5-value">5</span>
                    </div>
                    <input type="range" id="scale5" min="0" max="10" step="1" value="5">
                </div>
                <!-- Субъективная шкала с розовато-лиловой рамкой -->
                <div class="scale-item scale-subj">
                    <div class="scale-header">
                        <span class="scale-name">Общее впечатление:</span>
                        <span class="scale-value" id="subj-value">5</span>
                    </div>
                    <input type="range" id="subj" min="0" max="10" step="1" value="5">
                </div>
            </div>
           
            <div class="total-rating">
                <strong>Итоговая оценка: <span id="total-score">0</span></strong>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// ---------- Система оценок по формуле из Google Sheets ----------
function initRatingSystem(filmId) {
    // Элементы ползунков
    const scale1 = document.getElementById('scale1');
    const scale2 = document.getElementById('scale2');
    const scale3 = document.getElementById('scale3');
    const scale4 = document.getElementById('scale4');
    const scale5 = document.getElementById('scale5');
    const subj = document.getElementById('subj');

    // Элементы отображения значений
    const scale1value = document.getElementById('scale1-value');
    const scale2value = document.getElementById('scale2-value');
    const scale3value = document.getElementById('scale3-value');
    const scale4value = document.getElementById('scale4-value');
    const scale5value = document.getElementById('scale5-value');
    const subjvalue = document.getElementById('subj-value');
    const totalSpan = document.getElementById('total-score');

    if (!scale1 || !scale2 || !scale3 || !scale4 || !scale5 || !subj) return;

    // Функция пересчёта итога
    function updateTotal() {
        // Получаем значения (числа)
        const s1 = parseFloat(scale1.value);
        const s2 = parseFloat(scale2.value);
        const s3 = parseFloat(scale3.value);
        const s4 = parseFloat(scale4.value);
        const s5 = parseFloat(scale5.value);
        const m = parseFloat(subj.value); // субъективный параметр

        // Обновляем отображение чисел рядом с ползунками
        scale1value.textContent = s1;
        scale2value.textContent = s2;
        scale3value.textContent = s3;
        scale4value.textContent = s4;
        scale5value.textContent = s5;
        subjvalue.textContent = m;

        // Вычисляем среднее базовых шкал (H3:L3)
        const avgBase = (s1 + s2 + s3 + s4 + s5) / 5;

        // Разность между субъективной и средней базой (M3 - СРЗНАЧ(H3:L3))
        const diff = m - avgBase;

        // Вычисляем дополнительный вес по формуле
        let additionalWeight = 0;
        if (diff >= 0) {
            // Часть для положительной разницы
            const part1 = diff * (-0.2 * Math.pow(diff, 2) + 50) / 100;   // делим на 100, т.к. в формуле проценты
            const part2 = (0.5 * Math.pow(m, 2) + 50) / 100;
            additionalWeight = part1 * part2;
        } else {
            // Часть для отрицательной разницы
            const part1 = diff * (-0.2 * Math.pow(diff, 2) + 50) / 100;
            const part2 = (-0.5 * Math.pow(m, 2) + 100) / 100;
            additionalWeight = part1 * part2;
        }

        // Итоговая оценка = среднее базовых + дополнительный вес, округлённая до 1 знака
        const total = avgBase + additionalWeight;
        const roundedTotal = Math.round(total * 10) / 10; // округление до десятых

        totalSpan.textContent = roundedTotal;

        // Сохраняем значения в localStorage
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

    // Вешаем обработчики
    scale1.addEventListener('input', updateTotal);
    scale2.addEventListener('input', updateTotal);
    scale3.addEventListener('input', updateTotal);
    scale4.addEventListener('input', updateTotal);
    scale5.addEventListener('input', updateTotal);
    subj.addEventListener('input', updateTotal);

    // Первый вызов для установки начальных значений
    updateTotal();
}

// ---------- Утилиты ----------
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