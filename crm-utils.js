function formatDateRu(dateStr) {
    const raw = String(dateStr || '').trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split('-');
        return `${d}.${m}.${y}`;
    }
    return raw;
}

function formatDateTimeRu(dateStr, timeStr) {
    const datePart = formatDateRu(dateStr);
    if (!datePart) return 'Без даты';
    return `${datePart}${timeStr ? ` ${timeStr}` : ''}`;
}

function getTodayIsoLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getNowTimeLocalHHMM() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

function toIsoLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseIsoLocal(iso) {
    const parts = String(iso || '').split('-').map(v => parseInt(v, 10));
    if (parts.length !== 3 || parts.some(v => Number.isNaN(v))) return new Date();
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function pad2(num) {
    return String(num).padStart(2, '0');
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toSafeActivityTs(value) {
    const ts = Number(value);
    if (!Number.isFinite(ts) || ts <= 0) return 0;
    const min = new Date('2000-01-01T00:00:00').getTime();
    const max = Date.now() + 24 * 60 * 60 * 1000;
    return ts >= min && ts <= max ? ts : 0;
}
