function generateDealId() {
    return `deal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getDealFollowupTemplateDays() {
    return [2, 7, 21, 60];
}

function normalizeDealCategory(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (['roof', 'facade', 'board', 'other'].includes(raw)) return raw;
    return 'other';
}

function normalizeDealStage(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (['new', 'calc_sent', 'negotiation', 'shipment', 'waiting', 'closed'].includes(raw)) return raw;
    return 'new';
}

function normalizeDealStatus(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (['active', 'won', 'lost'].includes(raw)) return raw;
    return 'active';
}

function toIsoOrEmpty(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const dt = new Date(raw);
    return isNaN(dt.getTime()) ? '' : dt.toISOString();
}

function getDateOnlyFromIso(value) {
    const iso = toIsoOrEmpty(value);
    if (!iso) return '';
    return iso.split('T')[0];
}

function addDaysToIso(baseIso, days) {
    const base = toIsoOrEmpty(baseIso) || new Date().toISOString();
    const dt = new Date(base);
    dt.setDate(dt.getDate() + Math.max(0, parseInt(days, 10) || 0));
    return dt.toISOString();
}

function calcDealOverdueDays(deal, now = new Date()) {
    const next = toIsoOrEmpty(deal?.next_touch_at);
    if (!next || normalizeDealStatus(deal?.status) !== 'active') return 0;
    const nowDt = now instanceof Date ? now : new Date(now);
    const diffMs = nowDt.getTime() - new Date(next).getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function calcDealHeat(deal, now = new Date()) {
    const snooze = Math.max(0, parseInt(deal?.snooze_count, 10) || 0);
    const overdueLive = calcDealOverdueDays(deal, now);
    const overdueTotal = Math.max(0, parseInt(deal?.overdue_days, 10) || 0) + overdueLive;

    if (overdueTotal > 0 && overdueLive > 0) return 'red';
    if (snooze >= 4) return 'red';
    if (snooze >= 2) return 'yellow';
    return 'green';
}

function ensureDealRecord(rawDeal) {
    const src = rawDeal && typeof rawDeal === 'object' ? rawDeal : {};
    const nowIso = new Date().toISOString();
    const status = normalizeDealStatus(src.status);
    const stage = status === 'active' ? normalizeDealStage(src.stage) : 'closed';
    const record = {
        id: String(src.id || generateDealId()),
        client_id: String(src.client_id || ''),
        title: String(src.title || '').trim() || 'Сделка без названия',
        amount: Math.max(0, Number(src.amount) || 0),
        category: normalizeDealCategory(src.category),
        stage: stage,
        status: status,
        created_at: toIsoOrEmpty(src.created_at) || nowIso,
        last_touch_at: toIsoOrEmpty(src.last_touch_at),
        next_touch_at: toIsoOrEmpty(src.next_touch_at),
        notes: String(src.notes || ''),
        snooze_count: Math.max(0, parseInt(src.snooze_count, 10) || 0),
        overdue_days: Math.max(0, parseInt(src.overdue_days, 10) || 0),
        heat: 'green',
        followup_step: Math.max(0, Math.min(4, parseInt(src.followup_step, 10) || 0)),
        source_task_id: String(src.source_task_id || '')
    };
    record.heat = calcDealHeat(record);
    return record;
}

function buildDealFromTask(task, client, options = {}) {
    const stage = normalizeDealStage(options.stage || 'calc_sent');
    const status = normalizeDealStatus(options.status || 'active');
    const nowIso = new Date().toISOString();
    const nextTouch = stage === 'calc_sent' ? addDaysToIso(nowIso, 2) : addDaysToIso(nowIso, 7);
    const fallbackTitle = String(task?.nextStep || task?.desc || '').trim();
    const record = ensureDealRecord({
        id: generateDealId(),
        client_id: String(client?.id || task?.clientId || ''),
        title: String(options.title || fallbackTitle || `Сделка: ${client?.name || 'без клиента'}`),
        category: normalizeDealCategory(options.category),
        stage,
        status,
        created_at: nowIso,
        last_touch_at: '',
        next_touch_at: nextTouch,
        notes: String(options.notes || ''),
        snooze_count: 0,
        overdue_days: 0,
        followup_step: 1,
        source_task_id: String(task?.id || '')
    });
    return record;
}

function getDealStageLabel(stage) {
    const key = normalizeDealStage(stage);
    if (key === 'calc_sent') return 'Расчёт отправлен';
    if (key === 'negotiation') return 'Торг';
    if (key === 'shipment') return 'Отгрузка';
    if (key === 'waiting') return 'Ожидание';
    if (key === 'closed') return 'Закрыто';
    return 'Новый';
}

function getDealHeatLabel(heat) {
    const key = String(heat || '').trim().toLowerCase();
    if (key === 'red') return '🔴 red';
    if (key === 'yellow') return '🟡 yellow';
    return '🟢 green';
}

function getDealNextTouchDateLabel(iso) {
    const datePart = getDateOnlyFromIso(iso);
    if (!datePart) return '-';
    return formatDateRu(datePart);
}

function generateTouchId() {
    return `touch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTouchType(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (['call', 'whatsapp', 'telegram', 'email', 'other'].includes(raw)) return raw;
    return 'other';
}

function normalizeTouchResult(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (['reached', 'no_answer', 'rescheduled', 'price_discussion', 'waiting', 'won', 'lost', 'other'].includes(raw)) return raw;
    return 'other';
}

function ensureTouchRecord(rawTouch) {
    const src = rawTouch && typeof rawTouch === 'object' ? rawTouch : {};
    return {
        id: String(src.id || generateTouchId()),
        deal_id: String(src.deal_id || ''),
        touch_type: normalizeTouchType(src.touch_type),
        result: normalizeTouchResult(src.result),
        comment: String(src.comment || ''),
        created_at: toIsoOrEmpty(src.created_at) || new Date().toISOString(),
        next_touch_at: toIsoOrEmpty(src.next_touch_at),
        snooze_applied_days: Math.max(0, parseInt(src.snooze_applied_days, 10) || 0)
    };
}

function getOverdueDaysBetween(nextTouchIso, actionIso) {
    const next = toIsoOrEmpty(nextTouchIso);
    const actionAt = toIsoOrEmpty(actionIso);
    if (!next || !actionAt) return 0;
    const diffMs = new Date(actionAt).getTime() - new Date(next).getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function getFollowupNextTouchIso(baseIso, followupStep) {
    const days = getDealFollowupTemplateDays();
    const step = Math.max(1, Math.min(days.length, parseInt(followupStep, 10) || 1));
    return addDaysToIso(baseIso || new Date().toISOString(), days[step - 1]);
}

function applyTouchToDeal(rawDeal, touchInput = {}) {
    const deal = ensureDealRecord(rawDeal);
    const touchAt = toIsoOrEmpty(touchInput.created_at) || new Date().toISOString();
    const manualNext = toIsoOrEmpty(touchInput.next_touch_at);
    const touchType = normalizeTouchType(touchInput.touch_type);
    const touchResult = normalizeTouchResult(touchInput.result);
    const nextStep = Math.max(1, Math.min(4, parseInt(deal.followup_step, 10) || 1));
    const overdueAdd = getOverdueDaysBetween(deal.next_touch_at, touchAt);

    let nextTouchAt = '';
    let stage = deal.stage;
    let status = deal.status;
    let followupStep = nextStep;

    if (touchResult === 'won') {
        status = 'won';
        stage = 'closed';
    } else if (touchResult === 'lost') {
        status = 'lost';
        stage = 'closed';
    } else if (status === 'active') {
        if (manualNext) {
            nextTouchAt = manualNext;
        } else {
            const autoStep = Math.min(4, nextStep + 1);
            followupStep = autoStep;
            nextTouchAt = getFollowupNextTouchIso(touchAt, autoStep);
        }
    }

    const updatedDeal = ensureDealRecord({
        ...deal,
        status,
        stage,
        last_touch_at: touchAt,
        next_touch_at: status === 'active' ? nextTouchAt : '',
        overdue_days: Math.max(0, parseInt(deal.overdue_days, 10) || 0) + overdueAdd,
        followup_step: status === 'active' ? followupStep : deal.followup_step
    });

    const touch = ensureTouchRecord({
        deal_id: deal.id,
        touch_type: touchType,
        result: touchResult,
        comment: String(touchInput.comment || ''),
        created_at: touchAt,
        next_touch_at: updatedDeal.next_touch_at,
        snooze_applied_days: overdueAdd
    });

    return { deal: updatedDeal, touch };
}

function applyDealSnooze(rawDeal, newNextTouchIso, actionIso = '') {
    const deal = ensureDealRecord(rawDeal);
    if (deal.status !== 'active') return { deal, changed: false };
    const nextTouchAt = toIsoOrEmpty(newNextTouchIso);
    if (!nextTouchAt) return { deal, changed: false };

    const actionAt = toIsoOrEmpty(actionIso) || new Date().toISOString();
    const overdueAdd = getOverdueDaysBetween(deal.next_touch_at, actionAt);
    const shouldIncSnooze = String(deal.next_touch_at || '').trim() && (new Date(nextTouchAt).getTime() > new Date(deal.next_touch_at).getTime());

    const updatedDeal = ensureDealRecord({
        ...deal,
        next_touch_at: nextTouchAt,
        overdue_days: Math.max(0, parseInt(deal.overdue_days, 10) || 0) + overdueAdd,
        snooze_count: Math.max(0, parseInt(deal.snooze_count, 10) || 0) + (shouldIncSnooze ? 1 : 0)
    });
    return { deal: updatedDeal, changed: true, overdueAdd };
}
