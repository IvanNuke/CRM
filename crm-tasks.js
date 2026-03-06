// Extracted task/date helpers (pure task logic)


    const WORK_ITEM_PROGRESS_EVENT_TYPES = new Set([
        'TALKED',
        'INFO_RECEIVED',
        'CALC_DONE',
        'QUOTE_SENT',
        'INVOICE_SENT',
        'PROMISE_PAY_SET',
        'PAYMENT_PART',
        'PAYMENT_FULL',
        'DECISION_MADE'
    ]);

    const WORK_ITEM_EVENT_COOLING = {
        INFO_RECEIVED: 8,
        TALKED: 10,
        CALC_DONE: 10,
        QUOTE_SENT: 12,
        INVOICE_SENT: 18,
        PROMISE_PAY_SET: 15,
        PAYMENT_PART: 20
    };

    function clamp(value, min = 0, max = 100) {
        const num = Number(value);
        if (!Number.isFinite(num)) return min;
        return Math.min(max, Math.max(min, num));
    }

    function getWorkItemEventNowIso(now = new Date()) {
        const d = now instanceof Date ? now : new Date(now);
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }

    function buildTaskDueIso(record) {
        const date = String(record?.nextDate || record?.date || '').trim();
        if (!date) return '';
        const time = String(record?.nextTime || record?.time || '').trim() || '00:00';
        const dt = new Date(`${date}T${time}`);
        return isNaN(dt.getTime()) ? '' : dt.toISOString();
    }

    function syncWorkItemDueAt(record) {
        if (!record || typeof record !== 'object') return record;
        const dueIso = buildTaskDueIso(record);
        if (dueIso) record.due_at = dueIso;
        else if (!record.due_at) record.due_at = '';
        return record;
    }

    function ensureWorkItemEvents(record) {
        if (!record || typeof record !== 'object') return [];
        if (!Array.isArray(record.events)) record.events = [];
        record.events = record.events
            .filter(Boolean)
            .map((e, idx) => ({
                event_id: String(e.event_id || `evt_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`),
                type: String(e.type || '').trim() || 'UNKNOWN',
                at: String(e.at || ''),
                meta: e.meta && typeof e.meta === 'object' ? e.meta : {},
                comment: String(e.comment || '')
            }))
            .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
        return record.events;
    }

    function ensureWorkItemTempFields(record, now = new Date()) {
        if (!record || typeof record !== 'object') return record;
        const nowIso = getWorkItemEventNowIso(now);
        const createdFallback = [
            String(record.created_at || ''),
            String(record.createdAt || ''),
            String(record.completedAt || ''),
            buildTaskDueIso(record),
            (() => {
                const date = String(record.date || '').trim();
                if (!date) return '';
                const time = String(record.time || '').trim() || '00:00';
                const dt = new Date(`${date}T${time}`);
                return isNaN(dt.getTime()) ? '' : dt.toISOString();
            })()
        ].find(v => String(v || '').trim()) || nowIso;

        record.created_at = String(record.created_at || createdFallback);
        syncWorkItemDueAt(record);
        record.temp = clamp(record.temp ?? 0, 0, 100);
        record.postpone_count = Math.max(0, parseInt(record.postpone_count, 10) || 0);
        record.postpone_points_total = Math.max(0, parseInt(record.postpone_points_total, 10) || 0);
        record.postpone_streak = Math.max(0, parseInt(record.postpone_streak, 10) || 0);
        record.stagnation_points_total = Math.max(0, parseInt(record.stagnation_points_total, 10) || 0);
        record.temp_last_recalc_at = String(record.temp_last_recalc_at || record.last_progress_at || record.created_at || nowIso);
        record.last_event_at = String(record.last_event_at || record.modifiedAt || record.completedAt || record.created_at || nowIso);
        record.last_progress_at = String(record.last_progress_at || record.completedAt || record.created_at || nowIso);
        record.next_contact_at = String(record.next_contact_at || '');
        if (!String(record.status || '').trim()) {
            record.status = record.taskStatus === 'done' ? 'won' : 'active';
        }
        if (record.taskStatus === 'done' && ['active', 'work', 'new', ''].includes(String(record.status || '').trim())) {
            record.status = 'won';
            record.temp = 0;
        }
        ensureWorkItemEvents(record);
        return record;
    }

    function getWorkItemDueMomentFromIso(iso) {
        const raw = String(iso || '').trim();
        if (!raw) return null;
        const dt = new Date(raw);
        return isNaN(dt.getTime()) ? null : dt;
    }

    function getPostponeWeightByDeltaMs(deltaMs) {
        const ms = Number(deltaMs);
        if (!Number.isFinite(ms) || ms <= 0) return 0;
        const hour = 60 * 60 * 1000;
        const day = 24 * hour;
        if (ms <= 3 * hour) return 4;
        if (ms <= 1 * day) return 10;
        if (ms <= 3 * day) return 14;
        if (ms <= 7 * day) return 20;
        if (ms <= 8 * day) return 28;
        return 28;
    }

    function createWorkItemEvent(type, at, meta = {}, comment = '') {
        const whenIso = getWorkItemEventNowIso(at || new Date());
        return {
            event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: String(type || '').trim() || 'UNKNOWN',
            at: whenIso,
            meta: meta && typeof meta === 'object' ? meta : {},
            comment: String(comment || '')
        };
    }

    function getLastWorkItemEvent(record, predicate) {
        const events = ensureWorkItemEvents(record);
        for (let i = events.length - 1; i >= 0; i--) {
            if (predicate(events[i])) return events[i];
        }
        return null;
    }

    function applyEvent(workItem, eventInput) {
        const item = ensureWorkItemTempFields(workItem);
        const event = createWorkItemEvent(eventInput?.type, eventInput?.at, eventInput?.meta, eventInput?.comment);
        const eventType = String(event.type || '').trim();
        const eventTs = new Date(event.at).getTime();
        const isProgress = WORK_ITEM_PROGRESS_EVENT_TYPES.has(eventType);

        if (isProgress && !['PAYMENT_FULL', 'DECISION_MADE'].includes(eventType)) {
            const prevSame = getLastWorkItemEvent(item, e => String(e.type) === eventType);
            if (prevSame) {
                const prevTs = new Date(prevSame.at).getTime();
                if (Number.isFinite(prevTs) && Number.isFinite(eventTs) && (eventTs - prevTs) < 24 * 60 * 60 * 1000) {
                    item.last_event_at = event.at;
                    return { workItem: item, applied: false, reason: 'cooldown' };
                }
            }
        }

        item.events.push(event);
        item.last_event_at = event.at;

        if (eventType === 'PAYMENT_FULL' || eventType === 'DECISION_MADE') {
            item.last_progress_at = event.at;
            item.postpone_streak = 0;
            item.temp = 0;
            if (eventType === 'PAYMENT_FULL') item.status = 'won';
            if (eventType === 'DECISION_MADE' && String(event.meta?.status || '').trim()) {
                item.status = String(event.meta.status).trim();
            }
            return { workItem: item, applied: true, event };
        }

        if (isProgress) {
            const cool = Math.max(0, parseInt(WORK_ITEM_EVENT_COOLING[eventType], 10) || 0);
            item.last_progress_at = event.at;
            item.postpone_streak = 0;
            item.temp = clamp(item.temp - cool, 0, 100);
            return { workItem: item, applied: true, event };
        }

        return { workItem: item, applied: true, event };
    }

    function applyProgress(workItem, progressEventType, comment = '', now = new Date()) {
        return applyEvent(workItem, { type: progressEventType, at: now, comment });
    }

    function applyPostpone(workItem, newDueAt, reason = '', now = new Date()) {
        const item = ensureWorkItemTempFields(workItem, now);
        const nowIso = getWorkItemEventNowIso(now);
        const oldDueIso = String(item.due_at || buildTaskDueIso(item) || '');
        const oldDueMoment = getWorkItemDueMomentFromIso(oldDueIso);
        const nextMoment = getWorkItemDueMomentFromIso(newDueAt);
        if (!nextMoment) return { workItem: item, applied: false, reason: 'invalid_due' };

        const eventMoment = new Date(nowIso);
        const deltaMs = oldDueMoment ? (nextMoment.getTime() - oldDueMoment.getTime()) : 0;
        let weight = getPostponeWeightByDeltaMs(deltaMs);
        let bonusSameDay = 0;
        let bonusOverdue = 0;
        let bonusStreak = 0;

        if (oldDueMoment) {
            const sameDay = toIsoLocal(eventMoment) === toIsoLocal(oldDueMoment);
            if (sameDay) bonusSameDay = 6;
            if (eventMoment.getTime() > oldDueMoment.getTime()) bonusOverdue = 12;
        }

        const nextStreak = Math.max(0, parseInt(item.postpone_streak, 10) || 0) + 1;
        if (nextStreak === 3) bonusStreak = 15;
        const total = weight + bonusSameDay + bonusOverdue + bonusStreak;

        item.postpone_count += 1;
        item.postpone_points_total += total;
        item.postpone_streak = nextStreak;
        item.temp = clamp(item.temp + total, 0, 100);
        item.due_at = nextMoment.toISOString();
        if (item.nextDate !== undefined) item.nextDate = toIsoLocal(nextMoment);
        if (item.nextTime !== undefined) item.nextTime = `${String(nextMoment.getHours()).padStart(2, '0')}:${String(nextMoment.getMinutes()).padStart(2, '0')}`;
        if (item.date !== undefined && item.taskStatus !== 'done') item.date = item.nextDate;
        if (item.time !== undefined && item.taskStatus !== 'done') item.time = item.nextTime || '00:00';

        item.events.push(createWorkItemEvent('POSTPONE', nowIso, {
            old_due_at: oldDueIso || '',
            new_due_at: item.due_at,
            weight: total,
            weight_base: weight,
            bonus_same_day: bonusSameDay,
            bonus_overdue: bonusOverdue,
            bonus_streak3: bonusStreak,
            reason: String(reason || '')
        }, reason));
        item.last_event_at = nowIso;
        ensureWorkItemEvents(item);
        return { workItem: item, applied: true, weight: total };
    }

    function getWorkItemProgressBaseIso(workItem) {
        return String(workItem?.last_progress_at || workItem?.created_at || '').trim();
    }

    function recalcStagnation(workItem, now = new Date()) {
        const item = ensureWorkItemTempFields(workItem, now);
        if (['won', 'lost', 'frozen_closed', 'dnc'].includes(String(item.status || '').trim())) {
            item.temp = 0;
            item.temp_last_recalc_at = getWorkItemEventNowIso(now);
            return { workItem: item, appliedDays: 0, added: 0 };
        }
        const dayMs = 24 * 60 * 60 * 1000;
        const nowDate = now instanceof Date ? now : new Date(now);
        const nowFloor = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
        const baseTs = new Date(getWorkItemProgressBaseIso(item)).getTime();
        let lastRecalcTs = new Date(String(item.temp_last_recalc_at || '')).getTime();
        if (!Number.isFinite(lastRecalcTs)) lastRecalcTs = baseTs;
        const safeBaseTs = Number.isFinite(baseTs) ? baseTs : nowFloor.getTime();
        const startTs = Math.max(safeBaseTs, Number.isFinite(lastRecalcTs) ? lastRecalcTs : safeBaseTs);
        const startDate = new Date(startTs);
        const startFloor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const daysToApply = Math.max(0, Math.floor((nowFloor.getTime() - startFloor.getTime()) / dayMs));
        if (!daysToApply) {
            if (!item.temp_last_recalc_at) item.temp_last_recalc_at = getWorkItemEventNowIso(now);
            return { workItem: item, appliedDays: 0, added: 0 };
        }

        let added = 0;
        for (let i = 0; i < daysToApply; i++) {
            const current = clamp(item.temp, 0, 100);
            const perDay = current < 40 ? 2 : (current <= 70 ? 3 : 4);
            item.temp = clamp(current + perDay, 0, 100);
            added += perDay;
        }
        item.stagnation_points_total += added;
        item.temp_last_recalc_at = getWorkItemEventNowIso(now);
        return { workItem: item, appliedDays: daysToApply, added };
    }

    function getTempColor(temp) {
        const t = clamp(temp, 0, 100);
        if (t <= 20) return '#1f9d55';
        if (t <= 45) return '#c59b08';
        if (t <= 70) return '#ef7d1a';
        return '#d92d20';
    }

    function getTempGradientColor(temp) {
        const t = clamp(temp, 0, 100);
        if (t <= 50) {
            const ratio = t / 50;
            const r = Math.round(46 + (245 - 46) * ratio);
            const g = Math.round(184 + (190 - 184) * ratio);
            const b = Math.round(92 + (31 - 92) * ratio);
            return `rgb(${r}, ${g}, ${b})`;
        }
        const ratio = (t - 50) / 50;
        const r = Math.round(245 + (217 - 245) * ratio);
        const g = Math.round(190 + (45 - 190) * ratio);
        const b = Math.round(31 + (32 - 31) * ratio);
        return `rgb(${r}, ${g}, ${b})`;
    }

    function getWorkItemDaysSinceProgress(workItem, now = new Date()) {
        const ts = new Date(getWorkItemProgressBaseIso(workItem)).getTime();
        if (!Number.isFinite(ts)) return 0;
        return Math.max(0, Math.floor((((now instanceof Date ? now : new Date(now)).getTime()) - ts) / (24 * 60 * 60 * 1000)));
    }

    function getWorkItemOverdueDays(workItem, now = new Date()) {
        if (!workItem || String(workItem.taskStatus || '') === 'done') return 0;
        const due = getTaskDueMoment(workItem);
        if (!due) return 0;
        return Math.max(0, Math.floor((((now instanceof Date ? now : new Date(now)).getTime()) - due.getTime()) / (24 * 60 * 60 * 1000)));
    }

    function getTempReason(workItem, now = new Date()) {
        const item = ensureWorkItemTempFields(workItem, now);
        const days = getWorkItemDaysSinceProgress(item, now);
        const overdueDays = getWorkItemOverdueDays(item, now);
        const parts = [];
        if ((item.postpone_count || 0) > 0) parts.push(`${item.postpone_count} переносов`);
        if ((item.postpone_streak || 0) >= 3) parts.push(`подряд ${item.postpone_streak}`);
        if (days > 0) parts.push(`${days} дн. без прогресса`);
        if (overdueDays > 0) parts.push(`просрочка ${overdueDays} дн.`);
        if (!parts.length) return item.temp > 0 ? 'Накоплено по событиям' : 'Свежая задача';
        return parts.slice(0, 2).join(', ');
    }

    function runTempDebugTests() {
        const now = new Date('2026-02-26T12:00:00');
        const makeItem = () => ensureWorkItemTempFields({
            id: 'test',
            taskStatus: 'work',
            nextDate: '2026-02-26',
            nextTime: '12:00',
            date: '2026-02-26',
            time: '12:00',
            temp: 0,
            created_at: '2026-02-20T09:00:00.000Z',
            last_progress_at: '2026-02-20T09:00:00.000Z',
            events: []
        }, now);
        const a = makeItem();
        applyPostpone(a, '2026-02-27T12:00:00.000Z', 'test', now);
        applyPostpone(a, '2026-03-01T12:00:00.000Z', 'test2', now);
        applyPostpone(a, '2026-03-03T12:00:00.000Z', 'test3', now);
        const b = makeItem();
        applyProgress(b, 'QUOTE_SENT', 'quote', now);
        const tempAfter1 = b.temp;
        const cooldownTry = applyProgress(b, 'QUOTE_SENT', 'quote again', new Date('2026-02-26T13:00:00'));
        const c = makeItem();
        recalcStagnation(c, new Date('2026-02-28T12:00:00'));
        const once = c.temp;
        recalcStagnation(c, new Date('2026-02-28T15:00:00'));
        console.log('[TEMP TEST]', { postpone_streak: a.postpone_streak, postpone_count: a.postpone_count, cooldownBlocked: cooldownTry.applied === false, tempAfter1, tempAfter2: b.temp, stagnationOnce: once, stagnationNoDouble: c.temp });
        return { a, b, c };
    }

    function getTaskWorkflowStatusMeta(task) {
        if (!task || task.taskStatus === 'done') return { icon: '✅', label: 'Выполнена' };
        if (task.taskStatus === 'work') return { icon: '🛠️', label: 'В работе' };
        return { icon: '🆕', label: 'Новая' };
    }

    function getExecutionDate(record) {
        if (record.taskStatus === 'done' && record.completedDate) {
            return record.completedDate;
        }
        if (record.taskStatus === 'done' && record.completedAt) {
            return String(record.completedAt).split('T')[0];
        }
        return record.nextDate || record.date || '';
    }

    function getExecutionTime(record) {
        if (record.taskStatus === 'done' && record.completedTime) {
            return record.completedTime;
        }
        if (record.taskStatus === 'done' && record.completedAt) {
            const t = String(record.completedAt).split('T')[1] || '';
            return t ? t.slice(0, 5) : '';
        }
        return record.nextTime || record.time || '';
    }

    function getTaskTimeState(record, now = new Date()) {
        const dateStr = record.nextDate || '';
        if (!dateStr) return 'nodate';
        const todayStr = now.toISOString().split('T')[0];

        if (dateStr < todayStr) return 'overdue';
        if (dateStr > todayStr) return 'future';

        const timeStr = (record.nextTime || '').trim();
        if (!timeStr) return 'today';

        const taskMoment = new Date(`${dateStr}T${timeStr}`);
        if (isNaN(taskMoment.getTime())) return 'today';
        return taskMoment < now ? 'overdue' : 'today';
    }

    function getTaskDueMoment(record) {
        const dateStr = String(record.nextDate || '').trim();
        if (!dateStr) return null;
        const timeStr = String(record.nextTime || '').trim() || '00:00';
        const dt = new Date(`${dateStr}T${timeStr}`);
        return isNaN(dt.getTime()) ? null : dt;
    }

    function getTaskDueDateTime(task) {
        const date = task.nextDate || getTodayIsoLocal();
        const time = task.nextTime || getNowTimeLocalHHMM();
        const dt = new Date(`${date}T${time || '00:00'}`);
        return isNaN(dt.getTime()) ? new Date() : dt;
    }

    function setTaskDueDateTime(task, dt) {
        task.nextDate = toIsoLocal(dt);
        task.nextTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        task.date = task.nextDate;
        task.time = task.nextTime || '00:00';
    }

    function getCompletionByTaskMoment(dateStr, timeStr, now = new Date()) {
        const normalizedDate = String(dateStr || '').trim();
        const normalizedTime = String(timeStr || '').trim() || '00:00';
        const plannedMoment = normalizedDate ? new Date(`${normalizedDate}T${normalizedTime}`) : null;
        const useNow = !plannedMoment || isNaN(plannedMoment.getTime()) || plannedMoment > now;
        const finalDate = useNow ? getTodayIsoLocal() : normalizedDate;
        const finalTime = useNow ? getNowTimeLocalHHMM() : normalizedTime;
        const finalMoment = new Date(`${finalDate}T${finalTime}`);
        const finalIso = isNaN(finalMoment.getTime()) ? new Date().toISOString() : finalMoment.toISOString();
        return { finalDate, finalTime, finalIso };
    }

    function parseTaskDateTimeToTs(dateStr, timeStr = '00:00') {
        if (!dateStr) return 0;
        const ts = new Date(`${dateStr}T${timeStr || '00:00'}`).getTime();
        return toSafeActivityTs(ts);
    }

    function getTaskDaysDiff(task) {
        const due = getTaskDueMoment(task);
        if (!due) return 0;
        const dayMs = 24 * 60 * 60 * 1000;
        return Math.floor((due.getTime() - Date.now()) / dayMs);
    }


    function isActiveTask(h) {
        return h.nextStep && h.nextStep.trim() !== "" && (h.taskStatus === 'new' || h.taskStatus === 'work');
    }

    function getTaskMoment(task) {
        const datePart = task.nextDate || task.date || '';
        const timePart = task.nextTime || task.time || '00:00';
        if (!datePart) return null;
        const moment = new Date(`${datePart}T${timePart}`);
        return isNaN(moment.getTime()) ? null : moment;
    }

