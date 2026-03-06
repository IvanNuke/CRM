function formatPhoneValue(raw) {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    const p1 = digits.slice(0, 1);
    const p2 = digits.slice(1, 4);
    const p3 = digits.slice(4, 7);
    const p4 = digits.slice(7, 9);
    const p5 = digits.slice(9, 11);
    return [p1, p2, p3, p4, p5].filter(Boolean).join('-');
}

function normalizeContactPhoneLabels(rawLabels) {
    const toList = Array.isArray(rawLabels) ? rawLabels : String(rawLabels || '').split(/[,+;/]/g);
    const normalized = toList
        .map(v => String(v || '').trim().toLowerCase())
        .map(v => {
            if (v === 'max' || v === 'мфч' || v === 'mфч') return 'MAX';
            if (v === 'telegram') return 'Telegram';
            return v ? 'сотовый' : '';
        })
        .filter(Boolean);
    const uniq = [...new Set(normalized)];
    return uniq.length ? uniq : ['сотовый'];
}

function normalizeContactPhoneValue(labels, rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    const normalizedLabels = normalizeContactPhoneLabels(labels);
    if (normalizedLabels.includes('Telegram') && !normalizedLabels.includes('сотовый') && !normalizedLabels.includes('MAX')) return raw;
    return formatPhoneValue(raw);
}

function formatPhoneLabels(labels) {
    return normalizeContactPhoneLabels(labels).join(', ');
}

function togglePhoneLabel(labels, targetLabel, checked) {
    const normalizedTarget = normalizeContactPhoneLabels([targetLabel])[0];
    let current = normalizeContactPhoneLabels(labels);
    if (checked) {
        if (!current.includes(normalizedTarget)) current.push(normalizedTarget);
    } else {
        current = current.filter(v => v !== normalizedTarget);
        if (!current.length) current = ['сотовый'];
    }
    return [...new Set(current)];
}

function normalizeContactPhones(phonesRaw, fallbackPhone = '', keepEmpty = false) {
    const source = Array.isArray(phonesRaw) ? phonesRaw : [];
    const normalized = source
        .map(item => {
            const rawLabel = typeof item === 'string'
                ? 'сотовый'
                : (item.labels || item.label || item.type || 'сотовый');
            const rawValue = typeof item === 'string' ? item : (item.value || item.phone || '');
            const labels = normalizeContactPhoneLabels(rawLabel);
            return {
                labels,
                value: normalizeContactPhoneValue(labels, rawValue)
            };
        })
        .filter(item => keepEmpty || item.value);

    if (!normalized.length && String(fallbackPhone || '').trim()) {
        normalized.push({
            labels: ['сотовый'],
            value: normalizeContactPhoneValue(['сотовый'], fallbackPhone)
        });
    }
    return normalized;
}

function ensureContactId(contact, index = 0) {
    if (contact && contact.id !== undefined && contact.id !== null && String(contact.id).trim()) {
        return String(contact.id);
    }
    return `contact_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeContact(contactRaw, index = 0, keepEmptyPhones = false) {
    const contact = contactRaw || {};
    const phones = normalizeContactPhones(contact.phones, contact.phone || '', keepEmptyPhones);
    return {
        id: ensureContactId(contact, index),
        role: String(contact.role || '').trim(),
        name: String(contact.name || '').trim(),
        isPrimaryForClient: Boolean(contact.isPrimaryForClient),
        phones,
        phone: phones.length ? phones[0].value : ''
    };
}

function getContactPreferredPhone(contact) {
    const phones = normalizeContactPhones(contact?.phones, contact?.phone || '');
    if (!phones.length) return '';
    const byPriority = [...phones].sort((a, b) => {
        const rank = labels => (labels.includes('сотовый') ? 0 : (labels.includes('MAX') ? 1 : 2));
        return rank(a.labels || []) - rank(b.labels || []);
    });
    return byPriority[0].value || '';
}

function getMainClientPhoneFromContacts(contacts) {
    const normalizedContacts = (Array.isArray(contacts) ? contacts : []).map((c, idx) => normalizeContact(c, idx));
    if (!normalizedContacts.length) return '';
    if (normalizedContacts.length === 1) return getContactPreferredPhone(normalizedContacts[0]);
    const selected = normalizedContacts.find(c => c.isPrimaryForClient) || normalizedContacts.find(c => getContactPreferredPhone(c)) || normalizedContacts[0];
    return getContactPreferredPhone(selected);
}

function normalizeClientType(rawType) {
    if (Array.isArray(rawType) && rawType.length) {
        return String(rawType[0] || '').trim();
    }
    if (typeof rawType === 'string' && rawType.trim()) {
        return rawType.includes(',') ? rawType.split(',')[0].trim() : rawType.trim();
    }
    return '';
}

function formatClientTypes(rawType) {
    return normalizeClientType(rawType);
}

function normalizeRelatedClientIds(rawIds) {
    if (!rawIds) return [];
    const arr = Array.isArray(rawIds) ? rawIds : [rawIds];
    return [...new Set(arr.map(v => String(v || '').trim()).filter(Boolean))];
}

function normalizeClientClass(rawClass) {
    const value = String(rawClass || '').trim();
    const upper = value.toUpperCase();
    if (['A', 'B', 'C'].includes(upper)) return upper;
    return 'Не указан';
}

function getClientClassIcon(rawClass) {
    const value = normalizeClientClass(rawClass);
    if (value === 'A') return '👑';
    if (value === 'B') return '🌿';
    if (value === 'C') return '❄️';
    return '';
}

function getClientClassSortRank(rawClass) {
    const value = normalizeClientClass(rawClass);
    if (value === 'A') return 0;
    if (value === 'B') return 1;
    if (value === 'C') return 2;
    return 3;
}
