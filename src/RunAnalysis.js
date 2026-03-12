const STOP_WORDS = new Set([
    'a', 'an', 'the', 'i', 'you', 'to', 'of', 'is', 'it', 'and', 'in', 'na', 'nie', 'to', 'sie', 'się',
    'ze', 'że', 'ja', 'ty', 'on', 'ona', 'my', 'wy', 'oni', 'co', 'jak', 'tak', 'ale', 'no', 'xd'
]);

const WEEKDAY_ORDER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const activeCharts = {};

let info = createEmptyInfo();

function createEmptyInfo() {
    return {
        totalMessages: 0,
        textMessages: 0,
        totalWords: 0,
        totalChars: 0,
        unsentMessages: 0,
        totalReactions: 0,
        totalAttachments: 0,
        callDuration: 0,
        senderMessageCounts: {},
        callStartsBySender: {},
        wordCounts: {},
        emojiCounts: {},
        weekdayCounts: { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 },
        hourCounts: {},
        dayCounts: {},
        mediaCounts: {
            photos: 0,
            videos: 0,
            audio: 0,
            gifs: 0,
            files: 0,
            stickers: 0,
            shares: 0,
        },
    };
}

function updateFileCount(input) {
    const n = input.files.length;
    document.getElementById('fileCount').textContent =
        n === 0 ? 'No files selected' : `${n} file${n !== 1 ? 's' : ''} selected`;
}

function runAnalysis() {
    const fileInput = document.getElementById('fileInput');
    const files = Array.from(fileInput.files || []);

    if (files.length === 0) {
        alert('Please select at least one JSON file.');
        return;
    }

    info = createEmptyInfo();

    document.getElementById('loadingIndicator').classList.remove('hidden');
    document.getElementById('resultsSection').classList.add('hidden');

    Promise.all(files.map(readFile))
        .then(() => {
            renderResults();
            document.getElementById('loadingIndicator').classList.add('hidden');
            document.getElementById('resultsSection').classList.remove('hidden');
        })
        .catch(error => {
            document.getElementById('loadingIndicator').classList.add('hidden');
            console.error('Error processing files:', error);
            alert('Error processing one or more files. Check the browser console for details.');
        });
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const jsonData = JSON.parse(event.target.result);
                const messages = jsonData.messages || [];
                for (const message of messages) {
                    processMessage(message);
                }
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsText(file, 'UTF-8');
    });
}

function processMessage(message) {
    info.totalMessages += 1;

    const senderRaw = message.sender_name || 'Unknown';
    const sender = normalizeMojibake(senderRaw);
    info.senderMessageCounts[sender] = (info.senderMessageCounts[sender] || 0) + 1;

    if (message.is_unsent) {
        info.unsentMessages += 1;
    }

    if (Array.isArray(message.reactions)) {
        info.totalReactions += message.reactions.length;
    }

    if ('call_duration' in message) {
        const duration = Number(message.call_duration) || 0;
        info.callDuration += duration;
        info.callStartsBySender[sender] = (info.callStartsBySender[sender] || 0) + 1;
    }

    collectMediaStats(message);

    if (message.timestamp_ms) {
        const date = new Date(Number(message.timestamp_ms));
        if (!Number.isNaN(date.getTime())) {
            const weekday = WEEKDAY_ORDER[date.getDay()];
            info.weekdayCounts[weekday] += 1;
            const hour = date.getHours();
            info.hourCounts[hour] = (info.hourCounts[hour] || 0) + 1;
            const dayKey = date.toDateString();
            info.dayCounts[dayKey] = (info.dayCounts[dayKey] || 0) + 1;
        }
    }

    if (!message.content) {
        return;
    }

    const content = normalizeMojibake(String(message.content));
    const words = tokenize(content);

    info.textMessages += 1;
    info.totalWords += words.length;
    info.totalChars += content.length;

    for (const word of words) {
        if (word.length < 2) continue;
        if (STOP_WORDS.has(word)) continue;
        if (/^\d+$/.test(word)) continue;
        info.wordCounts[word] = (info.wordCounts[word] || 0) + 1;
    }

    const emojis = extractEmojis(content);
    for (const emoji of emojis) {
        info.emojiCounts[emoji] = (info.emojiCounts[emoji] || 0) + 1;
    }
}

