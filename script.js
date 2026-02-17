// script.js

let allFilms = [];
let filteredFilms = [];
let container;
let currentSortType = 'year';
let activeGenres = [];
let showOnlyFavorites = false;

// TMDB API конфигурация
const TMDB_API_KEY = "c62338407764b89796db0ebc6d3af4ed"; // замени на свой ключ
const TMDB_API_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

// Кеш для данных TMDB
const TMDB_CACHE_KEY = 'tmdb_cache';
const TMDB_GENRES_CACHE_KEY = 'tmdb_genres';

// Кеш для избранного
const FAVORITES_STORAGE_KEY = 'filmFavorites';

// Получаем список жанров (кешируем на неделю)
async function getGenres() {
    const cached = localStorage.getItem(TMDB_GENRES_CACHE_KEY);
    if (cached) {
        const { genres, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
            return genres;
        }
    }
    try {
        const resp = await fetch(`${TMDB_API_URL}/genre/movie/list?api_key=${TMDB_API_KEY}&language=ru-RU`);
        if (!resp.ok) throw new Error('Ошибка загрузки жанров');
        const data = await resp.json();
        const genresMap = {};
        data.genres.forEach(g => genresMap[g.id] = g.name);
        localStorage.setItem(TMDB_GENRES_CACHE_KEY, JSON.stringify({ genres: genresMap, timestamp: Date.now() }));
        return genresMap;
    } catch (error) {
        console.error('Ошибка получения жанров:', error);
        return {};
    }
}

