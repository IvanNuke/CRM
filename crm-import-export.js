// Extracted I/O module: import/export/report/file-save functions

    const DB_FILE_HANDLE_DB = 'crm-file-binding-db-v1';
    const DB_FILE_HANDLE_STORE = 'bindings';
    const DB_FILE_HANDLE_KEY = 'main-db-json-handle';
    let autoSaveWarnedNoPermission = false;

    function getDatabaseSnapshot() {
        return {
            version: 2,
            exportedAt: new Date().toISOString(),
            settings: {
                inactiveFilter: { count: inactiveFilterCount, unit: inactiveFilterUnit },
                clientTypeOptions: clientTypeOptions,
                clientTaskTouchedAt: clientTaskTouchedAt,
                clientLastContactAt: clientLastContactAt,
                callSessionLog: callSessionLog
            },
            clients,
            history,
            deals,
            touches
        };
    }

    function markDatabaseSavedAtNow() {
        dbDirty = false;
        dbLastFileSaveAt = Date.now();
        try { CRMStore.set('dbLastJsonSaveAt', String(dbLastFileSaveAt)); } catch (e) {}
        autoSaveWarnedNoPermission = false;
    }

    function isFileBindingSupported() {
        return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function' && typeof window.indexedDB !== 'undefined';
    }

    function openBindingDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_FILE_HANDLE_DB, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(DB_FILE_HANDLE_STORE)) {
                    db.createObjectStore(DB_FILE_HANDLE_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error('indexedDB open failed'));
        });
    }

    async function persistBoundFileHandle(handle) {
        if (!isFileBindingSupported() || !handle) return;
        const db = await openBindingDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(DB_FILE_HANDLE_STORE, 'readwrite');
            tx.objectStore(DB_FILE_HANDLE_STORE).put(handle, DB_FILE_HANDLE_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('indexedDB write failed'));
            tx.onabort = () => reject(tx.error || new Error('indexedDB write aborted'));
        });
        db.close();
    }

    async function readPersistedBoundFileHandle() {
        if (!isFileBindingSupported()) return null;
        const db = await openBindingDb();
        const result = await new Promise((resolve, reject) => {
            const tx = db.transaction(DB_FILE_HANDLE_STORE, 'readonly');
            const req = tx.objectStore(DB_FILE_HANDLE_STORE).get(DB_FILE_HANDLE_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error || new Error('indexedDB read failed'));
        });
        db.close();
        return result;
    }

    async function getHandlePermission(handle, request = false) {
        if (!handle || typeof handle.queryPermission !== 'function') return 'granted';
        const opts = { mode: 'readwrite' };
        let state = await handle.queryPermission(opts);
        if (state === 'granted') return state;
        if (request && typeof handle.requestPermission === 'function') {
            state = await handle.requestPermission(opts);
        }
        return state;
    }

    async function restoreBoundDatabaseFileHandle() {
        if (!isFileBindingSupported()) return;
        if (dbFileHandle) return;
        try {
            const handle = await readPersistedBoundFileHandle();
            if (!handle) return;
            dbFileHandle = handle;
            if (typeof updateDatabaseFileSaveIndicator === 'function') updateDatabaseFileSaveIndicator();
        } catch (e) {
            console.warn('Не удалось восстановить привязку файла базы:', e);
        }
    }

    async function writeSnapshotToHandle(handle) {
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(getDatabaseSnapshot(), null, 2));
        await writable.close();
    }

    async function saveDatabaseFile() {
        if (!window.showSaveFilePicker) {
            exportJSON();
            markDatabaseSavedAtNow();
            if (typeof updateDatabaseFileSaveIndicator === 'function') updateDatabaseFileSaveIndicator();
            alert('Браузер не поддерживает прямую перезапись файла. Скачан обычный JSON.');
            return;
        }

        try {
            if (!dbFileHandle) {
                dbFileHandle = await window.showSaveFilePicker({
                    suggestedName: `crm_backup_${new Date().toISOString().slice(0,10)}.json`,
                    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
                });
                await persistBoundFileHandle(dbFileHandle);
            }

            const permission = await getHandlePermission(dbFileHandle, true);
            if (permission !== 'granted') throw new Error('File permission denied');
            await writeSnapshotToHandle(dbFileHandle);
            markDatabaseSavedAtNow();
            if (typeof updateDatabaseFileSaveIndicator === 'function') updateDatabaseFileSaveIndicator();
            alert('База сохранена в файл.');
        } catch (e) {
            if (e && e.name === 'AbortError') return;
            console.error(e);
            exportJSON();
            markDatabaseSavedAtNow();
            if (typeof updateDatabaseFileSaveIndicator === 'function') updateDatabaseFileSaveIndicator();
            alert('Не удалось записать в привязанный файл. База сохранена как обычный JSON.');
        }
    }

    async function autoSaveToBoundFile() {
        if (!dbFileHandle || !dbDirty) return;
        try {
            const permission = await getHandlePermission(dbFileHandle, false);
            if (permission !== 'granted') {
                if (!autoSaveWarnedNoPermission && typeof showToast === 'function') {
                    showToast('Автосохранение в файл требует подтверждения: нажмите "Сохранить файл" один раз.', 'warning', 5000);
                    autoSaveWarnedNoPermission = true;
                }
                return;
            }
            await writeSnapshotToHandle(dbFileHandle);
            markDatabaseSavedAtNow();
            if (typeof updateDatabaseFileSaveIndicator === 'function') updateDatabaseFileSaveIndicator();
        } catch(e) {
            if (!autoSaveWarnedNoPermission && typeof showToast === 'function') {
                showToast('Автосохранение в привязанный файл не удалось. Нажмите "Сохранить файл".', 'warning', 5000);
                autoSaveWarnedNoPermission = true;
            }
        }
    }

    function openManagerReportModal() {
        const today = new Date();
        const to = today.toISOString().split('T')[0];
        const fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 30);
        const from = fromDate.toISOString().split('T')[0];

        document.getElementById('reportDateFrom').value = from;
        document.getElementById('reportDateTo').value = to;
        document.getElementById('managerReportModal').classList.remove('hidden');
    }


    function exportManagerReport() {
        const from = document.getElementById('reportDateFrom').value;
        const to = document.getElementById('reportDateTo').value;
        if (!from || !to) return alert('Укажите период отчета');
        if (from > to) return alert('Дата "с" не может быть больше даты "по"');

        const tasksInPeriod = history
            .map(h => ({
                ...h,
                reportDate: String(h.date || getExecutionDate(h) || h.nextDate || '').trim()
            }))
            .filter(h => h.reportDate && h.reportDate >= from && h.reportDate <= to)
            .sort((a, b) => {
                const byDate = String(a.reportDate).localeCompare(String(b.reportDate));
                if (byDate !== 0) return byDate;
                return String(a.time || '').localeCompare(String(b.time || ''));
            });

        if (!tasksInPeriod.length) return alert('За выбранный период задач для отчета не найдено');

        const tasksByClientId = new Map();
        tasksInPeriod.forEach(task => {
            const key = String(task.clientId || '');
            if (!key) return;
            if (!tasksByClientId.has(key)) tasksByClientId.set(key, []);
            tasksByClientId.get(key).push(task);
        });

        const rows = [...tasksByClientId.entries()]
            .map(([clientId, clientTasks]) => {
                const client = clients.find(c => String(c.id) === String(clientId));
                const primaryContact = client ? getClientPrimaryContact(client) : null;
                const contactName = String(primaryContact?.name || '').trim() || '-';
                const phone = String(primaryContact?.phone || client?.phone || '').trim() || '-';
                const clientNote = String(client?.notes || '').trim();

                const taskText = clientTasks.map(task => {
                    const topic = String(task.desc || task.nextStep || '').trim();
                    const result = String(task.result || '').trim();
                    const dateText = String(task.reportDate || '').trim();
                    const parts = [];
                    if (dateText) parts.push(`[${dateText}]`);
                    parts.push(`Тема: ${topic || '-'}`);
                    parts.push(`Итог: ${result || '-'}`);
                    return parts.join(' ');
                });

                const commentParts = [];
                if (clientNote) commentParts.push(`Заметка: ${clientNote}`);
                if (taskText.length) commentParts.push(taskText.join('\n'));

                return {
                    'Контрагент': client ? (client.name || 'Без названия') : 'Удаленный контрагент',
                    'Тип Клиента': client ? (formatClientTypes(client.type) || '-') : '-',
                    'Контактное лицо': contactName,
                    'Телефон': phone,
                    'Комментарий': commentParts.join('\n\n') || '-'
                };
            })
            .sort((a, b) => String(a['Контрагент']).localeCompare(String(b['Контрагент'])));

        const ws = XLSX.utils.json_to_sheet(rows, {
            header: ['Контрагент', 'Тип Клиента', 'Контактное лицо', 'Телефон', 'Комментарий']
        });
        ws['!cols'] = [
            { wch: 28 },
            { wch: 18 },
            { wch: 24 },
            { wch: 18 },
            { wch: 110 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Отчет");
        XLSX.writeFile(wb, `Manager_Report_${from}_to_${to}.xlsx`);
        closeModal('managerReportModal');
    }

    function exportToExcel() {
        if(!clients.length && !history.length) return alert("Нет данных");
        const wsC = XLSX.utils.json_to_sheet(clients.map(c => ({ID:c.id, Название:c.name, Тип:formatClientTypes(c.type), Класс:normalizeClientClass(c.class), Телефон:c.phone, Статус:c.status, Связанные:c.related, Заметки:c.notes})));
        const wsH = XLSX.utils.json_to_sheet(history.map(h => ({Дата:h.date, Клиент: clients.find(c=>String(c.id)===String(h.clientId))?.name || 'Unknown', Итог:h.result, Задача:h.nextStep, Статус: h.taskStatus==='new'?'Новая':(h.taskStatus==='work'?'В работе':'Выполнена')})));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsC, "Клиенты");
        XLSX.utils.book_append_sheet(wb, wsH, "История");
        XLSX.writeFile(wb, `CRM_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
    }

    function exportJSON() {
        const blob = new Blob([JSON.stringify(getDatabaseSnapshot(), null, 2)], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `crm_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    }

    function importJSON(input) {
        const file = input.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                let newClients = [];
                let newHistory = [];

                // New snapshot format: { clients, history, deals?, touches?, settings }
                if (data.clients && Array.isArray(data.clients) && data.history && Array.isArray(data.history)) {
                    data.clients.forEach(client => {
                        if(!client.id) client.id = Date.now() + Math.random();
                        if(!client.name) client.name = "Без названия";
                        if(!client.address) client.address = "";
                        if(!client.phone) client.phone = "";
                        client.type = normalizeClientType(client.type) || "Не указан";
                        client.class = normalizeClientClass(client.class);
                        if(!client.status) client.status = "Новый";
                        if(!client.notes) client.notes = "";
                        if(!client.related) client.related = "";
                        client.relatedClientIds = normalizeRelatedClientIds(client.relatedClientIds);
                        if(!client.contacts) client.contacts = [];
                    });

                    clients = data.clients;
                    history = data.history.map(h => {
                        if(h.taskStatus === undefined) h.taskStatus = 'new';
                        return h;
                    });
                    deals = Array.isArray(data.deals) ? data.deals.map(d => ensureDealRecord(d)) : [];
                    touches = Array.isArray(data.touches) ? data.touches.map(t => ensureTouchRecord(t)) : [];
                    history = ensureHistoryIdsUnique(history);
                    clients.forEach(c => ensureClientTypesInOptions(c.type));

                    if (data.settings && data.settings.inactiveFilter) {
                        const f = data.settings.inactiveFilter;
                        inactiveFilterCount = Math.max(1, parseInt(f.count, 10) || 30);
                        inactiveFilterUnit = ['days','weeks','months'].includes(f.unit) ? f.unit : 'days';
                    }
                    clientTaskTouchedAt = {};
                    if (data.settings && data.settings.clientTaskTouchedAt && typeof data.settings.clientTaskTouchedAt === 'object') {
                        const sanitized = {};
                        Object.entries(data.settings.clientTaskTouchedAt).forEach(([k, v]) => {
                            const ts = toSafeActivityTs(v);
                            if (ts) sanitized[String(k)] = ts;
                        });
                        clientTaskTouchedAt = sanitized;
                    }
                    clientLastContactAt = {};
                    if (data.settings && data.settings.clientLastContactAt && typeof data.settings.clientLastContactAt === 'object') {
                        const sanitized = {};
                        Object.entries(data.settings.clientLastContactAt).forEach(([k, v]) => {
                            const ts = toSafeActivityTs(v);
                            if (ts) sanitized[String(k)] = ts;
                        });
                        clientLastContactAt = sanitized;
                    }
                    callSessionLog = {};
                    if (data.settings && data.settings.callSessionLog && typeof data.settings.callSessionLog === 'object') {
                        const normalized = {};
                        Object.entries(data.settings.callSessionLog).forEach(([day, dayMap]) => {
                            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return;
                            if (!dayMap || typeof dayMap !== 'object') return;
                            const row = {};
                            Object.entries(dayMap).forEach(([cid, ts]) => {
                                const safeTs = toSafeActivityTs(ts);
                                if (safeTs) row[String(cid)] = safeTs;
                            });
                            if (Object.keys(row).length) normalized[String(day)] = row;
                        });
                        callSessionLog = normalized;
                    }
                    history.forEach(h => {
                        h.modifiedAt = getHistoryRecordActivityTs(h);
                        touchClientTaskActivity(h.clientId, h.modifiedAt);
                    });
                    if (!Object.keys(clientLastContactAt).length) rebuildClientLastContactCache();
                    pruneCallSessionLog();
                    if (data.settings && Array.isArray(data.settings.clientTypeOptions) && data.settings.clientTypeOptions.length) {
                        clientTypeOptions = [...new Set(data.settings.clientTypeOptions.map(v => String(v || '').trim()).filter(Boolean))];
                        if (!clientTypeOptions.some(v => v.toLowerCase() === 'не указан')) clientTypeOptions.unshift('Не указан');
                        if (!clientTypeOptions.some(v => v.toLowerCase() === 'для собственных нужд')) clientTypeOptions.push('Для собственных нужд');
                        renderClientTypeOptions();
                    }

                    saveData();
                    renderClientList();
                    renderGlobalTasks();
                    renderDealsSidebar();
                    renderCallQueue();
                    updateCallSessionInfo();
                    updateDashboard();
                    updateDatabaseFileSaveIndicator();
                    alert('✅ Данные загружены!\nКлиентов: ' + clients.length + '\nЗаписей: ' + history.length + '\nСделок: ' + deals.length + '\nКасаний: ' + touches.length);

                } else if (data.clients && Array.isArray(data.clients)) {
                    console.log("Обнаружен формат импорта. Начинаю конвертацию...");
                    
                    // 1. Конвертируем клиентов
                    data.clients.forEach(oldClient => {
                        const newClient = {
                            id: oldClient.id, // Сохраняем UUID
                            name: oldClient.name.trim(),
                            phone: oldClient.phone ? oldClient.phone.trim() : "",
                            address: oldClient.address ? oldClient.address.trim() : "",
                            type: normalizeClientType(oldClient.type) || "Не указан",
                            class: normalizeClientClass(oldClient.class),
                            status: oldClient.status ? oldClient.status.trim() : "в работе",
                            related: oldClient.related ? oldClient.related.trim() : "",
                            relatedClientIds: normalizeRelatedClientIds(oldClient.relatedClientIds),
                            notes: oldClient.notes ? oldClient.notes.trim() : "",
                            contacts: []
                        };

                        if (oldClient.contacts && Array.isArray(oldClient.contacts)) {
                            newClient.contacts = oldClient.contacts.map(c => ({
                                id: c.id,
                                name: c.name ? c.name.trim() : "Без имени",
                                phone: c.phone ? c.phone.trim() : "",
                                role: c.role ? c.role.trim() : ""
                            }));
                        }
                        newClients.push(newClient);
                    });

                    // 2. Конвертируем историю (interactions -> history)
                    if (data.interactions && Array.isArray(data.interactions)) {
                        data.interactions.forEach(interaction => {
                            const client = newClients.find(c => String(c.id) === String(interaction.clientId));
                            let contactName = "Не указано";
                            if (interaction.contactPersonId && client) {
                                const foundContact = client.contacts.find(c => String(c.id) === String(interaction.contactPersonId));
                                if (foundContact) contactName = foundContact.name;
                            }

                            let callType = "Исходящий";
                            if (interaction.direction === 'incoming') callType = "Входящий";

                            const newRecord = {
                                id: interaction.id,
                                clientId: interaction.clientId,
                                date: interaction.date,
                                time: interaction.time || "",
                                type: callType,
                                result: interaction.outcome ? interaction.outcome : "Другое",
                                desc: interaction.talkedAbout ? interaction.talkedAbout : "",
                                nextDate: interaction.nextContactDate || "",
                                nextTime: interaction.nextContactTime || "",
                                nextStep: interaction.nextStep || "",
                                taskStatus: interaction.taskStatus === 'open' ? 'new' : 'done'
                            };
                            newHistory.push(newRecord);
                        });
                    }
                    
                    // 3. Конвертируем отдельные задачи (tasks)
                    if (data.tasks && Array.isArray(data.tasks)) {
                         data.tasks.forEach(task => {
                             if(task.whatToAsk && task.whatToAsk.trim() !== "") {
                                 const exists = newHistory.some(h => String(h.id) === String(task.id));
                                 if(!exists) {
                                     newHistory.push({
                                         id: task.id,
                                         clientId: task.clientId,
                                         date: new Date().toISOString().split('T')[0],
                                         time: "",
                                         type: task.direction === 'incoming' ? "Входящий" : "Исходящий",
                                         result: "Задача",
                                         desc: "Импортировано из Tasks",
                                         nextDate: task.dueDate || "",
                                         nextTime: task.dueTime || "",
                                         nextStep: task.whatToAsk || "",
                                         taskStatus: task.status === 'open' ? 'new' : 'done'
                                     });
                                 }
                             }
                         });
                    }

                    clients = newClients;
                    history = newHistory;
                    deals = [];
                    touches = [];
                    history = ensureHistoryIdsUnique(history);
                    clients.forEach(c => ensureClientTypesInOptions(c.type));
                    clientTaskTouchedAt = {};
                    if (data.settings && data.settings.clientTaskTouchedAt && typeof data.settings.clientTaskTouchedAt === 'object') {
                        const sanitized = {};
                        Object.entries(data.settings.clientTaskTouchedAt).forEach(([k, v]) => {
                            const ts = toSafeActivityTs(v);
                            if (ts) sanitized[String(k)] = ts;
                        });
                        clientTaskTouchedAt = sanitized;
                    }
                    clientLastContactAt = {};
                    if (data.settings && data.settings.clientLastContactAt && typeof data.settings.clientLastContactAt === 'object') {
                        const sanitized = {};
                        Object.entries(data.settings.clientLastContactAt).forEach(([k, v]) => {
                            const ts = toSafeActivityTs(v);
                            if (ts) sanitized[String(k)] = ts;
                        });
                        clientLastContactAt = sanitized;
                    }
                    callSessionLog = {};
                    if (data.settings && data.settings.callSessionLog && typeof data.settings.callSessionLog === 'object') {
                        const normalized = {};
                        Object.entries(data.settings.callSessionLog).forEach(([day, dayMap]) => {
                            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return;
                            if (!dayMap || typeof dayMap !== 'object') return;
                            const row = {};
                            Object.entries(dayMap).forEach(([cid, ts]) => {
                                const safeTs = toSafeActivityTs(ts);
                                if (safeTs) row[String(cid)] = safeTs;
                            });
                            if (Object.keys(row).length) normalized[String(day)] = row;
                        });
                        callSessionLog = normalized;
                    }
                    history.forEach(h => {
                        h.modifiedAt = getHistoryRecordActivityTs(h);
                        touchClientTaskActivity(h.clientId, h.modifiedAt);
                    });
                    if (!Object.keys(clientLastContactAt).length) rebuildClientLastContactCache();
                    pruneCallSessionLog();
                    if (data.settings && data.settings.inactiveFilter) {
                        const f = data.settings.inactiveFilter;
                        inactiveFilterCount = Math.max(1, parseInt(f.count, 10) || 30);
                        inactiveFilterUnit = ['days','weeks','months'].includes(f.unit) ? f.unit : 'days';
                    }
                    if (data.settings && Array.isArray(data.settings.clientTypeOptions) && data.settings.clientTypeOptions.length) {
                        clientTypeOptions = [...new Set(data.settings.clientTypeOptions.map(v => String(v || '').trim()).filter(Boolean))];
                        if (!clientTypeOptions.some(v => v.toLowerCase() === 'не указан')) clientTypeOptions.unshift('Не указан');
                        if (!clientTypeOptions.some(v => v.toLowerCase() === 'для собственных нужд')) clientTypeOptions.push('Для собственных нужд');
                        renderClientTypeOptions();
                    }
                    
                    saveData();
                    renderClientList();
                    renderGlobalTasks();
                    renderDealsSidebar();
                    renderCallQueue();
                    updateCallSessionInfo();
                    updateDashboard();
                    updateDatabaseFileSaveIndicator();
                    alert(`✅ УСПЕШНО!\nИмпортировано:\n- Клиентов: ${clients.length}\n- Записей истории/задач: ${history.length}`);

                } else {
                    alert('❌ Неверный формат файла');
                }
            } catch(err) {
                console.error(err);
                alert('❌ Ошибка: ' + err.message);
            }
        };
        reader.readAsText(file);
    }