function collectMediaStats(message) {
    const photos = Array.isArray(message.photos) ? message.photos.length : 0;
    const videos = Array.isArray(message.videos) ? message.videos.length : 0;
    const audio = Array.isArray(message.audio_files) ? message.audio_files.length : 0;
    const gifs = Array.isArray(message.gifs) ? message.gifs.length : 0;
    const files = Array.isArray(message.files) ? message.files.length : 0;
    const shares = message.share ? 1 : 0;
    const stickers = message.sticker ? 1 : 0;

    info.mediaCounts.photos += photos;
    info.mediaCounts.videos += videos;
    info.mediaCounts.audio += audio;
    info.mediaCounts.gifs += gifs;
    info.mediaCounts.files += files;
    info.mediaCounts.shares += shares;
    info.mediaCounts.stickers += stickers;

    info.totalAttachments += photos + videos + audio + gifs + files + shares + stickers;
}

function renderResults() {
    const topSender = getTopEntry(info.senderMessageCounts);
    const topDay = getTopEntry(info.dayCounts);
    const topEmojis = Object.entries(info.emojiCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([emoji]) => emoji)
        .join(' ');

    const avgWords = info.textMessages === 0 ? 0 : info.totalWords / info.textMessages;

    document.getElementById('callDuration').textContent = formatDuration(info.callDuration);
    document.getElementById('mostActiveDay').textContent = topDay ? `${topDay.key} - ${topDay.value} msgs` : '-';
    document.getElementById('mostUsedEmojis').textContent = topEmojis || '-';
    document.getElementById('totalMessages').textContent = formatNumber(info.totalMessages);
    document.getElementById('topSender').textContent = topSender ? `${topSender.key} (${topSender.value})` : '-';
    document.getElementById('avgWordsPerMessage').textContent = avgWords.toFixed(2);
    document.getElementById('totalAttachments').textContent = formatNumber(info.totalAttachments);
    document.getElementById('totalReactions').textContent = formatNumber(info.totalReactions);

    renderWordsChart();
    renderCallsChart();
    renderEmojisChart();
    renderMessagesBySenderChart();
    renderMediaChart();
    renderWeekdayChart();
    renderHourlyChart();
}

function getTopEntry(map) {
    const entries = Object.entries(map || {});
    if (entries.length === 0) return null;
    const [key, value] = entries.sort(([, a], [, b]) => b - a)[0];
    return { key, value };
}

function formatNumber(n) {
    return new Intl.NumberFormat().format(n);
}

function formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

function normalizeMojibake(text) {
    if (!text) return '';

    const suspicious = /[ÃÅÄÂð]/.test(text);
    if (!suspicious) return text;

    try {
        const bytes = Uint8Array.from(Array.from(text, ch => ch.charCodeAt(0) & 0xff));
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return decoded || text;
    } catch {
        return text;
    }
}

function tokenize(content) {
    return content
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()\[\]"'“”‘’<>|\\]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

function extractEmojis(content) {
    // Prefer Extended_Pictographic when available.
    try {
        const matches = content.match(/\p{Extended_Pictographic}/gu);
        if (matches && matches.length) return matches;
    } catch {
        // Ignore and use fallback.
    }
    return content.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) || [];
}

function chartDefaults() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
    };
}

function destroyChart(id) {
    if (activeCharts[id]) {
        activeCharts[id].destroy();
        delete activeCharts[id];
    }
}

function createChart(id, config) {
    destroyChart(id);
    activeCharts[id] = new Chart(document.getElementById(id), config);
}

function renderWordsChart() {
    const sorted = Object.entries(info.wordCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 12);

    createChart('wordsChart', {
        type: 'bar',
        data: {
            labels: sorted.map(([word]) => word),
            datasets: [{
                data: sorted.map(([, value]) => value),
                backgroundColor: 'rgba(190, 196, 206, 0.72)',
                borderColor: '#c6cbd3',
                borderWidth: 1,
                borderRadius: 4,
            }],
        },
        options: {
            ...chartDefaults(),
            indexAxis: 'y',
            scales: {
                x: { ticks: { color: '#a0a7b2' }, grid: { color: 'rgba(255,255,255,0.08)' } },
                y: { ticks: { color: '#e6e8ec' }, grid: { display: false } },
            },
        },
    });
}