// Функция для получения данных фильма из TMDB
async function getMovieDataFromTMDB(film) {
    const title = film.title;
    const year = film.year;
    const originalTitle = film.original_title || title;

    const cache = JSON.parse(localStorage.getItem(TMDB_CACHE_KEY) || '{}');
    const cacheKey = `${title}_${year}`;

    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < 7 * 24 * 60 * 60 * 1000)) {
        console.log(`✅ Из кеша: ${title}`);
        return cache[cacheKey].data;
    }

    try {
        console.log(`🔍 Ищем: ${title} (${year})`);
        const searchUrl = `${TMDB_API_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(originalTitle)}&year=${year}&language=ru-RU`;
        const searchResp = await fetch(searchUrl);
        if (!searchResp.ok) throw new Error(`Ошибка поиска: ${searchResp.status}`);
        const searchData = await searchResp.json();

        if (!searchData.results || searchData.results.length === 0) {
            console.warn(`❌ Не найдено фильмов по запросу "${title}"`);
            return null;
        }

        const movie = searchData.results[0];

        const genresMap = await getGenres();
        const genreNames = movie.genre_ids.map(id => genresMap[id] || '').filter(g => g);

        const detailResp = await fetch(`${TMDB_API_URL}/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=ru-RU&append_to_response=credits`);
        if (!detailResp.ok) throw new Error(`Ошибка получения деталей: ${detailResp.status}`);
        const detailData = await detailResp.json();

        let director = '';
        if (detailData.credits && detailData.credits.crew) {
            const directorObj = detailData.credits.crew.find(person => person.job === 'Director');
            director = directorObj ? directorObj.name : '';
        }

        const result = {
            poster: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : '',
            genres: genreNames,
            rating: movie.vote_average ? movie.vote_average.toFixed(1) : '',
            description: movie.overview || '',
            year: movie.release_date ? movie.release_date.split('-')[0] : year,
            director: director,
            duration: detailData.runtime ? `${Math.floor(detailData.runtime / 60)} ч ${detailData.runtime % 60} мин` : '',
        };

        cache[cacheKey] = { data: result, timestamp: Date.now() };
        localStorage.setItem(TMDB_CACHE_KEY, JSON.stringify(cache));
        console.log(`💾 Сохранено в кеш: ${title}`);
        return result;
    } catch (error) {
        console.error(`🔥 Ошибка для "${title}":`, error);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    container = document.getElementById('films-container');
    if (!container) {
        console.error('Ошибка: не найден элемент с id="films-container"');
        return;
    }

    fetch('films.json')
        .then(response => {
            if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);
            return response.json();
        })
        .then(async films => {
            allFilms = films;
            allFilms.forEach((film, index) => {
                if (film.id === undefined) film.id = index;
            });

            container.innerHTML = '<p style="text-align: center;">Загрузка данных с TMDB...</p>';

            const enrichedPromises = allFilms.map(async film => {
                const tmdbData = await getMovieDataFromTMDB(film);
                if (tmdbData) {
                    return {
                        ...film,
                        poster: tmdbData.poster || film.poster,
                        genres: tmdbData.genres.length ? tmdbData.genres : film.genres,
                        rating: tmdbData.rating || film.rating,
                        description: tmdbData.description || film.description || '',
                        director: film.director || tmdbData.director || '',
                        duration: tmdbData.duration || film.duration || '—',
                    };
                } else {
                    return film;
                }
            });

            const enrichedFilms = await Promise.all(enrichedPromises);
            allFilms = enrichedFilms;
            filteredFilms = [...allFilms];

            populateGenreList();
            applySortAndFilter();
        })
        .catch(error => {
            console.error('Не удалось загрузить фильмы:', error);
            container.innerHTML = '<p style="color: red; text-align: center;">Не удалось загрузить список фильмов. Попробуйте позже.</p>';
        });

    // Сортировка
    const sortButtons = document.querySelectorAll('.filter-btn[data-sort]');
    sortButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentSortType = e.target.dataset.sort;
            applySortAndFilter();
        });
    });

    // Фильтр по жанрам
    const genreFilterBtn = document.querySelector('.genre-filter-btn');
    const genreDropdown = document.querySelector('.genre-dropdown');
    if (genreFilterBtn && genreDropdown) {
        genreFilterBtn.addEventListener('click', () => {
            genreDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!genreFilterBtn.contains(e.target) && !genreDropdown.contains(e.target)) {
                genreDropdown.classList.add('hidden');
            }
        });
    }

    const genreSearch = document.querySelector('.genre-search');
    if (genreSearch) {
        genreSearch.addEventListener('input', (e) => {
            filterGenreList(e.target.value);
        });
    }

    const genreClear = document.querySelector('.genre-clear');
    if (genreClear) {
        genreClear.addEventListener('click', () => {
            clearGenreFilter();
        });
    }

    const favoritesBtn = document.getElementById('favorites-filter');
    if (favoritesBtn) {
        favoritesBtn.addEventListener('click', () => {
            showOnlyFavorites = !showOnlyFavorites;
            favoritesBtn.classList.toggle('active', showOnlyFavorites);
            applySortAndFilter();
        });
    }
});

// ---------- Избранное ----------
function getFavorites() {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveFavorites(favorites) {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
}

function toggleFavorite(filmId) {
    let favorites = getFavorites();
    if (favorites.includes(filmId)) {
        favorites = favorites.filter(id => id !== filmId);
    } else {
        favorites.push(filmId);
    }
    saveFavorites(favorites);
    applySortAndFilter();
}

// ---------- Фильтрация и сортировка ----------
function applySortAndFilter() {
    if (activeGenres.length > 0) {
        filteredFilms = allFilms.filter(film =>
            film.genres.some(genre => activeGenres.includes(genre))
        );
    } else {
        filteredFilms = [...allFilms];
    }

    if (showOnlyFavorites) {
        const favorites = getFavorites();
        filteredFilms = filteredFilms.filter(film => favorites.includes(film.id));
    }

    sortFilteredFilms();
    renderFilmCards(filteredFilms);
}

function sortFilteredFilms() {
    if (currentSortType === 'year') {
        filteredFilms.sort((a, b) => a.year - b.year);
    } else if (currentSortType === 'title') {
        filteredFilms.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    } else if (currentSortType === 'genre') {
        filteredFilms.sort((a, b) => {
            const genreA = a.genres[0] || '';
            const genreB = b.genres[0] || '';
            return genreA.localeCompare(genreB, 'ru');
        });
    }
}

// ---------- Жанры ----------
function populateGenreList() {
    const genreListContainer = document.querySelector('.genre-list');
    if (!genreListContainer) return;

    const allGenres = new Set();
    allFilms.forEach(film => {
        film.genres.forEach(genre => allGenres.add(genre));
    });
    const sortedGenres = Array.from(allGenres).sort((a, b) => a.localeCompare(b, 'ru'));

    genreListContainer.innerHTML = '';
    sortedGenres.forEach(genre => {
        const genreItem = document.createElement('div');
        genreItem.className = 'genre-item';
        genreItem.dataset.genre = genre;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = genre;
        checkbox.id = `genre-${slugify(genre)}`;
        checkbox.addEventListener('change', () => updateActiveGenres());

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = genre;

        genreItem.appendChild(checkbox);
        genreItem.appendChild(label);
        genreListContainer.appendChild(genreItem);
    });
}

function filterGenreList(query) {
    const items = document.querySelectorAll('.genre-item');
    const lowerQuery = query.toLowerCase();
    items.forEach(item => {
        const genre = item.dataset.genre.toLowerCase();
        item.style.display = genre.includes(lowerQuery) ? 'flex' : 'none';
    });
}

function updateActiveGenres() {
    activeGenres = [];
    document.querySelectorAll('.genre-item input:checked').forEach(cb => {
        activeGenres.push(cb.value);
    });
    applySortAndFilter();
}

function clearGenreFilter() {
    document.querySelectorAll('.genre-item input').forEach(cb => cb.checked = false);
    activeGenres = [];
    applySortAndFilter();
}

// ---------- Рендер карточек ----------
function renderFilmCards(films) {
    container.innerHTML = '';
    const favorites = getFavorites();

    films.forEach(film => {
        const cardHtml = createFilmCard(film, favorites.includes(film.id));
        container.insertAdjacentHTML('beforeend', cardHtml);
    });

    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const filmId = Number(btn.dataset.filmId);
            toggleFavorite(filmId);
        });
    });
}

function createFilmCard(film, isFavorite) {
    const genresHtml = film.genres.map(genre => {
        return `<span class="film-genre">${escapeHtml(genre)}</span>`;
    }).join('');

    const durationText = film.duration ? film.duration : '—';
    const ratingText = film.rating ? `⭐ ${film.rating}` : '⭐';
    const safeTitle = escapeHtml(film.title);
    const safeDirector = escapeHtml(film.director);
    const year = film.year;
    const heartIcon = isFavorite ? 'fas fa-heart' : 'far fa-heart';

    return `
    <a href="film.html?id=${film.id}" class="film-card-link" style="text-decoration: none; color: inherit;">
        <div class="film-card">
            <div class="film-poster">
                ${film.poster ? `<img src="${film.poster}" alt="${safeTitle}">` : '<div class="poster-placeholder">Нет постера</div>'}
            </div>
            <div class="film-info">
                <div class="film-header">
                    <h3 class="film-title">${safeTitle}</h3>
                    <span class="film-year film-genre">${year}</span>
                </div>
                <div class="film-director">${safeDirector}</div>
                <div class="film-genres">${genresHtml}</div>
                <div class="film-actions">
                    <div class="film-meta-left">
                        <span class="film-duration film-rating"><i class="far fa-clock"></i> ${durationText}</span>
                        <span class="film-rating">${ratingText}</span>
                    </div>
                    <button class="favorite-btn" data-film-id="${film.id}" aria-label="Добавить в избранное">
                        <i class="${heartIcon}"></i>
                    </button>
                </div>
            </div>
        </div>
    </a>
    `;
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
    // Оставляем как есть, но теперь не используется для цветов жанров
    // Можно оставить для совместимости, но цвета убрали
    return text.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '-');
}