function renderCallsChart() {
    const entries = Object.entries(info.callStartsBySender).sort(([, a], [, b]) => b - a);
    const palette = ['#e8eaed', '#c4c9d1', '#9ea5b0', '#79828f', '#575f6a', '#3f4650'];

    createChart('callsChart', {
        type: 'doughnut',
        data: {
            labels: entries.map(([name]) => name),
            datasets: [{
                data: entries.map(([, count]) => count),
                backgroundColor: entries.map((_, i) => palette[i % palette.length]),
                borderColor: '#171a1f',
                borderWidth: 2,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { color: '#e6e8ec', padding: 14, font: { size: 12 } },
                },
            },
        },
    });
}

function renderEmojisChart() {
    const sorted = Object.entries(info.emojiCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    createChart('emojisChart', {
        type: 'bar',
        data: {
            labels: sorted.map(([emoji]) => emoji),
            datasets: [{
                data: sorted.map(([, value]) => value),
                backgroundColor: 'rgba(137, 145, 157, 0.75)',
                borderColor: '#98a0ad',
                borderWidth: 1,
                borderRadius: 4,
            }],
        },
        options: {
            ...chartDefaults(),
            scales: {
                x: { ticks: { color: '#e6e8ec', font: { size: 16 } }, grid: { display: false } },
                y: { ticks: { color: '#a0a7b2' }, grid: { color: 'rgba(255,255,255,0.08)' } },
            },
        },
    });
}

function renderMessagesBySenderChart() {
    const sorted = Object.entries(info.senderMessageCounts)
        .sort(([, a], [, b]) => b - a);

    createChart('messagesBySenderChart', {
        type: 'bar',
        data: {
            labels: sorted.map(([name]) => name),
            datasets: [{
                data: sorted.map(([, count]) => count),
                backgroundColor: 'rgba(174, 181, 191, 0.72)',
                borderColor: '#c6cbd3',
                borderWidth: 1,
                borderRadius: 4,
            }],
        },
        options: {
            ...chartDefaults(),
            scales: {
                x: { ticks: { color: '#a0a7b2' }, grid: { display: false } },
                y: { ticks: { color: '#a0a7b2' }, grid: { color: 'rgba(255,255,255,0.08)' } },
            },
        },
    });
}

function renderMediaChart() {
    const labels = ['Photos', 'Videos', 'Audio', 'GIFs', 'Files', 'Stickers', 'Shares'];
    const values = [
        info.mediaCounts.photos,
        info.mediaCounts.videos,
        info.mediaCounts.audio,
        info.mediaCounts.gifs,
        info.mediaCounts.files,
        info.mediaCounts.stickers,
        info.mediaCounts.shares,
    ];

    createChart('mediaChart', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: 'rgba(200, 206, 215, 0.72)',
                borderColor: '#cfd4dc',
                borderWidth: 1,
                borderRadius: 4,
            }],
        },
        options: {
            ...chartDefaults(),
            scales: {
                x: { ticks: { color: '#a0a7b2' }, grid: { display: false } },
                y: { ticks: { color: '#a0a7b2' }, grid: { color: 'rgba(255,255,255,0.08)' } },
            },
        },
    });
}

function renderWeekdayChart() {
    const values = WEEKDAY_ORDER.map(day => info.weekdayCounts[day] || 0);

    createChart('weekdayChart', {
        type: 'line',
        data: {
            labels: WEEKDAY_ORDER,
            datasets: [{
                data: values,
                borderColor: '#d8dde5',
                backgroundColor: 'rgba(216, 221, 229, 0.15)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
            }],
        },
        options: {
            ...chartDefaults(),
            scales: {
                x: { ticks: { color: '#a0a7b2' }, grid: { display: false } },
                y: { ticks: { color: '#a0a7b2' }, grid: { color: 'rgba(255,255,255,0.08)' } },
            },
        },
    });
}

function renderHourlyChart() {
    const labels = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
    const values = labels.map((_, h) => info.hourCounts[h] || 0);

    createChart('hourlyChart', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: 'rgba(174, 181, 191, 0.72)',
                borderColor: '#c6cbd3',
                borderWidth: 1,
            }],
        },
        options: {
            ...chartDefaults(),
            scales: {
                x: { ticks: { color: '#a0a7b2', maxRotation: 90, minRotation: 90, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } },
                y: { ticks: { color: '#a0a7b2' }, grid: { color: 'rgba(255,255,255,0.08)' } },
            },
        },
    });
}
