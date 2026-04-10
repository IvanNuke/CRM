// --- DATA ---
    let clients = [];
    let history = [];
    let deals = [];
    let touches = [];
    let currentClientId = null;
    let soundEnabled = false;
    let currentSidebarTab = 'tasks';
    let modalContacts = [];
    let modalRelatedClientIds = [];
    let modalEditingClientId = '';
    let isTaskCreateMode = false;
    let forcedHistoryClientId = '';
    let taskClientSearchCache = [];
    let headerSmartSearchResults = [];
    let headerSmartSearchActiveIndex = -1;
    let clientTaskTouchedAt = {};
    let currentTaskFilter = 'active';
    let currentGlobalTaskStatusFilter = 'all';
    let currentGlobalTaskDateFilter = '';
    let currentGlobalTaskSort = 'due';
    let currentDealTimingFilter = 'open';
    let currentDealCategoryFilter = 'all';
    let currentDealStageFilter = 'all';
    let currentDealSort = 'amount_desc';
    let currentDealId = '';
    let currentClientSort = 'alpha';
    let currentContentTab = 'tasks';
    let callQueueSelectedClientId = '';
    let callQueueCurrentCandidates = [];
    let callSessionState = { active: false, target: 10, done: 0 };
    let dashboardWeekStart = null;
    let dashboardSelectedDate = null;
    let timelineDragTimePreview = { date: '', time: '' };
    let timelineDragDropState = { taskId: '', date: '', time: '' };
    let inactiveFilterCount = 30;
    let inactiveFilterUnit = 'days';
    let clientLastContactAt = {};
    let callSessionLog = {};
    let clientTypeOptions = ['Не указан', 'Монтажник', 'Перекуп', 'Частник', 'Для собственных нужд'];
    let dealStageOptions = getDefaultDealStageOptions();
    let dealCategoryOptions = getDefaultDealCategoryOptions();
    let taskTopicTemplates = [];
    let dbFileHandle = null;
    let dbDirty = false;
    let dbLastFileSaveAt = 0;
    let taskViewDoneConfirmMode = false;
    let taskViewPendingProgressType = '';
    let taskViewReturnStatKind = '';
    let remindedTaskKeys = new Set();
    let lastReminderCheckTs = Date.now();
    let notificationAudioCtx = null;
    let customNotificationSoundUrl = '';
    let customNotificationSoundName = '';
    let clientFillWizardState = { active: false, queue: [], index: 0 };
    let pendingBoundFileSaveTimer = 0;
    const baseDocumentTitle = document.title;
    const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebarWidthPx';
    const SIDEBAR_WIDTH_DEFAULT = 560;
    const SIDEBAR_WIDTH_MIN = 430;
    const SIDEBAR_WIDTH_MAX = 980;

    // --- INIT ---
    document.addEventListener('DOMContentLoaded', () => {
        bindStaticActions();
        bindStaticInputs();
        const storedClients = CRMStore.get('clients');
        const storedHistory = CRMStore.get('history');
        const storedDeals = CRMStore.get('deals');
        const storedTouches = CRMStore.get('touches');
        const storedInactiveFilter = CRMStore.get('inactiveFilter');
        const storedClientTypeOptions = CRMStore.get('clientTypeOptions');
        const storedDealStageOptions = CRMStore.get('dealStageOptions');
        const storedDealCategoryOptions = CRMStore.get('dealCategoryOptions');
        const storedTaskTopicTemplates = CRMStore.get('taskTopicTemplates');
        const storedClientSort = CRMStore.get('clientSort');
        const storedClientTaskTouched = CRMStore.get('clientTaskTouched');
        const storedClientLastContact = CRMStore.get('clientLastContact');
        const storedCallSessionLog = CRMStore.get('callSessionLog');
        const storedDbLastJsonSaveAt = CRMStore.get('dbLastJsonSaveAt');
        const classMigrationDone = CRMStore.get('classMigrationDone');
        clients = storedClients ? JSON.parse(storedClients) : [];
        history = storedHistory ? JSON.parse(storedHistory) : [];
        deals = storedDeals ? JSON.parse(storedDeals) : [];
        touches = storedTouches ? JSON.parse(storedTouches) : [];
        deals = (Array.isArray(deals) ? deals : []).map(d => ensureDealRecord(d));
        touches = (Array.isArray(touches) ? touches : []).map(t => ensureTouchRecord(t));
        history = ensureHistoryIdsUnique(history);
        if (storedClientSort && ['alpha','class','recent_task'].includes(storedClientSort)) {
            currentClientSort = storedClientSort;
        }
        if (storedInactiveFilter) {
            try {
                const parsed = JSON.parse(storedInactiveFilter);
                inactiveFilterCount = Math.max(1, parseInt(parsed.count, 10) || 30);
                inactiveFilterUnit = ['days','weeks','months'].includes(parsed.unit) ? parsed.unit : 'days';
            } catch(e) {}
        }
        if (storedClientTaskTouched) {
            try {
                const parsed = JSON.parse(storedClientTaskTouched);
                if (parsed && typeof parsed === 'object') {
                    const sanitized = {};
                    Object.entries(parsed).forEach(([k, v]) => {
                        const ts = toSafeActivityTs(v);
                        if (ts) sanitized[String(k)] = ts;
                    });
                    clientTaskTouchedAt = sanitized;
                }
            } catch(e) {}
        }
        if (storedClientLastContact) {
            try {
                const parsed = JSON.parse(storedClientLastContact);
                if (parsed && typeof parsed === 'object') {
                    const sanitized = {};
                    Object.entries(parsed).forEach(([k, v]) => {
                        const ts = toSafeActivityTs(v);
                        if (ts) sanitized[String(k)] = ts;
                    });
                    clientLastContactAt = sanitized;
                }
            } catch(e) {}
        }
        if (storedCallSessionLog) {
            try {
                const parsed = JSON.parse(storedCallSessionLog);
                if (parsed && typeof parsed === 'object') {
                    const normalized = {};
                    Object.entries(parsed).forEach(([day, dayMap]) => {
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
            } catch(e) {}
        }
        if (storedClientTypeOptions) {
            try {
                const parsed = JSON.parse(storedClientTypeOptions);
                if (Array.isArray(parsed) && parsed.length) {
                    clientTypeOptions = [...new Set(parsed.map(v => String(v || '').trim()).filter(Boolean))];
                }
            } catch(e) {}
        }
        if (storedDealStageOptions) {
            try {
                const parsed = JSON.parse(storedDealStageOptions);
                dealStageOptions = normalizeDealOptionList(parsed, getDefaultDealStageOptions(), ['Закрыто']);
            } catch(e) {}
        }
        if (storedDealCategoryOptions) {
            try {
                const parsed = JSON.parse(storedDealCategoryOptions);
                dealCategoryOptions = normalizeDealOptionList(parsed, getDefaultDealCategoryOptions(), ['Прочее']);
            } catch(e) {}
        }
        if (storedTaskTopicTemplates) {
            try {
                const parsed = JSON.parse(storedTaskTopicTemplates);
                taskTopicTemplates = normalizeTaskTopicTemplates(parsed);
            } catch(e) {}
        }
        if (storedDbLastJsonSaveAt) {
            const ts = parseInt(storedDbLastJsonSaveAt, 10);
            if (Number.isFinite(ts) && ts > 0) dbLastFileSaveAt = ts;
        }
        if (!clientTypeOptions.some(v => v.toLowerCase() === 'не указан')) {
            clientTypeOptions.unshift('Не указан');
        }
        if (!clientTypeOptions.some(v => v.toLowerCase() === 'для собственных нужд')) {
            clientTypeOptions.push('Для собственных нужд');
        }
        clients.forEach(c => {
            c.type = normalizeClientType(c.type) || 'Не указан';
            const normalizedClass = normalizeClientClass(c.class);
            // One-time migration: previous build defaulted new field to B.
            c.class = (!classMigrationDone && normalizedClass === 'B') ? 'Не указан' : normalizedClass;
            const rawClientPhone = String(c.phone || '').trim();
            c.phone = /\d/.test(rawClientPhone) ? formatPhoneValue(rawClientPhone) : rawClientPhone;
            if (Array.isArray(c.contacts)) {
                c.contacts = c.contacts.map((ct, idx) => normalizeContact(ct, idx));
            }
            if (!String(c.phone || '').trim()) {
                c.phone = getMainClientPhoneFromContacts(c.contacts || []);
            }
            c.relatedClientIds = normalizeRelatedClientIds(c.relatedClientIds);
            ensureClientTypesInOptions(c.type);
        });
        deals.forEach((d) => {
            ensureDealStageInOptions(d.stage, false);
            ensureDealCategoryInOptions(d.category, false);
        });
        history.forEach(h => {
            ensureTaskCreatedAt(h);
            refreshWorkItemTempState(h);
            h.modifiedAt = getHistoryRecordActivityTs(h);
            touchClientTaskActivity(h.clientId, h.modifiedAt);
        });
        rebuildClientLastContactCache();
        pruneCallSessionLog();
        CRMStore.set('classMigrationDone', '1');
        renderClientTypeOptions();
        renderTaskTopicTemplateOptions();
        renderAllDealOptionControls();
        bindClientModalValidationLive();
        const sortSelect = document.getElementById('clientSort');
        if (sortSelect) sortSelect.value = currentClientSort;

        renderClientList();
        renderGlobalTasks();
        renderDealsSidebar();
        renderCallQueue();
        updateCallSessionInfo();
        updateDashboard();
        updateDatabaseFileSaveIndicator();
        if (typeof restoreBoundDatabaseFileHandle === 'function') {
            void restoreBoundDatabaseFileHandle();
        }
        initSidebarResize();
        dashboardWeekStart = getWeekStartIso(new Date());
        
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('hDate').value = today;
        document.getElementById('hNextDate').value = today;

        // Always flush current state to localStorage when tab is hidden/closed.
        window.addEventListener('beforeunload', persistStateToLocalStorage);
        window.addEventListener('pagehide', () => {
            persistStateToLocalStorage();
            void autoSaveToBoundFile();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                persistStateToLocalStorage();
                void autoSaveToBoundFile();
            }
        });

        // Periodic autosave to bound file, if user attached one.
        setInterval(() => { void autoSaveToBoundFile(); }, 30000);
        // Periodic task reminder check.
        setInterval(checkTaskReminders, 15000);
        setTimeout(checkTaskReminders, 1500);

        // Default sidebar/view state.
        switchSidebarTab('dashboard');
    });

    function isMobileSidebarLayout() {
        return window.matchMedia('(max-width: 980px)').matches;
    }

    function applySidebarWidth(px, persist = true) {
        const container = document.querySelector('.container');
        if (!container) return;
        if (isMobileSidebarLayout()) {
            container.style.removeProperty('--sidebar-width');
            return;
        }
        const rect = container.getBoundingClientRect();
        const maxByContainer = rect.width > 0 ? Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, rect.width - 220)) : SIDEBAR_WIDTH_MAX;
        const safe = Math.max(SIDEBAR_WIDTH_MIN, Math.min(maxByContainer, Math.round(px || SIDEBAR_WIDTH_DEFAULT)));
        container.style.setProperty('--sidebar-width', `${safe}px`);
        if (persist) CRMStore.set(SIDEBAR_WIDTH_STORAGE_KEY, String(safe));
    }

    function initSidebarResize() {
        const handle = document.getElementById('sidebarResizeHandle');
        const container = document.querySelector('.container');
        if (!handle || !container || handle.dataset.bound === '1') return;
        handle.dataset.bound = '1';

        const stored = parseInt(CRMStore.get(SIDEBAR_WIDTH_STORAGE_KEY), 10);
        if (Number.isFinite(stored) && stored > 0) applySidebarWidth(stored, false);
        else applySidebarWidth(SIDEBAR_WIDTH_DEFAULT, false);

        let pointerId = null;
        let dragging = false;

        const stopDrag = () => {
            if (!dragging) return;
            dragging = false;
            pointerId = null;
            handle.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        handle.addEventListener('pointerdown', (e) => {
            if (isMobileSidebarLayout()) return;
            dragging = true;
            pointerId = e.pointerId;
            handle.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            try { handle.setPointerCapture(pointerId); } catch (err) {}
            e.preventDefault();
        });

        handle.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            if (pointerId !== null && e.pointerId !== pointerId) return;
            const rect = container.getBoundingClientRect();
            const nextWidth = e.clientX - rect.left;
            const maxByContainer = Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, rect.width - 220));
            applySidebarWidth(Math.min(nextWidth, maxByContainer), true);
        });

        handle.addEventListener('pointerup', stopDrag);
        handle.addEventListener('pointercancel', stopDrag);
        handle.addEventListener('lostpointercapture', stopDrag);

        handle.addEventListener('dblclick', () => {
            applySidebarWidth(SIDEBAR_WIDTH_DEFAULT, true);
        });

        window.addEventListener('resize', () => {
            if (isMobileSidebarLayout()) {
                container.style.removeProperty('--sidebar-width');
                return;
            }
            const currentVar = parseInt(getComputedStyle(container).getPropertyValue('--sidebar-width'), 10);
            if (Number.isFinite(currentVar)) applySidebarWidth(currentVar, false);
        });
    }

    function bindStaticActions() {
        const actionHandlers = {
            toggleSound: () => toggleSound(),
            openCustomSoundPicker: () => openCustomSoundPicker(),
            resetCustomSound: () => resetCustomSound(),
            exportToExcel: () => exportToExcel(),
            openManagerReportModal: () => openManagerReportModal(),
            exportJSON: () => exportJSON(),
            saveDatabaseFile: () => saveDatabaseFile(),
            openImport: () => document.getElementById('importFile')?.click(),
            resetData: () => resetData(),
            openClientModal: () => openClientModal(),
            clearClientSearch: () => clearClientSearch(),
            clearHeaderSmartSearch: () => clearHeaderSmartSearch(),
            startClientFillWizard: () => startClientFillWizard(),
            openGlobalTaskModal: () => openGlobalTaskModal(),
            openCreateDealPrompt: () => openCreateDealPrompt(),
            saveDealModal: () => saveDealModal(),
            clearGlobalTaskDateFilter: () => clearGlobalTaskDateFilter(),
            startCallSession: () => startCallSession(),
            stopCallSession: () => stopCallSession(),
            resetDashboardWeek: () => resetDashboardWeek(),
            editCurrentClient: () => editCurrentClient(),
            deleteCurrentClient: () => deleteCurrentClient(),
            openHistoryModal: () => openHistoryModal(),
            addSelectedRelatedClient: () => addSelectedRelatedClient(),
            addModalContact: () => addModalContact(),
            saveClientAndNext: () => saveClientAndNext(),
            saveClient: () => saveClient(),
            openHistoryModalClientCard: () => openHistoryModalClientCard(),
            saveHistory: () => saveHistory(),
            openTaskClientFromModal: () => openTaskClientFromModal(),
            cancelMarkTaskDoneFromModal: () => cancelMarkTaskDoneFromModal(),
            markTaskDoneFromModal: () => markTaskDoneFromModal(),
            toggleTaskViewProgressPanel: () => toggleTaskViewProgressPanel(),
            taskViewOpenReschedule: () => taskViewOpenReschedule(),
            taskViewOpenNoAnswerReschedule: () => taskViewOpenNoAnswerReschedule(),
            saveTaskViewProgressDraft: () => saveTaskViewProgressDraft(),
            cancelTaskViewProgressDraft: () => cancelTaskViewProgressDraft(),
            createDealFromTaskModal: () => createDealFromTaskModal(),
            editTaskFromModal: () => editTaskFromModal(),
            deleteTaskFromModal: () => deleteTaskFromModal(),
            saveInactiveFilter: () => saveInactiveFilter(),
            exportManagerReport: () => exportManagerReport(),
            saveRescheduledTask: () => saveRescheduledTask(),
            saveDealTouchModal: () => saveDealTouchModal(),
            applyTaskTopicTemplate: () => applyTaskTopicTemplate(),
            addTaskTopicTemplate: () => addTaskTopicTemplate(),
            deleteTaskTopicTemplate: () => deleteTaskTopicTemplate(),
            openDealsSidebar: () => openDealsSidebar()
        };

        const actionHandlersWithDataset = {
            switchSidebarTab: (el) => switchSidebarTab(String(el.dataset.tab || '')),
            openHeaderSmartSearchResult: (el) => openHeaderSmartSearchResult(parseInt(el.dataset.index, 10)),
            setTaskFilter: (el) => setTaskFilter(String(el.dataset.filter || ''), el),
            openStatModal: (el) => openStatModal(String(el.dataset.kind || '')),
            shiftDashboardWeek: (el) => shiftDashboardWeek(parseInt(el.dataset.offset, 10) || 0),
            switchContentTab: (el) => switchContentTab(String(el.dataset.tab || ''), el),
            closeModal: (el) => closeModal(String(el.dataset.modal || '')),
            setModalStatus: (el) => setModalStatus(String(el.dataset.status || '')),
            taskViewPostponeQuick: (el) => taskViewPostponeQuick(String(el.dataset.kind || '')),
            taskViewAddProgressEvent: (el) => taskViewAddProgressEvent(String(el.dataset.progressType || '')),
            openDealFromDashboard: (el) => openDealFromDashboard(String(el.dataset.dealId || '')),
            setDealTimingFilter: (el) => setDealTimingFilter(String(el.dataset.dealTimingFilter || '')),
            dealOpenClient: (el) => dealOpenClient(String(el.dataset.clientId || '')),
            dealOpenTask: (el) => dealOpenTask(String(el.dataset.taskId || '')),
            openDealModal: (el) => openDealModal(String(el.dataset.dealId || '')),
            deleteDeal: (el) => deleteDeal(String(el.dataset.dealId || '')),
            dealDialPhone: (el) => dealDialPhone(String(el.dataset.phone || '')),
            dealWhatsApp: (el) => dealWhatsApp(String(el.dataset.phone || '')),
            dealTelegram: (el) => dealTelegram(String(el.dataset.phone || '')),
            manageDealOption: (el) => manageDealOption(String(el.dataset.kind || ''), String(el.dataset.mode || ''), String(el.dataset.target || ''))
        };

        document.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action]');
            if (!el) return;
            const action = String(el.dataset.action || '');
            if (!action) return;

            const staticHandler = actionHandlers[action];
            if (typeof staticHandler === 'function') return staticHandler();

            const dynamicHandler = actionHandlersWithDataset[action];
            if (typeof dynamicHandler === 'function') return dynamicHandler(el);
        });
    }

    function bindStaticInputs() {
        const clientSort = document.getElementById('clientSort');
        if (clientSort) clientSort.addEventListener('change', () => setClientSort(clientSort.value));

        const searchClient = document.getElementById('searchClient');
        if (searchClient) searchClient.addEventListener('input', () => renderClientList());

        const headerSearch = document.getElementById('headerSmartSearchInput');
        if (headerSearch) {
            headerSearch.addEventListener('input', () => renderHeaderSmartSearch());
            headerSearch.addEventListener('focus', () => renderHeaderSmartSearch());
            headerSearch.addEventListener('keydown', handleHeaderSmartSearchKeydown);
        }
        updateHeaderSmartSearchClearBtn();
        document.addEventListener('click', (e) => {
            const wrap = document.getElementById('headerSmartSearchWrap');
            if (!wrap) return;
            if (!wrap.contains(e.target)) hideHeaderSmartSearchDropdown();
        });

        const globalTaskStatus = document.getElementById('globalTaskStatusFilter');
        if (globalTaskStatus) globalTaskStatus.addEventListener('change', () => setGlobalTaskStatusFilter(globalTaskStatus.value));
        const globalTaskDate = document.getElementById('globalTaskDateFilter');
        if (globalTaskDate) globalTaskDate.addEventListener('change', () => setGlobalTaskDateFilter(globalTaskDate.value));
        const globalTaskSort = document.getElementById('globalTaskSort');
        if (globalTaskSort) globalTaskSort.addEventListener('change', () => setGlobalTaskSort(globalTaskSort.value));
        const taskTopicTemplateSelect = document.getElementById('taskTopicTemplateSelect');
        if (taskTopicTemplateSelect) taskTopicTemplateSelect.addEventListener('dblclick', () => applyTaskTopicTemplate());
        const dealTouchManualToggle = document.getElementById('dealTouchManualNextToggle');
        if (dealTouchManualToggle) {
            dealTouchManualToggle.addEventListener('change', () => syncDealTouchModalManualNextState());
        }
        const dealTimingFilter = document.getElementById('dealTimingFilter');
        if (dealTimingFilter) {
            dealTimingFilter.value = currentDealTimingFilter;
            dealTimingFilter.addEventListener('change', () => {
                currentDealTimingFilter = String(dealTimingFilter.value || 'open');
                renderDealsSidebar();
            });
        }
        const dealCategoryFilter = document.getElementById('dealCategoryFilter');
        if (dealCategoryFilter) {
            renderDealCategoryFilterOptions();
            dealCategoryFilter.value = currentDealCategoryFilter;
            dealCategoryFilter.addEventListener('change', () => {
                currentDealCategoryFilter = String(dealCategoryFilter.value || 'all');
                renderDealsSidebar();
            });
        }
        const dealStageFilter = document.getElementById('dealStageFilter');
        if (dealStageFilter) {
            renderDealStageFilterOptions();
            dealStageFilter.value = currentDealStageFilter;
            dealStageFilter.addEventListener('change', () => {
                currentDealStageFilter = String(dealStageFilter.value || 'all');
                renderDealsSidebar();
            });
        }
        const dealSortFilter = document.getElementById('dealSortFilter');
        if (dealSortFilter) {
            dealSortFilter.value = currentDealSort;
            dealSortFilter.addEventListener('change', () => {
                currentDealSort = String(dealSortFilter.value || 'amount_desc');
                renderDealsSidebar();
            });
        }
        const dealClientSearch = document.getElementById('dealClientSearch');
        if (dealClientSearch) {
            dealClientSearch.addEventListener('input', () => renderDealClientOptions());
            dealClientSearch.addEventListener('change', () => applyDealClientFromSearch());
            dealClientSearch.addEventListener('blur', () => applyDealClientFromSearch());
        }

        const cqClass = document.getElementById('cqClassFilter');
        if (cqClass) cqClass.addEventListener('change', () => renderCallQueue());
        const cqType = document.getElementById('cqTypeFilter');
        if (cqType) cqType.addEventListener('change', () => renderCallQueue());
        const cqStatus = document.getElementById('cqStatusFilter');
        if (cqStatus) cqStatus.addEventListener('change', () => renderCallQueue());
        const cqUrgency = document.getElementById('cqUrgencyFilter');
        if (cqUrgency) cqUrgency.addEventListener('change', () => renderCallQueue());
        const cqMinNoTouch = document.getElementById('cqMinNoTouch');
        if (cqMinNoTouch) cqMinNoTouch.addEventListener('change', () => renderCallQueue());
        const cqNoActive = document.getElementById('cqNoActiveOnly');
        if (cqNoActive) cqNoActive.addEventListener('change', () => renderCallQueue());
        const cqSessionTarget = document.getElementById('cqSessionTarget');
        if (cqSessionTarget) cqSessionTarget.addEventListener('change', () => updateCallSessionInfo());

        const cPhone = document.getElementById('cPhone');
        if (cPhone) cPhone.addEventListener('input', () => { cPhone.value = formatPhoneValue(cPhone.value); });

        const relatedSearch = document.getElementById('relatedClientSearch');
        if (relatedSearch) relatedSearch.addEventListener('input', () => renderRelatedClientPicker());

        const hClientSearch = document.getElementById('hClientSearch');
        if (hClientSearch) {
            hClientSearch.addEventListener('input', () => filterTaskClientSelect());
            hClientSearch.addEventListener('change', () => applyTaskClientFromSearch());
        }

        const hDate = document.getElementById('hDate');
        if (hDate) hDate.addEventListener('change', () => checkSmartVisibility());
        const hTime = document.getElementById('hTime');
        if (hTime) hTime.addEventListener('change', () => checkSmartVisibility());

        const importFile = document.getElementById('importFile');
        if (importFile) importFile.addEventListener('change', () => importJSON(importFile));

        const customSoundFile = document.getElementById('customSoundFile');
        if (customSoundFile) {
            customSoundFile.addEventListener('change', () => onCustomSoundFileSelected(customSoundFile));
        }
        updateCustomSoundButtons();
    }

    function showToast(message, type = 'info', ttlMs = 2600) {
        const root = document.getElementById('toastRoot');
        if (!root) return;
        const item = document.createElement('div');
        item.className = `toast-item ${type}`;
        item.textContent = String(message || '');
        root.appendChild(item);
        setTimeout(() => item.remove(), Math.max(900, parseInt(ttlMs, 10) || 2600));
    }

    function writeStateToLocalStorage(options = {}) {
        const includeSort = options.includeSort !== false;
        CRMStore.setJSON('clients', clients);
        CRMStore.setJSON('history', history);
        CRMStore.setJSON('deals', deals);
        CRMStore.setJSON('touches', touches);
        CRMStore.setJSON('inactiveFilter', { count: inactiveFilterCount, unit: inactiveFilterUnit });
        CRMStore.setJSON('clientTypeOptions', clientTypeOptions);
        CRMStore.setJSON('dealStageOptions', dealStageOptions);
        CRMStore.setJSON('dealCategoryOptions', dealCategoryOptions);
        if (includeSort) {
            CRMStore.set('clientSort', currentClientSort);
        }
        CRMStore.setJSON('clientTaskTouched', clientTaskTouchedAt);
        CRMStore.setJSON('clientLastContact', clientLastContactAt);
        CRMStore.setJSON('callSessionLog', callSessionLog);
    }

    function queueAutoSaveToBoundFile(delayMs = 1200) {
        if (!dbFileHandle) return;
        if (pendingBoundFileSaveTimer) clearTimeout(pendingBoundFileSaveTimer);
        pendingBoundFileSaveTimer = setTimeout(() => {
            pendingBoundFileSaveTimer = 0;
            void autoSaveToBoundFile();
        }, Math.max(300, parseInt(delayMs, 10) || 1200));
    }

    function markDatabaseDirty() {
        dbDirty = true;
        updateDatabaseFileSaveIndicator();
        queueAutoSaveToBoundFile();
    }

    function saveData() {
        writeStateToLocalStorage();
        markDatabaseDirty();
        updateDashboard();
        if(currentSidebarTab === 'dashboard') {
            renderDashboardTimeline();
        } else if (currentSidebarTab === 'deals') {
            renderDealsSidebar();
        } else if (currentSidebarTab === 'calls') {
            renderCallQueue();
            updateCallSessionInfo();
        } else {
            if(currentClientId) renderClientDetails(currentClientId);
            if(currentSidebarTab === 'clients') renderClientList();
            else renderGlobalTasks();
        }
        if (document.getElementById('headerSmartSearchInput')?.value) {
            renderHeaderSmartSearch();
        }
    }

    function getWeekStartIso(baseDate) {
        const d = new Date(baseDate);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay(); // 0=Sun
        const diffToMonday = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diffToMonday);
        return toIsoLocal(d);
    }

    function shiftDashboardWeek(days) {
        const start = parseIsoLocal(dashboardWeekStart);
        start.setDate(start.getDate() + days);
        dashboardWeekStart = toIsoLocal(start);
        renderDashboardTimeline();
    }

    function resetDashboardWeek() {
        dashboardWeekStart = getWeekStartIso(new Date());
        dashboardSelectedDate = getTodayIsoLocal();
        renderDashboardTimeline();
    }

    function formatWeekRangeLabel(startIso, endIso) {
        return `${formatDateRu(startIso)} - ${formatDateRu(endIso)}`;
    }


    function ensureSidebarDashboardDayListDelegation() {
        const list = document.getElementById('sidebarDashboardDayList');
        if (!list || list.dataset.delegated === '1') return;
        list.dataset.delegated = '1';
        list.addEventListener('click', (e) => {
            const item = e.target.closest('.dashboard-side-item');
            if (!item || !list.contains(item)) return;
            const taskId = String(item.dataset.taskId || '');
            if (!taskId) return;
            const actionBtn = e.target.closest('[data-dashboard-day-action]');
            if (actionBtn && item.contains(actionBtn)) {
                const action = String(actionBtn.dataset.dashboardDayAction || '');
                if (action === 'edit') return editHistoryItem(taskId);
            }
            openTaskView(taskId);
        });
    }

    function renderSidebarDashboardDayList(selectedIso, tasksByDate) {
        const title = document.getElementById('sidebarDashboardDayTitle');
        const list = document.getElementById('sidebarDashboardDayList');
        if (!title || !list) return;

        ensureSidebarDashboardDayListDelegation();
        title.textContent = `Задачи на ${formatDateRu(selectedIso)}`;
        const tasks = tasksByDate.get(selectedIso) || [];
        list.replaceChildren();
        if (!tasks.length) {
            const empty = document.createElement('div');
            empty.className = 'dashboard-side-empty';
            empty.textContent = 'Нет задач на выбранный день';
            list.appendChild(empty);
            return;
        }

        tasks.forEach(t => {
            const client = clients.find(c => String(c.id) === String(t.clientId));
            const contactPerson = getTaskContactPersonLabel(t, client);
            const state = getTaskTimeState(t);
            const workflow = getTaskWorkflowStatusMeta(t);
            const item = document.createElement('div');
            item.className = `dashboard-side-item ${state === 'overdue' ? 'overdue' : (state === 'today' ? 'today' : 'future')}`;
            item.dataset.taskId = String(t.id || '');

            const head = document.createElement('div');
            head.style.cssText = 'display:flex; justify-content:space-between; gap:6px; margin-bottom:4px;';
            const headStrong = document.createElement('strong');
            headStrong.title = `Статус: ${workflow.label}`;
            headStrong.textContent = `${workflow.icon} ${t.nextTime || '--:--'} ${client ? client.name : 'Удаленный клиент'}`;
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'task-action-btn edit';
            editBtn.style.cssText = 'padding:2px 6px;';
            editBtn.dataset.dashboardDayAction = 'edit';
            editBtn.textContent = '✏️';
            head.appendChild(headStrong);
            head.appendChild(editBtn);

            const step = document.createElement('div');
            step.textContent = t.nextStep || '-';

            item.appendChild(head);
            if (contactPerson) {
                const contact = document.createElement('div');
                contact.className = 'dashboard-side-contact';
                contact.textContent = `👤 ${contactPerson}`;
                item.appendChild(contact);
            }
            item.appendChild(step);
            list.appendChild(item);
        });
    }

    function renderDashboardTimeline() {
        const grid = document.getElementById('timelineGrid');
        const label = document.getElementById('timelineWeekLabel');
        if (!grid || !label) return;
        if (!dashboardWeekStart) dashboardWeekStart = getWeekStartIso(new Date());

        ensureTimelineDelegation();
        const startDate = parseIsoLocal(dashboardWeekStart);
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            days.push(d);
        }
        const weekStartIso = toIsoLocal(days[0]);
        const weekEndIso = toIsoLocal(days[6]);
        label.textContent = formatWeekRangeLabel(weekStartIso, weekEndIso);
        const todayIso = getTodayIsoLocal();
        if (!dashboardSelectedDate) {
            dashboardSelectedDate = (todayIso >= weekStartIso && todayIso <= weekEndIso) ? todayIso : weekStartIso;
        } else if (dashboardSelectedDate < weekStartIso || dashboardSelectedDate > weekEndIso) {
            dashboardSelectedDate = weekStartIso;
        }

        const weekDayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const activeTasks = history
            .filter(h => isActiveTask(h) && h.nextDate && h.nextDate >= weekStartIso && h.nextDate <= weekEndIso)
            .sort((a,b) => (a.nextDate || '').localeCompare(b.nextDate || '') || (a.nextTime || '').localeCompare(b.nextTime || ''));

        const tasksByDate = new Map();
        activeTasks.forEach(t => {
            const key = t.nextDate;
            if (!tasksByDate.has(key)) tasksByDate.set(key, []);
            tasksByDate.get(key).push(t);
        });

        grid.replaceChildren();
        days.forEach((d, idx) => {
            const iso = toIsoLocal(d);
            const col = document.createElement('div');
            col.className = `timeline-col ${iso === todayIso ? 'today-current' : ''}`;
            col.dataset.date = iso;
            const titleEl = document.createElement('div');
            titleEl.className = `timeline-col-title clickable ${dashboardSelectedDate === iso ? 'selected' : ''} ${iso === todayIso ? 'today-current' : ''}`;
            titleEl.dataset.date = iso;
            titleEl.textContent = `${weekDayNames[idx]} ${formatDateRu(iso)}`;
            const list = document.createElement('div');
            list.className = 'timeline-list';
            list.dataset.date = iso;
            col.appendChild(titleEl);
            col.appendChild(list);
            const tasks = tasksByDate.get(iso) || [];
            if (!tasks.length) {
                const empty = document.createElement('div');
                empty.className = 'timeline-empty';
                empty.textContent = 'Нет задач';
                list.appendChild(empty);
            } else {
                tasks.forEach(t => {
                    const client = clients.find(c => String(c.id) === String(t.clientId));
                    const contactPerson = getTaskContactPersonLabel(t, client);
                    const workflow = getTaskWorkflowStatusMeta(t);
                    const createdLabel = getTaskCreatedDateLabel(t);
                    const card = document.createElement('div');
                    const state = getTaskTimeState(t);
                    card.className = `timeline-task ${state === 'overdue' ? 'overdue' : (state === 'today' ? 'today' : 'future')}`;
                    card.draggable = true;
                    card.dataset.taskId = String(t.id);
                    const head = document.createElement('div');
                    head.className = 'timeline-task-head';
                    const titleLine = document.createElement('div');
                    titleLine.className = 'timeline-task-titleline';
                    titleLine.title = `Статус: ${workflow.label}`;
                    const timeSpan = document.createElement('span');
                    timeSpan.className = 'time';
                    timeSpan.textContent = t.nextTime || '--:--';
                    titleLine.appendChild(timeSpan);
                    titleLine.appendChild(document.createTextNode(`${workflow.icon} ${client ? client.name : 'Удаленный клиент'}`));
                    head.appendChild(titleLine);
                    const summary = document.createElement('div');
                    summary.className = 'timeline-task-summary';
                    summary.textContent = t.nextStep || '-';
                    const contactLine = document.createElement('div');
                    contactLine.className = 'timeline-task-contact';
                    if (contactPerson) contactLine.textContent = `👤 ${contactPerson}`;
                    const tooltip = document.createElement('div');
                    tooltip.className = 'timeline-tooltip';
                    const tooltipTitle = document.createElement('div');
                    tooltipTitle.className = 'timeline-tooltip-title';
                    tooltipTitle.textContent = client ? client.name : 'Удаленный клиент';
                    tooltip.appendChild(tooltipTitle);
                    const buildTooltipLine = (labelText, valueText) => {
                        const line = document.createElement('div');
                        const strong = document.createElement('strong');
                        strong.textContent = `${labelText}:`;
                        line.appendChild(strong);
                        line.appendChild(document.createTextNode(` ${valueText}`));
                        return line;
                    };
                    const tooltipDate = buildTooltipLine('Дата', formatDateTimeRu(t.nextDate, t.nextTime));
                    const tooltipStatus = buildTooltipLine('Статус', `${workflow.icon} ${workflow.label}`);
                    const tooltipType = buildTooltipLine('Тип', t.type || '-');
                    const tooltipTask = buildTooltipLine('Задача', t.nextStep || '-');
                    const tooltipCreated = buildTooltipLine('Создана', createdLabel.replace(/^Создана\s+/, '') || '-');
                    const tooltipContact = buildTooltipLine('Контакт', contactPerson || '-');
                    const tooltipPrev = buildTooltipLine('Итог прошлого', getPreviousContactResult(t) || '-');
                    tooltip.appendChild(tooltipDate);
                    tooltip.appendChild(tooltipStatus);
                    tooltip.appendChild(tooltipType);
                    tooltip.appendChild(tooltipTask);
                    tooltip.appendChild(tooltipCreated);
                    tooltip.appendChild(tooltipContact);
                    tooltip.appendChild(tooltipPrev);
                    card.appendChild(head);
                    card.appendChild(summary);
                    if (contactPerson) card.appendChild(contactLine);
                    card.appendChild(tooltip);
                    list.appendChild(card);
                });
            }
            grid.appendChild(col);
        });
        renderSidebarDashboardDayList(dashboardSelectedDate, tasksByDate);
    }

    function ensureTimelineDelegation() {
        const grid = document.getElementById('timelineGrid');
        if (!grid || grid.dataset.delegated === '1') return;
        grid.dataset.delegated = '1';
        grid.addEventListener('click', (e) => {
            const title = e.target.closest('.timeline-col-title');
            if (title && grid.contains(title)) {
                const date = String(title.dataset.date || '');
                if (date) {
                    dashboardSelectedDate = date;
                    renderDashboardTimeline();
                }
                return;
            }
            const card = e.target.closest('.timeline-task');
            if (!card || !grid.contains(card)) return;
            if (card.classList.contains('dragging')) return;
            if (document.body.classList.contains('timeline-drag-active')) return;
            const taskId = String(card.dataset.taskId || '');
            if (taskId) openTaskView(taskId);
        });
        grid.addEventListener('dragstart', (e) => {
            const card = e.target.closest('.timeline-task');
            if (!card || !grid.contains(card)) return;
            onTimelineTaskDragStart(e);
        });
        grid.addEventListener('dragend', (e) => {
            const card = e.target.closest('.timeline-task');
            if ((!card || !grid.contains(card)) && !document.body.classList.contains('timeline-drag-active')) return;
            onTimelineTaskDragEnd(e);
        });
        grid.addEventListener('dragover', onTimelineListDragOver);
        grid.addEventListener('dragleave', onTimelineListDragLeave);
        grid.addEventListener('drop', onTimelineListDrop);
    }

    function clearTimelineDropTimePreview() {
        timelineDragTimePreview = { date: '', time: '' };
        timelineDragDropState.date = '';
        timelineDragDropState.time = '';
        document.querySelectorAll('.timeline-drop-time-preview').forEach(el => el.remove());
        document.querySelectorAll('.timeline-col.drag-hover').forEach(el => el.classList.remove('drag-hover'));
    }

    function getTimelineDropTimeFromPointer(listEl, clientY) {
        if (!listEl) return '';
        const rect = listEl.getBoundingClientRect();
        const top = rect.top + 4;
        const bottom = rect.bottom - 4;
        const usable = Math.max(1, bottom - top);
        const y = Math.max(top, Math.min(bottom, clientY));
        const ratio = Math.max(0, Math.min(1, (y - top) / usable));

        // Working day range: 08:00..20:00 in 15-minute steps.
        const startMinutes = 8 * 60;
        const endMinutes = 20 * 60;
        const totalMinutes = endMinutes - startMinutes;
        let minutes = startMinutes + Math.round((ratio * totalMinutes) / 15) * 15;
        minutes = Math.max(startMinutes, Math.min(endMinutes, minutes));
        const hh = Math.floor(minutes / 60);
        const mm = minutes % 60;
        return `${pad2(hh)}:${pad2(mm)}`;
    }

    function getTimelineDropMarkerTop(listEl, timeHHMM) {
        if (!listEl || !timeHHMM) return 8;
        const [hh, mm] = String(timeHHMM).split(':').map(v => parseInt(v, 10) || 0);
        const minutes = hh * 60 + mm;
        const startMinutes = 8 * 60;
        const endMinutes = 20 * 60;
        const clamped = Math.max(startMinutes, Math.min(endMinutes, minutes));
        const ratio = (clamped - startMinutes) / Math.max(1, (endMinutes - startMinutes));
        const h = Math.max(40, listEl.clientHeight);
        return Math.round(6 + ratio * Math.max(24, h - 12));
    }

    function renderTimelineDropTimePreview(colEl, dateIso, timeHHMM) {
        if (!colEl) return;
        clearTimelineDropTimePreview();
        const listEl = colEl.querySelector('.timeline-list');
        if (!listEl) return;
        const marker = document.createElement('div');
        marker.className = 'timeline-drop-time-preview';
        marker.dataset.time = timeHHMM || '--:--';
        marker.style.top = `${getTimelineDropMarkerTop(listEl, timeHHMM)}px`;
        listEl.appendChild(marker);
        colEl.classList.add('drag-hover');
        timelineDragTimePreview = { date: String(dateIso || ''), time: String(timeHHMM || '') };
    }

    function onTimelineTaskDragStart(e) {
        const card = e.target?.closest?.('.timeline-task') || e.currentTarget?.closest?.('.timeline-task') || e.currentTarget;
        const taskId = card?.dataset?.taskId;
        if (!taskId) return;
        e.dataTransfer.setData('text/plain', taskId);
        card.classList.add('dragging');
        document.body.classList.add('timeline-drag-active');
        timelineDragDropState = { taskId: String(taskId), date: '', time: '' };
    }

    function onTimelineTaskDragEnd(e) {
        const card = e.target?.closest?.('.timeline-task') || e.currentTarget?.closest?.('.timeline-task') || e.currentTarget;
        if (card && card.classList) card.classList.remove('dragging');
        document.body.classList.remove('timeline-drag-active');
        document.querySelectorAll('.timeline-col.drop-target').forEach(el => el.classList.remove('drop-target'));
        document.querySelectorAll('.timeline-list.drop-target').forEach(el => el.classList.remove('drop-target'));
        // Let drop handler read the preview marker first (browser event order may vary).
        setTimeout(() => clearTimelineDropTimePreview(), 60);
    }

    function onTimelineListDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        const col = e.target.closest('.timeline-col');
        const list = e.target.closest('.timeline-list') || (col ? col.querySelector('.timeline-list') : null);
        if (col) col.classList.add('drop-target');
        if (list) list.classList.add('drop-target');
        const targetDate = col?.dataset?.date || list?.dataset?.date || '';
        if (targetDate && list) {
            const previewTime = getTimelineDropTimeFromPointer(list, e.clientY);
            timelineDragDropState.date = String(targetDate);
            timelineDragDropState.time = String(previewTime || '');
            renderTimelineDropTimePreview(col, targetDate, previewTime);
        }
    }

    function onTimelineListDragLeave(e) {
        e.stopPropagation();
        const col = e.target.closest('.timeline-col');
        if (!col) return;
        const related = e.relatedTarget;
        if (related && col.contains(related)) return;
        col.classList.remove('drop-target');
        const list = col.querySelector('.timeline-list');
        if (list) list.classList.remove('drop-target');
    }

    function onTimelineListDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        // Defensive cleanup: in some browsers dragend may not fire on card after drop rerender.
        document.body.classList.remove('timeline-drag-active');
        document.querySelectorAll('.timeline-task.dragging').forEach(el => el.classList.remove('dragging'));
        const targetDate = e.target.closest('[data-date]')?.dataset?.date || e.currentTarget?.dataset?.date;
        const taskId = e.dataTransfer.getData('text/plain');
        const col = e.target.closest('.timeline-col') || (e.currentTarget && e.currentTarget.closest ? e.currentTarget.closest('.timeline-col') : null) || e.currentTarget;
        if (col && col.classList) col.classList.remove('drop-target');
        const list = col && col.querySelector ? col.querySelector('.timeline-list') : null;
        if (list) list.classList.remove('drop-target');
        if (!targetDate || !taskId) return;
        const idx = history.findIndex(h => String(h.id) === String(taskId));
        if (idx === -1) return;
        const markerTime = col?.querySelector?.('.timeline-drop-time-preview')?.dataset?.time || '';
        const stateTime = (String(timelineDragDropState.taskId) === String(taskId) && String(timelineDragDropState.date) === String(targetDate))
            ? String(timelineDragDropState.time || '')
            : '';
        let previewTime = markerTime || stateTime || ((timelineDragTimePreview.date === String(targetDate)) ? timelineDragTimePreview.time : '') || getTimelineDropTimeFromPointer(list, e.clientY);
        if (!/^\d{2}:\d{2}$/.test(String(previewTime || ''))) previewTime = '';
        history[idx].nextDate = targetDate;
        if (previewTime) history[idx].nextTime = previewTime;
        history[idx].date = targetDate;
        if (previewTime) history[idx].time = previewTime;
        history[idx].modifiedAt = Date.now();
        clearTimelineDropTimePreview();
        saveData();
        renderDashboardTimeline();
    }

    function normalizeAllPhones() {
        const cPhone = document.getElementById('cPhone');
        if (cPhone) cPhone.value = formatPhoneValue(cPhone.value);

        document.querySelectorAll('.contact-phone').forEach(inp => {
            inp.value = formatPhoneValue(inp.value);
        });
    }

    function syncClientPhoneFromModalContacts() {
        const input = document.getElementById('cPhone');
        if (!input) return;
        const autoPhone = getMainClientPhoneFromContacts(modalContacts);
        if (autoPhone) input.value = autoPhone;
        else if ((modalContacts || []).length === 1) input.value = '';
    }





    function checkTaskReminders() {
        const now = new Date();
        const nowTs = now.getTime();
        const prevCheckTs = Number.isFinite(lastReminderCheckTs) ? lastReminderCheckTs : nowTs;
        const active = history.filter(isActiveTask);
        const activeKeys = new Set();
        let shouldPlay = false;
        const dueNowTasks = [];

        active.forEach(task => {
            const due = getTaskDueMoment(task);
            if (!due) return;
            const dueTs = due.getTime();
            const key = `${task.id}|${task.nextDate || ''}|${task.nextTime || ''}`;
            activeKeys.add(key);
            const dueKey = `${key}|due`;
            const delta = dueTs - nowTs;

            // Напоминание "время наступило"
            if (delta <= 0 && !remindedTaskKeys.has(dueKey)) {
                remindedTaskKeys.add(dueKey);
                dueNowTasks.push(task);
                // Дедлайн пересекся между предыдущей и текущей проверкой.
                if (dueTs > prevCheckTs && dueTs <= nowTs) shouldPlay = true;
            }
        });

        // Keep reminder memory only for currently active tasks.
        remindedTaskKeys = new Set(
            [...remindedTaskKeys].filter(k => {
                const baseKey = k.replace(/\|due$/,'');
                return activeKeys.has(baseKey);
            })
        );

        lastReminderCheckTs = nowTs;
        if (shouldPlay && soundEnabled) playNotification();
        if (dueNowTasks.length) showDueTasksPopup(dueNowTasks);
    }

    function ensureDueTasksModalDelegation() {
        const list = document.getElementById('dueTasksModalList');
        if (!list || list.dataset.delegated === '1') return;
        list.dataset.delegated = '1';
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-due-task-action]');
            if (!btn || !list.contains(btn)) return;
            const action = String(btn.dataset.dueTaskAction || '');
            const taskId = String(btn.dataset.taskId || '');
            if (!action || !taskId) return;
            if (action === 'shift-30') return shiftTaskDueByMinutes(taskId, 30);
            if (action === 'shift-60') return shiftTaskDueByMinutes(taskId, 60);
            if (action === 'tomorrow') return shiftTaskDueToTomorrow(taskId);
            if (action === 'reschedule') return openRescheduleTaskModal(taskId);
            if (action === 'open') return openDueTaskFromPopup(taskId);
        });
    }

    function showDueTasksPopup(tasks) {
        const list = document.getElementById('dueTasksModalList');
        if (!list) return;
        ensureDueTasksModalDelegation();
        list.replaceChildren();
        const sortedTasks = (Array.isArray(tasks) ? tasks.slice() : [])
            .filter(Boolean)
            .sort((a, b) => {
                const ad = getTaskDueMoment(a)?.getTime() || 0;
                const bd = getTaskDueMoment(b)?.getTime() || 0;
                return ad - bd; // oldest/earliest first
            });

        if (!sortedTasks.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:14px; text-align:center; color:#777;';
            empty.textContent = 'Нет просроченных задач';
            list.appendChild(empty);
            document.getElementById('dueTasksModal').classList.remove('hidden');
            return;
        }

        sortedTasks.forEach(task => {
            const client = clients.find(c => String(c.id) === String(task.clientId));
            const item = document.createElement('div');
            item.className = 'stats-modal-item overdue';
            const taskId = String(task.id || '');

            const head = document.createElement('div');
            head.className = 'stats-modal-item-head';
            const headDate = document.createElement('strong');
            headDate.textContent = formatDateTimeRu(task.nextDate, task.nextTime);
            const headStatus = document.createElement('span');
            headStatus.textContent = 'Срок наступил';
            head.appendChild(headDate);
            head.appendChild(headStatus);

            const clientName = document.createElement('div');
            clientName.style.cssText = 'font-weight:600; margin-bottom:3px;';
            clientName.textContent = client ? client.name : 'Удаленный контрагент';

            const step = document.createElement('div');
            step.style.cssText = 'font-size:0.9rem; color:#444;';
            step.textContent = task.nextStep || '-';

            const actions = document.createElement('div');
            actions.className = 'stats-modal-actions';
            const actionDefs = [
                ['shift-30', '+30 мин'],
                ['shift-60', '+1 час'],
                ['tomorrow', 'На завтра'],
                ['reschedule', 'Перенести'],
                ['open', 'Открыть']
            ];
            actionDefs.forEach(([action, label]) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'task-action-btn edit';
                btn.dataset.dueTaskAction = action;
                btn.dataset.taskId = taskId;
                btn.textContent = label;
                actions.appendChild(btn);
            });

            item.appendChild(head);
            item.appendChild(clientName);
            item.appendChild(step);
            item.appendChild(actions);
            list.appendChild(item);
        });
        document.getElementById('dueTasksModal').classList.remove('hidden');
    }

    function getCurrentDueTasksForPopup() {
        const now = new Date();
        return history
            .filter(h => isActiveTask(h))
            .filter(h => {
                const due = getTaskDueMoment(h);
                return due && due.getTime() <= now.getTime();
            })
            .sort((a, b) => {
                const ad = getTaskDueMoment(a)?.getTime() || 0;
                const bd = getTaskDueMoment(b)?.getTime() || 0;
                return ad - bd;
            });
    }

    function refreshDueTasksPopupList() {
        if (document.getElementById('dueTasksModal')?.classList.contains('hidden')) return;
        showDueTasksPopup(getCurrentDueTasksForPopup());
    }

    function openDueTaskFromPopup(taskId) {
        closeModal('dueTasksModal');
        openTaskView(taskId);
    }

    function postponeTaskWithTemp(taskId, targetDateTime, reason = '', eventType = 'POSTPONE') {
        const idx = history.findIndex(h => String(h.id) === String(taskId));
        if (idx === -1) return false;
        const task = history[idx];
        refreshWorkItemTempState(task);
        const target = targetDateTime instanceof Date ? targetDateTime : new Date(targetDateTime);
        if (isNaN(target.getTime())) return false;
        const oldDueTs = new Date(String(task.due_at || buildTaskDueIso(task) || '')).getTime();
        if (Number.isFinite(oldDueTs) && target.getTime() > oldDueTs) {
            applyPostpone(task, target.toISOString(), reason, new Date(), eventType);
        } else {
            setTaskDueDateTime(task, target);
            syncWorkItemDueAt(task);
        }
        task.status = 'active';
        task.modifiedAt = Date.now();
        return true;
    }

    function applyTaskProgressEvent(taskId, progressType, comment = '') {
        const idx = history.findIndex(h => String(h.id) === String(taskId));
        if (idx === -1) return { applied: false };
        const task = history[idx];
        refreshWorkItemTempState(task);
        const result = applyProgress(task, progressType, comment, new Date());
        task.modifiedAt = Date.now();
        if (result?.applied) saveData();
        return result || { applied: false };
    }

    function openRescheduleTaskModal(taskId) {
        const task = history.find(h => String(h.id) === String(taskId));
        if (!task) return;
        document.getElementById('rsTaskId').value = task.id;
        document.getElementById('rsEventType').value = 'POSTPONE';
        document.getElementById('rsReason').value = 'Ручной перенос срока';
        const titleEl = document.getElementById('rescheduleTaskModalTitle');
        if (titleEl) titleEl.textContent = 'Перенести срок задачи';
        document.getElementById('rsDate').value = task.nextDate || getTodayIsoLocal();
        document.getElementById('rsTime').value = task.nextTime || getNowTimeLocalHHMM();
        showModalOnTop('rescheduleTaskModal');
    }

    function configureRescheduleTaskModal(taskId, eventType = 'POSTPONE', reason = 'Ручной перенос срока', title = 'Перенести срок задачи') {
        openRescheduleTaskModal(taskId);
        const eventTypeInput = document.getElementById('rsEventType');
        const reasonInput = document.getElementById('rsReason');
        const titleEl = document.getElementById('rescheduleTaskModalTitle');
        if (eventTypeInput) eventTypeInput.value = String(eventType || 'POSTPONE');
        if (reasonInput) reasonInput.value = String(reason || '');
        if (titleEl) titleEl.textContent = String(title || 'Перенести срок задачи');
    }

    function saveRescheduledTask() {
        const id = document.getElementById('rsTaskId').value;
        const date = document.getElementById('rsDate').value;
        const time = document.getElementById('rsTime').value;
        const eventType = String(document.getElementById('rsEventType')?.value || 'POSTPONE').trim() || 'POSTPONE';
        const reason = String(document.getElementById('rsReason')?.value || 'Ручной перенос срока').trim() || 'Ручной перенос срока';
        if (!id || !date) return alert('Укажите дату выполнения');
        const dt = new Date(`${date}T${time || '00:00'}`);
        if (isNaN(dt.getTime())) return alert('Некорректная дата/время');
        if (!postponeTaskWithTemp(id, dt, reason, eventType)) return;
        saveData();
        closeModal('rescheduleTaskModal');
        closeModal('dueTasksModal');
        if (!document.getElementById('taskViewModal')?.classList.contains('hidden')) openTaskView(id);
    }



    function shiftTaskDueByMinutes(taskId, minutes) {
        const dt = new Date();
        dt.setSeconds(0, 0);
        dt.setMinutes(dt.getMinutes() + minutes);
        if (!postponeTaskWithTemp(taskId, dt, `Быстрый перенос +${minutes} мин`)) return;
        saveData();
        refreshDueTasksPopupList();
    }

    function shiftTaskDueToTomorrow(taskId) {
        const task = history.find(h => String(h.id) === String(taskId));
        if (!task) return;
        const dt = getTaskDueDateTime(task);
        dt.setDate(dt.getDate() + 1);
        if (!postponeTaskWithTemp(taskId, dt, 'Быстрый перенос на завтра')) return;
        saveData();
        refreshDueTasksPopupList();
    }

    async function ensureNotificationAudioContext() {
        if (!notificationAudioCtx) {
            notificationAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (notificationAudioCtx.state === 'suspended') {
            try { await notificationAudioCtx.resume(); } catch(e) {}
        }
        return notificationAudioCtx;
    }


    function ensureHistoryIdsUnique(records) {
        const used = new Set();
        return records.map(item => {
            const clone = { ...item };
            let id = String(clone.id || '').trim();
            if (!id || used.has(id)) {
                id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            }
            clone.id = id;
            used.add(id);
            return clone;
        });
    }



    function getHistoryRecordActivityTs(record) {
        const fromModified = toSafeActivityTs(record?.modifiedAt);
        if (fromModified) return fromModified;

        const fromCompletedAt = toSafeActivityTs(new Date(String(record?.completedAt || '')).getTime());
        if (fromCompletedAt) return fromCompletedAt;

        const fromCompletedDate = parseTaskDateTimeToTs(record?.completedDate || '', record?.completedTime || '00:00');
        if (fromCompletedDate) return fromCompletedDate;

        const fromMainDate = parseTaskDateTimeToTs(record?.date || '', record?.time || '00:00');
        if (fromMainDate) return fromMainDate;

        const fromNextDate = parseTaskDateTimeToTs(record?.nextDate || '', record?.nextTime || '00:00');
        if (fromNextDate) return fromNextDate;

        return toSafeActivityTs(new Date().getTime());
    }

    function ensureTaskCreatedAt(record) {
        if (!record || typeof record !== 'object') return '';
        const rawCreatedAt = String(record.created_at || '').trim();
        if (rawCreatedAt) return rawCreatedAt;

        const completedAt = String(record.completedAt || '').trim();
        if (completedAt) {
            record.created_at = completedAt;
            return record.created_at;
        }

        const mainDate = String(record.date || '').trim();
        const mainTime = String(record.time || '').trim();
        if (mainDate) {
            record.created_at = `${mainDate}T${mainTime || '00:00'}`;
            return record.created_at;
        }

        const nextDate = String(record.nextDate || '').trim();
        const nextTime = String(record.nextTime || '').trim();
        if (nextDate) {
            record.created_at = `${nextDate}T${nextTime || '00:00'}`;
            return record.created_at;
        }

        const modifiedTs = toSafeActivityTs(record.modifiedAt);
        if (modifiedTs) {
            record.created_at = new Date(modifiedTs).toISOString();
            return record.created_at;
        }

        record.created_at = new Date().toISOString();
        return record.created_at;
    }

    function getTaskCreatedDateLabel(task) {
        const createdAt = ensureTaskCreatedAt(task);
        const createdDate = getDateOnlyFromIso(createdAt) || String(createdAt || '').split('T')[0] || '';
        if (!createdDate) return '';
        return `Создана ${formatDateRu(createdDate)}`;
    }

    function getClientLatestTaskCreatedAt(clientId) {
        const key = String(clientId || '');
        const touchedTs = toSafeActivityTs(clientTaskTouchedAt[key]);
        if (touchedTs > 0) return touchedTs;
        const client = clients.find(c => String(c.id) === key);
        const clientUpdated = toSafeActivityTs(client?.updatedAt);
        if (clientUpdated > 0) return clientUpdated;
        const clientTasks = history.filter(h => String(h.clientId) === key);
        if (!clientTasks.length) return 0;
        return clientTasks.reduce((maxValue, t) => {
            const modifiedTs = getHistoryRecordActivityTs(t);
            if (modifiedTs > maxValue) return modifiedTs;
            return maxValue;
        }, 0);
    }

    function touchClientActivity(clientId, whenTs = Date.now()) {
        const key = String(clientId || '');
        const ts = toSafeActivityTs(whenTs) || Date.now();
        if (!key) return;
        clientTaskTouchedAt[key] = ts;
    }

    function touchClientTaskActivity(clientId, whenTs = Date.now()) {
        touchClientActivity(clientId, whenTs);
    }

    function rebuildClientLastContactCache() {
        const nextMap = {};
        history.forEach(h => {
            if (h.taskStatus !== 'done') return;
            const key = String(h.clientId || '');
            if (!key) return;
            const ts = getHistoryRecordActivityTs(h);
            if (!ts) return;
            if (!nextMap[key] || ts > nextMap[key]) nextMap[key] = ts;
        });
        clientLastContactAt = nextMap;
    }

    function setClientLastContact(clientId, whenTs = Date.now()) {
        const key = String(clientId || '');
        const ts = toSafeActivityTs(whenTs) || Date.now();
        if (!key) return;
        const prev = toSafeActivityTs(clientLastContactAt[key]);
        if (!prev || ts >= prev) clientLastContactAt[key] = ts;
    }

    function getClientLastContactTs(clientId) {
        const key = String(clientId || '');
        const cached = toSafeActivityTs(clientLastContactAt[key]);
        if (cached) return cached;
        const fallback = history
            .filter(h => String(h.clientId) === key && h.taskStatus === 'done')
            .map(h => getHistoryRecordActivityTs(h))
            .filter(Boolean)
            .sort((a, b) => b - a)[0] || 0;
        if (fallback) clientLastContactAt[key] = fallback;
        return fallback;
    }

    function getDaysSinceTs(ts) {
        const safeTs = toSafeActivityTs(ts);
        if (!safeTs) return Number.POSITIVE_INFINITY;
        const dayMs = 24 * 60 * 60 * 1000;
        return Math.floor((Date.now() - safeTs) / dayMs);
    }

    function markClientCalledToday(clientId, whenTs = Date.now()) {
        const key = String(clientId || '');
        if (!key) return;
        const d = new Date(whenTs);
        const dayKey = toIsoLocal(d);
        if (!callSessionLog[dayKey] || typeof callSessionLog[dayKey] !== 'object') callSessionLog[dayKey] = {};
        callSessionLog[dayKey][key] = toSafeActivityTs(whenTs) || Date.now();
    }

    function wasClientCalledToday(clientId) {
        const key = String(clientId || '');
        const dayKey = getTodayIsoLocal();
        const ts = toSafeActivityTs(callSessionLog?.[dayKey]?.[key]);
        return Boolean(ts);
    }

    function pruneCallSessionLog(days = 45) {
        const keepFrom = new Date();
        keepFrom.setDate(keepFrom.getDate() - Math.max(1, parseInt(days, 10) || 45));
        const keepFromKey = toIsoLocal(keepFrom);
        const next = {};
        Object.entries(callSessionLog || {}).forEach(([dayKey, map]) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dayKey))) return;
            if (String(dayKey) < keepFromKey) return;
            if (!map || typeof map !== 'object') return;
            const row = {};
            Object.entries(map).forEach(([cid, ts]) => {
                const safeTs = toSafeActivityTs(ts);
                if (safeTs) row[String(cid)] = safeTs;
            });
            if (Object.keys(row).length) next[String(dayKey)] = row;
        });
        callSessionLog = next;
    }

    function getClientPrimaryContact(client) {
        const contacts = (Array.isArray(client?.contacts) ? client.contacts : []).map((c, idx) => normalizeContact(c, idx));
        if (!contacts.length) return null;
        const selected = contacts.find(c => c.isPrimaryForClient) || contacts.find(c => getContactPreferredPhone(c)) || contacts[0];
        return {
            name: selected.name || '',
            role: selected.role || '',
            phone: getContactPreferredPhone(selected) || ''
        };
    }

    function formatContactPersonLabel(contact) {
        const name = String(contact?.name || '').trim();
        const role = String(contact?.role || '').trim();
        if (!name && !role) return '';
        if (name && role) return `${name} (${role})`;
        return name || role;
    }

    function getTaskContactPersonLabel(task, client = null) {
        const taskClient = client || clients.find(c => String(c.id) === String(task?.clientId));
        if (!taskClient) return '';
        const contacts = (Array.isArray(taskClient.contacts) ? taskClient.contacts : []).map((c, idx) => normalizeContact(c, idx));
        if (!contacts.length) return '';

        const selectedContactId = String(task?.contactPersonId || '').trim();
        if (selectedContactId) {
            const selectedContact = contacts.find(c => String(c.id || '') === selectedContactId);
            if (selectedContact) return formatContactPersonLabel(selectedContact);
        }

        return formatContactPersonLabel(getClientPrimaryContact(taskClient));
    }

    function getClientBestPhone(client) {
        const fromContacts = getMainClientPhoneFromContacts(client?.contacts || []);
        return String(fromContacts || client?.phone || '').trim();
    }

    function getClientLatestDoneRecord(clientId) {
        return history
            .filter(h => String(h.clientId) === String(clientId) && h.taskStatus === 'done')
            .sort((a, b) => getHistoryRecordActivityTs(b) - getHistoryRecordActivityTs(a))[0] || null;
    }

    function getClientEarliestActiveTask(clientId) {
        return history
            .filter(h => String(h.clientId) === String(clientId) && isActiveTask(h))
            .sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || '') || (a.nextTime || '').localeCompare(b.nextTime || ''))[0] || null;
    }

    function getCallQueueTypeScore(typeValue) {
        const t = String(typeValue || '').trim().toLowerCase();
        if (t === 'монтажник') return 10;
        if (t === 'перекуп') return 8;
        if (t === 'частник' || t === 'для собственных нужд') return 2;
        if (t === 'не указан') return -5;
        return 0;
    }

    function getCallQueueClassScore(classValue) {
        const normalized = normalizeClientClass(classValue);
        if (normalized === 'A') return 30;
        if (normalized === 'B') return 15;
        if (normalized === 'C') return 5;
        return 0;
    }

    function buildCallQueueCandidates() {
        const classFilter = document.getElementById('cqClassFilter')?.value || 'all';
        const typeFilter = document.getElementById('cqTypeFilter')?.value || 'all';
        const statusFilter = document.getElementById('cqStatusFilter')?.value || 'all';
        const urgencyFilter = document.getElementById('cqUrgencyFilter')?.value || 'all';
        const noActiveOnly = document.getElementById('cqNoActiveOnly')?.checked || false;
        const minNoTouch = Math.max(1, parseInt(document.getElementById('cqMinNoTouch')?.value, 10) || 21);
        const now = new Date();

        const result = [];
        clients.forEach(client => {
            if (String(client.status || '').trim().toLowerCase() === 'архив') return;
            const cls = normalizeClientClass(client.class);
            const type = normalizeClientType(client.type) || 'Не указан';
            const status = String(client.status || '').trim() || 'Новый';
            if (classFilter !== 'all' && cls !== classFilter) return;
            if (typeFilter !== 'all' && type !== typeFilter) return;
            if (statusFilter !== 'all' && status !== statusFilter) return;

            const activeTasks = history.filter(h => String(h.clientId) === String(client.id) && isActiveTask(h));
            if (noActiveOnly && activeTasks.length) return;
            const bestTask = getClientEarliestActiveTask(client.id);
            if (bestTask) {
                refreshWorkItemTempState(bestTask, now);
                const frozenUntil = String(bestTask.next_contact_at || '').trim();
                if (String(bestTask.status || '').trim() === 'frozen' && frozenUntil) {
                    const frozenUntilTs = new Date(frozenUntil).getTime();
                    if (Number.isFinite(frozenUntilTs) && frozenUntilTs > now.getTime()) return;
                }
            }
            const taskState = bestTask ? getTaskTimeState(bestTask, now) : 'nodate';
            const bestTaskTemp = bestTask ? clamp(bestTask.temp ?? 0, 0, 100) : 0;
            const bestTaskTempReason = bestTask ? getTempReason(bestTask, now) : '';
            const lastContactTs = getClientLastContactTs(client.id);
            const touchedTs = toSafeActivityTs(clientTaskTouchedAt[String(client.id)]);
            const effectiveTouchTs = touchedTs || lastContactTs || toSafeActivityTs(client.updatedAt);
            const noTouchDays = getDaysSinceTs(effectiveTouchTs);
            const calledToday = wasClientCalledToday(client.id);
            const statusNorm = String(status).trim().toLowerCase();

            let score = 0;
            const reasons = [];
            let sourcePriority = 999;
            let sourceCode = '';

            if (bestTask && (taskState === 'overdue' || taskState === 'today' || taskState === 'future')) {
                if (taskState === 'overdue') {
                    score += 100;
                    const overdueDays = Math.max(1, Math.abs(getTaskDaysDiff(bestTask)));
                    reasons.push(`Просрочено ${overdueDays} дн.`);
                } else if (taskState === 'today') {
                    score += 70;
                    reasons.push(`Сегодня${bestTask.nextTime ? ` ${bestTask.nextTime}` : ''}`);
                } else {
                    score += 10;
                    reasons.push(`Запланировано ${formatDateTimeRu(bestTask.nextDate, bestTask.nextTime)}`);
                }
                sourcePriority = Math.min(sourcePriority, 1);
                sourceCode = sourceCode || 'a';
            }

            if (!activeTasks.length && Number.isFinite(noTouchDays) && noTouchDays >= minNoTouch) {
                score += 40;
                reasons.push(`Без касаний ${noTouchDays} дн.`);
                sourcePriority = Math.min(sourcePriority, 2);
                if (!sourceCode) sourceCode = 'b';
            }

            const hasNoActiveAndWarmStatus = !activeTasks.length && (statusNorm === 'новый' || statusNorm === 'в работе');
            if (hasNoActiveAndWarmStatus) {
                score += 20;
                reasons.push('Нет понятного следующего шага');
                sourcePriority = Math.min(sourcePriority, 3);
                if (!sourceCode) sourceCode = 'c';
            }
            if (statusNorm === 'в работе' && Number.isFinite(noTouchDays) && noTouchDays >= minNoTouch) {
                score += 15;
                reasons.push(`В работе, контакт давно (${noTouchDays} дн.)`);
                sourcePriority = Math.min(sourcePriority, 3);
                if (!sourceCode) sourceCode = 'c';
            }

            if (sourcePriority === 999) return;
            if (urgencyFilter !== 'all' && sourceCode !== urgencyFilter) return;

            score += getCallQueueClassScore(cls);
            score += getCallQueueTypeScore(type);
            if (bestTaskTemp > 70) {
                score += 60 + Math.round(bestTaskTemp / 5);
                reasons.unshift(`Красная зона · Temp ${bestTaskTemp}`);
            } else if (bestTaskTemp > 45) {
                score += 20 + Math.round(bestTaskTemp / 10);
                reasons.push(`Temp ${bestTaskTemp}`);
            } else if (bestTaskTemp > 0) {
                score += Math.round(bestTaskTemp / 12);
            }

            if (calledToday) score -= 50;
            if (bestTask && getTaskTimeState(bestTask, now) === 'future' && getTaskDaysDiff(bestTask) > 7) score -= 15;

            const latestDone = getClientLatestDoneRecord(client.id);
            result.push({
                clientId: String(client.id),
                score,
                reasons,
                sourceCode,
                sourcePriority,
                bestTask,
                temp: bestTaskTemp,
                tempReason: bestTaskTempReason,
                redZone: bestTaskTemp > 70,
                lastDoneResult: latestDone ? String(latestDone.result || latestDone.desc || '').trim() : '',
                nextStep: bestTask ? String(bestTask.nextStep || '').trim() : '',
                noTouchDays: Number.isFinite(noTouchDays) ? noTouchDays : null
            });
        });

        return result.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.sourcePriority !== b.sourcePriority) return a.sourcePriority - b.sourcePriority;
            const aTask = a.bestTask;
            const bTask = b.bestTask;
            const byDate = String(aTask?.nextDate || '').localeCompare(String(bTask?.nextDate || ''));
            if (byDate !== 0) return byDate;
            return String(aTask?.nextTime || '').localeCompare(String(bTask?.nextTime || ''));
        });
    }

    function renderCallQueue() {
        const nextCard = document.getElementById('callQueueNextCard');
        const list = document.getElementById('callQueueList');
        const badge = document.getElementById('callQueueCountBadge');
        if (!nextCard || !list || !badge) return;
        ensureCallQueueDelegation();

        callQueueCurrentCandidates = buildCallQueueCandidates();
        badge.innerText = String(callQueueCurrentCandidates.length);

        if (!callQueueCurrentCandidates.length) {
            callQueueSelectedClientId = '';
            nextCard.replaceChildren();
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:10px; color:#6b7b8f; font-size:0.82rem;';
            empty.textContent = 'Очередь пуста по текущим фильтрам';
            nextCard.appendChild(empty);
            list.replaceChildren();
            updateCallSessionInfo();
            return;
        }

        const hasSelected = callQueueCurrentCandidates.some(c => String(c.clientId) === String(callQueueSelectedClientId));
        if (!hasSelected) callQueueSelectedClientId = String(callQueueCurrentCandidates[0].clientId);
        const selected = callQueueCurrentCandidates.find(c => String(c.clientId) === String(callQueueSelectedClientId)) || callQueueCurrentCandidates[0];
        const client = clients.find(c => String(c.id) === String(selected.clientId));
        const phone = client ? getClientBestPhone(client) : '';
        const phoneDigits = String(phone || '').replace(/[^\d+]/g, '');
        const contact = client ? getClientPrimaryContact(client) : null;
        const classValue = client ? normalizeClientClass(client.class) : 'Не указан';
        const typeValue = client ? (normalizeClientType(client.type) || 'Не указан') : 'Не указан';
        const statusValue = client ? (client.status || '-') : '-';
        const sourceLabel = selected.sourceCode === 'a' ? 'Срочные задачи' : (selected.sourceCode === 'b' ? 'Без касаний' : 'Разогрев');

        nextCard.replaceChildren();
        const nextWrap = document.createElement('div');
        nextWrap.className = 'call-next-card';

        const title = document.createElement('div');
        title.className = 'call-next-title';
        title.textContent = client ? (client.name || 'Без имени') : 'Удаленный клиент';
        nextWrap.appendChild(title);

        const sub = document.createElement('div');
        sub.className = 'call-next-sub';
        sub.textContent = `[Класс ${classValue} | ${typeValue} | ${statusValue}] · ${sourceLabel} · Score ${selected.score}`;
        nextWrap.appendChild(sub);

        if (selected.bestTask) {
            const tempRow = document.createElement('div');
            tempRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin:6px 0 8px;';
            tempRow.appendChild(createTempBadgeElement(selected.bestTask, new Date()));
            tempRow.appendChild(createTempScaleElement(selected.bestTask, new Date(), true));
            nextWrap.appendChild(tempRow);
            const tempReason = document.createElement('div');
            tempReason.className = 'call-next-line';
            tempReason.style.marginTop = '-2px';
            tempReason.textContent = `Температура: ${selected.tempReason || '—'}`;
            nextWrap.appendChild(tempReason);
        }

        const lineWhy = document.createElement('div');
        lineWhy.className = 'call-next-line';
        const lineWhyStrong = document.createElement('strong');
        lineWhyStrong.textContent = 'Почему здесь:';
        lineWhy.appendChild(lineWhyStrong);
        lineWhy.appendChild(document.createTextNode(` ${selected.reasons[0] || 'Приоритет по скорингу'}`));
        nextWrap.appendChild(lineWhy);

        const lineContact = document.createElement('div');
        lineContact.className = 'call-next-line';
        const lineContactStrong = document.createElement('strong');
        lineContactStrong.textContent = 'Контакт:';
        lineContact.appendChild(lineContactStrong);
        const contactText = contact
            ? `${contact.name || 'Контакт без имени'}${contact.role ? ` (${contact.role})` : ''}`
            : '—';
        lineContact.appendChild(document.createTextNode(` ${contactText}`));
        if (phone) lineContact.appendChild(document.createTextNode(` · ${phone}`));
        nextWrap.appendChild(lineContact);

        const lineLast = document.createElement('div');
        lineLast.className = 'call-next-line';
        const lineLastStrong = document.createElement('strong');
        lineLastStrong.textContent = 'Последний итог:';
        lineLast.appendChild(lineLastStrong);
        lineLast.appendChild(document.createTextNode(` ${selected.lastDoneResult || 'нет'}`));
        nextWrap.appendChild(lineLast);

        const lineNext = document.createElement('div');
        lineNext.className = 'call-next-line';
        const lineNextStrong = document.createElement('strong');
        lineNextStrong.textContent = 'Следующее действие:';
        lineNext.appendChild(lineNextStrong);
        lineNext.appendChild(document.createTextNode(` ${selected.nextStep || 'нет - придумай сейчас'}`));
        nextWrap.appendChild(lineNext);

        const actions = document.createElement('div');
        actions.className = 'call-actions';
        const btnDial = document.createElement('button');
        btnDial.className = 'btn-success btn-sm';
        btnDial.dataset.cqAction = 'dial';
        btnDial.type = 'button';
        btnDial.textContent = '📞 Позвонить';
        if (!phoneDigits) btnDial.disabled = true;
        const btnCopy = document.createElement('button');
        btnCopy.className = 'btn-primary btn-sm';
        btnCopy.dataset.cqAction = 'copy';
        btnCopy.dataset.phone = String(phone || '');
        btnCopy.type = 'button';
        btnCopy.textContent = '📋 Копировать';
        if (!phone) btnCopy.disabled = true;
        const btnOpen = document.createElement('button');
        btnOpen.className = 'btn-warning btn-sm';
        btnOpen.dataset.cqAction = 'open-client';
        btnOpen.dataset.clientId = String(selected.clientId || '');
        btnOpen.type = 'button';
        btnOpen.textContent = 'Открыть карточку';
        const btnNext = document.createElement('button');
        btnNext.className = 'btn-primary btn-sm';
        btnNext.dataset.cqAction = 'next';
        btnNext.type = 'button';
        btnNext.textContent = '➡️ Следующий';
        actions.appendChild(btnDial);
        actions.appendChild(btnCopy);
        actions.appendChild(btnOpen);
        actions.appendChild(btnNext);
        nextWrap.appendChild(actions);

        const templates = document.createElement('div');
        templates.className = 'call-template-buttons';
        ['Не в работе', 'Перезвонить', 'Ждет расчет', 'Заказал', 'Отказ'].forEach(labelText => {
            const b = document.createElement('button');
            b.dataset.cqAction = 'quick';
            b.dataset.result = labelText;
            b.type = 'button';
            b.textContent = labelText;
            templates.appendChild(b);
        });
        nextWrap.appendChild(templates);

        const scheduleRow = document.createElement('div');
        scheduleRow.style.cssText = 'margin-top:8px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;';
        const timeInput = document.createElement('input');
        timeInput.id = 'cqNextTimeInput';
        timeInput.type = 'time';
        timeInput.value = getNowTimeLocalHHMM();
        timeInput.style.cssText = 'width:95px; padding:5px;';
        scheduleRow.appendChild(timeInput);
        [
            { label: 'Сегодня', days: 0 },
            { label: 'Завтра', days: 1 },
            { label: '+ Неделя', days: 7 }
        ].forEach(cfg => {
            const b = document.createElement('button');
            b.className = 'btn-primary btn-sm';
            b.dataset.cqAction = 'schedule';
            b.dataset.days = String(cfg.days);
            b.type = 'button';
            b.textContent = cfg.label;
            scheduleRow.appendChild(b);
        });
        nextWrap.appendChild(scheduleRow);
        nextCard.appendChild(nextWrap);

        list.replaceChildren();
        let redZoneHeaderShown = false;
        callQueueCurrentCandidates.slice(0, 30).forEach((row, index) => {
            const rowClient = clients.find(c => String(c.id) === String(row.clientId));
            if (!rowClient) return;
            if (row.redZone && !redZoneHeaderShown) {
                redZoneHeaderShown = true;
                const zone = document.createElement('div');
                zone.style.cssText = 'font-size:0.74rem; font-weight:700; color:#a61b12; background:#fff0ee; border:1px solid #f5c3be; border-radius:6px; padding:5px 8px;';
                zone.textContent = 'Красная зона (высокая температура откладывания)';
                list.appendChild(zone);
            }
            const item = document.createElement('div');
            item.className = `call-queue-item ${String(row.clientId) === String(callQueueSelectedClientId) ? 'active' : ''}`;
            item.dataset.clientId = String(row.clientId || '');
            const rowHead = document.createElement('div');
            rowHead.style.cssText = 'display:flex; justify-content:space-between; gap:6px;';
            const strong = document.createElement('strong');
            strong.textContent = `${index + 1}. ${rowClient.name || 'Без имени'}`;
            const scoreSpan = document.createElement('span');
            scoreSpan.textContent = `Score ${row.score}`;
            rowHead.appendChild(strong);
            rowHead.appendChild(scoreSpan);
            const reason = document.createElement('div');
            reason.style.cssText = 'color:#5c6f83; margin-top:2px;';
            reason.textContent = row.reasons[0] || '-';
            if (row.bestTask) {
                const tempMeta = document.createElement('div');
                tempMeta.style.cssText = 'display:flex; align-items:center; gap:6px; margin-top:4px;';
                tempMeta.appendChild(createTempBadgeElement(row.bestTask, new Date()));
                tempMeta.appendChild(createTempScaleElement(row.bestTask, new Date(), true));
                item.appendChild(rowHead);
                item.appendChild(reason);
                item.appendChild(tempMeta);
                list.appendChild(item);
                return;
            }
            item.appendChild(rowHead);
            item.appendChild(reason);
            list.appendChild(item);
        });
        updateCallSessionInfo();
    }

    function ensureCallQueueDelegation() {
        const nextCard = document.getElementById('callQueueNextCard');
        const list = document.getElementById('callQueueList');
        if (nextCard && nextCard.dataset.delegated !== '1') {
            nextCard.dataset.delegated = '1';
            nextCard.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-cq-action]');
                if (!btn || !nextCard.contains(btn)) return;
                const action = String(btn.dataset.cqAction || '');
                if (!action) return;
                if (action === 'dial') return callQueueDialSelected();
                if (action === 'copy') return callQueueCopyPhone(String(btn.dataset.phone || ''));
                if (action === 'open-client') return callQueueOpenClient(String(btn.dataset.clientId || ''));
                if (action === 'next') return callQueueNextClient();
                if (action === 'quick') return callQueueQuickResult(String(btn.dataset.result || ''));
                if (action === 'schedule') {
                    const days = parseInt(btn.dataset.days, 10) || 0;
                    return callQueueScheduleNext(days);
                }
            });
        }
        if (list && list.dataset.delegated !== '1') {
            list.dataset.delegated = '1';
            list.addEventListener('click', (e) => {
                const item = e.target.closest('.call-queue-item');
                if (!item || !list.contains(item)) return;
                const clientId = String(item.dataset.clientId || '');
                if (!clientId) return;
                callQueueSelectedClientId = clientId;
                renderCallQueue();
            });
        }
    }

    function refreshWorkItemTempState(task, now = new Date()) {
        if (!task || typeof task !== 'object') return task;
        ensureWorkItemTempFields(task, now);
        recalcStagnation(task, now);
        return task;
    }

    function refreshAllWorkItemsTempState(now = new Date()) {
        (Array.isArray(history) ? history : []).forEach(item => refreshWorkItemTempState(item, now));
    }

    function createTempBadgeElement(task, now = new Date()) {
        const item = refreshWorkItemTempState(task, now);
        const temp = clamp(item?.temp ?? 0, 0, 100);
        const badge = document.createElement('span');
        badge.className = 'temp-badge';
        badge.style.borderColor = getTempColor(temp);
        badge.style.color = getTempColor(temp);
        badge.textContent = `Temp ${temp}`;
        badge.title = getTempReason(item, now);
        return badge;
    }

    function createTempScaleElement(task, now = new Date(), compact = false) {
        const item = refreshWorkItemTempState(task, now);
        const temp = clamp(item?.temp ?? 0, 0, 100);
        const wrap = document.createElement('div');
        wrap.className = compact ? 'temp-scale compact' : 'temp-scale';
        if (temp === 100) wrap.classList.add('temp-max');
        wrap.setAttribute('aria-label', `Температура ${temp} из 100`);

        const track = document.createElement('div');
        track.className = 'temp-scale-track';
        const fill = document.createElement('div');
        fill.className = 'temp-scale-fill';
        fill.style.width = `${temp}%`;
        fill.style.background = getTempGradientColor(temp);
        const thumb = document.createElement('div');
        thumb.className = 'temp-scale-thumb';
        thumb.style.left = `calc(${temp}% - 7px)`;
        thumb.style.borderColor = getTempGradientColor(temp);

        const label = document.createElement('div');
        label.className = 'temp-scale-label';
        label.textContent = getTempReason(item, now);

        track.appendChild(fill);
        track.appendChild(thumb);
        wrap.appendChild(track);
        if (!compact) wrap.appendChild(label);
        return wrap;
    }

    function getTaskEventTypeLabel(type) {
        const labels = {
            POSTPONE: 'Перенос',
            CALL_NO_ANSWER: 'Не дозвонился',
            TALKED_NO_PROGRESS: 'Поговорил без шага',
            TALKED: 'Поговорил',
            INFO_RECEIVED: 'Получил инфо',
            CALC_DONE: 'Сделал расчет',
            QUOTE_SENT: 'Отправил КП',
            INVOICE_SENT: 'Отправил счет',
            PROMISE_PAY_SET: 'Обещание оплаты',
            PAYMENT_PART: 'Частичная оплата',
            PAYMENT_FULL: 'Полная оплата',
            DECISION_MADE: 'Решение принято'
        };
        return labels[String(type || '').trim()] || String(type || 'Событие');
    }

    function syncTaskViewProgressButtonsSelection(selectedType = '') {
        document.querySelectorAll('#tvProgressPanel [data-action="taskViewAddProgressEvent"]').forEach(btn => {
            const isSelected = String(btn.dataset.progressType || '') === String(selectedType || '');
            btn.classList.toggle('active', isSelected);
            btn.style.borderColor = isSelected ? '#2f6adf' : '';
            btn.style.boxShadow = isSelected ? '0 0 0 2px rgba(47,106,223,0.2) inset' : '';
        });
    }

    function setTaskViewProgressDraftMode(enabled, progressType = '') {
        const taskId = document.getElementById('tvTaskId')?.value;
        const task = history.find(h => String(h.id) === String(taskId));
        const descView = document.getElementById('tvDesc');
        const descEdit = document.getElementById('tvDescEdit');
        const draftBar = document.getElementById('tvProgressDraftBar');
        const typeLabel = document.getElementById('tvProgressDraftTypeLabel');
        if (!descView || !descEdit || !draftBar || !typeLabel) return;

        if (!enabled) {
            taskViewPendingProgressType = '';
            descView.classList.remove('hidden');
            descEdit.classList.add('hidden');
            draftBar.classList.add('hidden');
            descEdit.value = '';
            typeLabel.textContent = '-';
            syncTaskViewProgressButtonsSelection('');
            return;
        }

        taskViewPendingProgressType = String(progressType || '').trim();
        const currentText = task ? String(task.nextStep || task.desc || '').trim() : '';
        descEdit.value = currentText;
        descView.classList.add('hidden');
        descEdit.classList.remove('hidden');
        draftBar.classList.remove('hidden');
        typeLabel.textContent = getTaskEventTypeLabel(taskViewPendingProgressType);
        syncTaskViewProgressButtonsSelection(taskViewPendingProgressType);
        setTimeout(() => {
            try {
                descEdit.focus();
                descEdit.setSelectionRange(descEdit.value.length, descEdit.value.length);
            } catch (e) {}
        }, 0);
    }

    function createTaskEventChip(type) {
        const chip = document.createElement('span');
        chip.className = 'task-event-chip';
        chip.textContent = getTaskEventTypeLabel(type);
        return chip;
    }

    function renderTaskViewHeat(task) {
        const box = document.getElementById('tvTempBox');
        const badgeWrap = document.getElementById('tvTempBadgeWrap');
        const reason = document.getElementById('tvTempReason');
        const eventsList = document.getElementById('tvEventsList');
        if (!box || !badgeWrap || !reason || !eventsList || !task) return;
        const now = new Date();
        const item = refreshWorkItemTempState(task, now);
        const isDone = String(item.taskStatus || '') === 'done';
        box.replaceChildren();
        box.appendChild(createTempScaleElement(item, now, false));
        badgeWrap.replaceChildren();
        badgeWrap.appendChild(createTempBadgeElement(item, now));
        reason.textContent = getTempReason(item, now);
        document.querySelectorAll('#tvHeatPanel [data-action="taskViewPostponeQuick"], #tvHeatPanel [data-action="taskViewAddProgressEvent"], #tvHeatPanel [data-action="toggleTaskViewProgressPanel"], #tvHeatPanel [data-action="taskViewOpenReschedule"], #tvHeatPanel [data-action="taskViewOpenNoAnswerReschedule"]')
            .forEach(btn => { btn.disabled = isDone; });

        eventsList.replaceChildren();
        const events = Array.isArray(item.events) ? item.events.slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))) : [];
        if (!events.length) {
            const empty = document.createElement('div');
            empty.className = 'task-events-empty';
            empty.textContent = 'Событий температуры пока нет';
            eventsList.appendChild(empty);
            return;
        }
        events.slice(0, 8).forEach(evt => {
            const row = document.createElement('div');
            row.className = 'task-event-row';
            const head = document.createElement('div');
            head.className = 'task-event-row-head';
            head.appendChild(createTaskEventChip(String(evt.type || 'UNKNOWN')));
            const at = document.createElement('span');
            const dt = new Date(String(evt.at || ''));
            at.textContent = Number.isNaN(dt.getTime()) ? String(evt.at || '') : dt.toLocaleString('ru-RU');
            head.appendChild(at);
            row.appendChild(head);

            const metaText = [];
            if (evt.type === 'POSTPONE' || evt.type === 'CALL_NO_ANSWER') {
                if (evt.meta?.weight) metaText.push(`+${evt.meta.weight}`);
                if (evt.meta?.old_due_at || evt.meta?.new_due_at) {
                    metaText.push(`срок: ${evt.meta.old_due_at ? new Date(evt.meta.old_due_at).toLocaleString('ru-RU') : '—'} -> ${evt.meta.new_due_at ? new Date(evt.meta.new_due_at).toLocaleString('ru-RU') : '—'}`);
                }
            }
            if (evt.comment) metaText.push(String(evt.comment));
            if (metaText.length) {
                const meta = document.createElement('div');
                meta.className = 'task-event-row-meta';
                meta.textContent = metaText.join(' | ');
                row.appendChild(meta);
            }
            eventsList.appendChild(row);
        });
    }

    function updateCallSessionInfo() {
        const block = document.getElementById('callSessionInfo');
        if (!block) return;
        const targetInput = document.getElementById('cqSessionTarget');
        const target = Math.max(1, parseInt(targetInput?.value, 10) || callSessionState.target || 10);
        if (!callSessionState.active) {
            block.innerText = `Сессия не запущена · план ${target} звонков`;
            return;
        }
        const left = Math.max(0, target - callSessionState.done);
        block.innerText = `Сделано ${callSessionState.done}/${target} · Осталось ${left}`;
    }

    function startCallSession() {
        const targetInput = document.getElementById('cqSessionTarget');
        callSessionState.active = true;
        callSessionState.target = Math.max(1, parseInt(targetInput?.value, 10) || 10);
        callSessionState.done = 0;
        updateCallSessionInfo();
    }

    function stopCallSession() {
        callSessionState.active = false;
        updateCallSessionInfo();
    }

    function callQueueDialSelected() {
        const selected = callQueueCurrentCandidates.find(c => String(c.clientId) === String(callQueueSelectedClientId));
        if (!selected) return;
        const client = clients.find(c => String(c.id) === String(selected.clientId));
        if (!client) return;
        const phone = getClientBestPhone(client);
        if (!phone) return alert('Нет телефона для звонка');
        markClientCalledToday(client.id, Date.now());
        saveData();
        window.location.href = `tel:${String(phone).replace(/[^\d+]/g, '')}`;
    }

    function callQueueCopyPhone(phone) {
        const value = String(phone || '').trim();
        if (!value) return alert('Телефон не найден');
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(value).then(() => alert('Номер скопирован')).catch(() => alert(value));
            return;
        }
        alert(value);
    }

    function callQueueOpenClient(clientId) {
        if (!clientId) return;
        selectClient(clientId);
    }

    function callQueueNextClient() {
        if (!callQueueCurrentCandidates.length) return;
        const idx = callQueueCurrentCandidates.findIndex(c => String(c.clientId) === String(callQueueSelectedClientId));
        const next = callQueueCurrentCandidates[(idx + 1) % callQueueCurrentCandidates.length];
        callQueueSelectedClientId = String(next.clientId);
        renderCallQueue();
    }

    function appendCallOutcome(clientId, resultText) {
        const now = new Date();
        const nowDate = getTodayIsoLocal();
        const nowTime = getNowTimeLocalHHMM();
        const touchedTs = now.getTime();
        const row = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            clientId: String(clientId),
            contactPersonId: '',
            created_at: now.toISOString(),
            date: nowDate,
            time: nowTime,
            type: 'Исходящий',
            result: String(resultText || '').trim(),
            desc: 'Контакт из очереди прозвона',
            nextDate: '',
            nextTime: '',
            nextStep: '',
            taskStatus: 'done',
            completedAt: now.toISOString(),
            completedDate: nowDate,
            completedTime: nowTime,
            modifiedAt: touchedTs
        };
        ensureWorkItemTempFields(row, now);
        row.status = 'won';
        applyEvent(row, {
            type: 'DECISION_MADE',
            at: now,
            meta: { status: 'won' },
            comment: 'Контакт из очереди прозвона завершен'
        });
        history.push(row);
        touchClientTaskActivity(clientId, touchedTs);
        setClientLastContact(clientId, touchedTs);
        markClientCalledToday(clientId, touchedTs);
    }

    function callQueueQuickResult(templateText) {
        const selected = callQueueCurrentCandidates.find(c => String(c.clientId) === String(callQueueSelectedClientId));
        if (!selected) return;
        const activeTask = getClientEarliestActiveTask(selected.clientId);
        if (activeTask) {
            markTaskDone(activeTask.id, templateText || '', true);
        } else {
            appendCallOutcome(selected.clientId, templateText || '');
            if (callSessionState.active) callSessionState.done += 1;
            saveData();
        }
        callQueueSelectedClientId = '';
        renderCallQueue();
    }

    function callQueueScheduleNext(daysOffset) {
        const selected = callQueueCurrentCandidates.find(c => String(c.clientId) === String(callQueueSelectedClientId));
        if (!selected) return;
        const now = new Date();
        now.setDate(now.getDate() + (parseInt(daysOffset, 10) || 0));
        const date = toIsoLocal(now);
        const time = document.getElementById('cqNextTimeInput')?.value || getNowTimeLocalHHMM();
        const touchedTs = Date.now();
        const row = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            clientId: String(selected.clientId),
            contactPersonId: '',
            created_at: new Date(touchedTs).toISOString(),
            date: date,
            time: time || '00:00',
            type: 'Исходящий',
            result: '',
            desc: 'Следующий контакт из очереди прозвона',
            nextDate: date,
            nextTime: time,
            nextStep: selected.nextStep || 'Контрольный звонок',
            taskStatus: 'work',
            completedAt: '',
            completedDate: '',
            completedTime: '',
            modifiedAt: touchedTs
        };
        ensureWorkItemTempFields(row, new Date(touchedTs));
        row.status = 'active';
        history.push(row);
        touchClientTaskActivity(selected.clientId, touchedTs);
        markClientCalledToday(selected.clientId, touchedTs);
        saveData();
        callQueueNextClient();
    }

    function renderClientTypeOptions() {
        const select = document.getElementById('cType');
        if (!select) return;
        const selectedValue = select.value;
        select.replaceChildren();
        clientTypeOptions.forEach(type => {
            const opt = document.createElement('option');
            opt.value = type;
            opt.textContent = type;
            select.appendChild(opt);
        });
        if (selectedValue && clientTypeOptions.includes(selectedValue)) {
            select.value = selectedValue;
        } else if (clientTypeOptions.length) {
            select.value = clientTypeOptions[0];
        }
    }

    function setClientTypesSelection(typeValue) {
        const select = document.getElementById('cType');
        if (!select) return;
        const value = normalizeClientType(typeValue);
        if (value && clientTypeOptions.includes(value)) select.value = value;
        else if (clientTypeOptions.length) select.value = clientTypeOptions[0];
    }

    function ensureClientTypesInOptions(typeValue) {
        const value = normalizeClientType(typeValue);
        if (!value) return;
        let changed = false;
        const exists = clientTypeOptions.some(x => x.toLowerCase() === value.toLowerCase());
        if (!exists) {
            clientTypeOptions.push(value);
            changed = true;
        }
        if (changed) {
            clientTypeOptions.sort((a,b) => a.localeCompare(b));
            renderClientTypeOptions();
        }
    }

    function getSelectedClientTypes() {
        const select = document.getElementById('cType');
        return select ? select.value : '';
    }

    function normalizeDealOptionList(list, fallback, required = []) {
        const source = Array.isArray(list) ? list : fallback;
        const normalized = [];
        source.forEach((item) => {
            const value = String(item || '').trim();
            if (!value) return;
            if (!normalized.some(existing => existing.toLowerCase() === value.toLowerCase())) normalized.push(value);
        });
        required.forEach((item) => {
            const value = String(item || '').trim();
            if (!value) return;
            if (!normalized.some(existing => existing.toLowerCase() === value.toLowerCase())) normalized.push(value);
        });
        return normalized.length ? normalized : [...fallback];
    }

    function syncDealFilterStateAfterOptionsChange() {
        if (currentDealStageFilter !== 'all' && !dealStageOptions.includes(currentDealStageFilter)) currentDealStageFilter = 'all';
        if (currentDealCategoryFilter !== 'all' && !dealCategoryOptions.includes(currentDealCategoryFilter)) currentDealCategoryFilter = 'all';
    }

    function renderSelectOptions(select, options, selectedValue = '', prefixOptions = []) {
        if (!select) return;
        const previous = String(selectedValue || select.value || '');
        select.replaceChildren();
        prefixOptions.forEach((item) => {
            const opt = document.createElement('option');
            opt.value = String(item.value || '');
            opt.textContent = String(item.label || item.value || '');
            select.appendChild(opt);
        });
        options.forEach((value) => {
            const opt = document.createElement('option');
            opt.value = String(value);
            opt.textContent = String(value);
            select.appendChild(opt);
        });
        if (previous && Array.from(select.options).some(opt => opt.value === previous)) {
            select.value = previous;
        } else if (prefixOptions.length) {
            select.value = String(prefixOptions[0].value || '');
        } else if (options.length) {
            select.value = String(options[0]);
        }
    }

    function normalizeTaskTopicTemplates(list) {
        if (!Array.isArray(list)) return [];
        const seen = new Set();
        return list
            .map(item => String(item || '').trim())
            .filter(Boolean)
            .filter((item) => {
                const key = item.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, 100);
    }

    function saveTaskTopicTemplates() {
        taskTopicTemplates = normalizeTaskTopicTemplates(taskTopicTemplates);
        CRMStore.setJSON('taskTopicTemplates', taskTopicTemplates);
        renderTaskTopicTemplateOptions();
    }

    function renderTaskTopicTemplateOptions(selectedValue = '') {
        const select = document.getElementById('taskTopicTemplateSelect');
        if (!select) return;
        const current = selectedValue || select.value || '';
        select.replaceChildren();
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = taskTopicTemplates.length ? 'Шаблоны темы' : 'Нет шаблонов';
        select.appendChild(empty);
        taskTopicTemplates.forEach((template) => {
            const opt = document.createElement('option');
            opt.value = template;
            opt.textContent = template.length > 70 ? `${template.slice(0, 67)}...` : template;
            select.appendChild(opt);
        });
        if (taskTopicTemplates.includes(current)) select.value = current;
    }

    function applyTaskTopicTemplate() {
        const select = document.getElementById('taskTopicTemplateSelect');
        const topic = document.getElementById('hTopic');
        if (!select || !topic) return;
        const template = String(select.value || '').trim();
        if (!template) return showToast('Выберите шаблон темы', 'warn');
        topic.value = template;
        topic.focus();
    }

    function addTaskTopicTemplate() {
        const topic = document.getElementById('hTopic');
        if (!topic) return;
        const template = String(topic.value || '').trim();
        if (!template) return showToast('Введите тему, чтобы сохранить её как шаблон', 'warn');
        const exists = taskTopicTemplates.some(item => item.toLowerCase() === template.toLowerCase());
        if (exists) {
            renderTaskTopicTemplateOptions(template);
            return showToast('Такой шаблон уже есть', 'warn');
        }
        taskTopicTemplates.unshift(template);
        saveTaskTopicTemplates();
        renderTaskTopicTemplateOptions(template);
        showToast('Шаблон темы добавлен', 'success');
    }

    function deleteTaskTopicTemplate() {
        const select = document.getElementById('taskTopicTemplateSelect');
        if (!select) return;
        const template = String(select.value || '').trim();
        if (!template) return showToast('Выберите шаблон для удаления', 'warn');
        if (!confirm('Удалить выбранный шаблон темы?')) return;
        taskTopicTemplates = taskTopicTemplates.filter(item => item !== template);
        saveTaskTopicTemplates();
        showToast('Шаблон темы удалён', 'success');
    }

    function renderDealStageInputOptions(selectedValue = '') {
        renderSelectOptions(document.getElementById('dealStageInput'), dealStageOptions, normalizeDealStage(selectedValue || document.getElementById('dealStageInput')?.value || 'Новый'));
    }

    function renderDealCategoryInputOptions(selectedValue = '') {
        renderSelectOptions(document.getElementById('dealCategoryInput'), dealCategoryOptions, normalizeDealCategory(selectedValue || document.getElementById('dealCategoryInput')?.value || 'Прочее'));
    }

    function renderDealStageFilterOptions(selectedValue = '') {
        renderSelectOptions(document.getElementById('dealStageFilter'), dealStageOptions, selectedValue || currentDealStageFilter, [{ value: 'all', label: 'Стадия: все' }]);
    }

    function renderDealCategoryFilterOptions(selectedValue = '') {
        renderSelectOptions(document.getElementById('dealCategoryFilter'), dealCategoryOptions, selectedValue || currentDealCategoryFilter, [{ value: 'all', label: 'Категория: все' }]);
    }

    function renderDealDetailStageOptions(selectedValue = '') {
        renderSelectOptions(document.getElementById('dealDetailStageInput'), dealStageOptions, normalizeDealStage(selectedValue || document.getElementById('dealDetailStageInput')?.value || 'Новый'));
    }

    function renderDealDetailCategoryOptions(selectedValue = '') {
        renderSelectOptions(document.getElementById('dealDetailCategoryInput'), dealCategoryOptions, normalizeDealCategory(selectedValue || document.getElementById('dealDetailCategoryInput')?.value || 'Прочее'));
    }

    function renderAllDealOptionControls() {
        syncDealFilterStateAfterOptionsChange();
        renderDealStageInputOptions();
        renderDealCategoryInputOptions();
        renderDealStageFilterOptions();
        renderDealCategoryFilterOptions();
        renderDealDetailStageOptions();
        renderDealDetailCategoryOptions();
    }

    function ensureDealStageInOptions(value, rerender = true) {
        const normalized = normalizeDealStage(value);
        if (!normalized) return false;
        if (dealStageOptions.some(item => item.toLowerCase() === normalized.toLowerCase())) return false;
        dealStageOptions.push(normalized);
        if (rerender) renderAllDealOptionControls();
        return true;
    }

    function ensureDealCategoryInOptions(value, rerender = true) {
        const normalized = normalizeDealCategory(value);
        if (!normalized) return false;
        if (dealCategoryOptions.some(item => item.toLowerCase() === normalized.toLowerCase())) return false;
        dealCategoryOptions.push(normalized);
        if (rerender) renderAllDealOptionControls();
        return true;
    }

    function getDealOptionUsageCount(kind, value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (!normalized) return 0;
        return deals.filter((deal) => {
            const current = kind === 'stage' ? normalizeDealStage(deal?.stage) : normalizeDealCategory(deal?.category);
            return String(current || '').trim().toLowerCase() === normalized;
        }).length;
    }

    function addDealOption(kind, value) {
        const changed = kind === 'stage'
            ? ensureDealStageInOptions(value, false)
            : ensureDealCategoryInOptions(value, false);
        if (!changed) return false;
        renderAllDealOptionControls();
        saveData();
        return true;
    }

    function removeDealOption(kind, value) {
        const normalized = kind === 'stage' ? normalizeDealStage(value) : normalizeDealCategory(value);
        const protectedValues = kind === 'stage' ? ['Закрыто'] : ['Прочее'];
        if (protectedValues.includes(normalized)) {
            showToast('Этот вариант нельзя удалить', 'warn');
            return false;
        }
        const usageCount = getDealOptionUsageCount(kind, normalized);
        if (usageCount > 0) {
            showToast(`Нельзя удалить: используется в ${usageCount} сделк.`, 'warn');
            return false;
        }
        const targetList = kind === 'stage' ? dealStageOptions : dealCategoryOptions;
        const idx = targetList.findIndex(item => item.toLowerCase() === normalized.toLowerCase());
        if (idx < 0) return false;
        targetList.splice(idx, 1);
        renderAllDealOptionControls();
        saveData();
        return true;
    }

    function manageDealOption(kind, mode, targetId) {
        const safeKind = kind === 'category' ? 'category' : 'stage';
        const safeMode = mode === 'remove' ? 'remove' : 'add';
        const select = document.getElementById(targetId);
        const label = safeKind === 'stage' ? 'стадию сделки' : 'тип материала';
        if (safeMode === 'add') {
            const rawValue = prompt(`Добавить ${label}:`, '');
            if (rawValue === null) return;
            const ok = addDealOption(safeKind, rawValue);
            if (!ok) return showToast('Такой вариант уже есть или поле пустое', 'warn');
            const nextValue = safeKind === 'stage' ? normalizeDealStage(rawValue) : normalizeDealCategory(rawValue);
            const refreshedSelect = document.getElementById(targetId);
            if (refreshedSelect) refreshedSelect.value = nextValue;
            return showToast('Вариант добавлен', 'success');
        }
        const selectedValue = String(select?.value || '').trim();
        if (!selectedValue) return showToast('Сначала выберите вариант', 'warn');
        if (!confirm(`Удалить вариант "${selectedValue}" из списка?`)) return;
        if (removeDealOption(safeKind, selectedValue)) showToast('Вариант удалён', 'success');
    }

    function persistStateToLocalStorage() {
        writeStateToLocalStorage();
        updateDatabaseFileSaveIndicator();
    }

    function updateDatabaseFileSaveIndicator() {
        const el = document.getElementById('dbFileSaveIndicator');
        const saveBtn = document.getElementById('saveDatabaseFileBtn');
        if (!el) return;
        const canBindFile = typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
        let text = 'Файл: не привязан';
        let bg = '#fff6d8';
        let color = '#5c4a14';
        let border = '#f0df9a';
        const hasUnsavedFileChanges = Boolean(dbFileHandle && dbDirty);

        if (dbFileHandle && dbDirty) {
            text = 'Файл: есть несохраненные (перенос: старый)';
            bg = '#fff0c2';
            color = '#7a5600';
            border = '#f2d37a';
        } else if (dbFileHandle) {
            const timeText = dbLastFileSaveAt
                ? new Date(dbLastFileSaveAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : 'сохранен';
            text = dbLastFileSaveAt ? `Файл: сохранено ${timeText}` : 'Файл: привязан';
            bg = '#eafaf0';
            color = '#1f6f43';
            border = '#bfe8cf';
        } else if (dbLastFileSaveAt && !dbDirty) {
            const timeText = new Date(dbLastFileSaveAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            text = `Файл: JSON сохранен ${timeText} (без привязки)`;
            bg = '#eef8ff';
            color = '#0f4f7a';
            border = '#cde4f8';
        } else if (dbDirty) {
            text = 'Файл: не привязан (перенос: нет JSON)';
            bg = '#fff0c2';
            color = '#7a5600';
            border = '#f2d37a';
        } else if (!canBindFile) {
            text = 'Файл: привязка недоступна (только JSON)';
            bg = '#fff0c2';
            color = '#7a5600';
            border = '#f2d37a';
        }

        el.textContent = text;
        el.style.background = bg;
        el.style.color = color;
        el.style.borderColor = border;
        el.title = 'Перенос на другой компьютер: копирование папки CRM не переносит localStorage. Для переноса нужен актуальный JSON-файл базы (кнопка "Сохранить файл").';
        if (saveBtn) {
            saveBtn.classList.toggle('has-unsaved-file', hasUnsavedFileChanges);
            saveBtn.title = hasUnsavedFileChanges
                ? 'Есть несохраненные изменения в привязанном файле базы'
                : (!canBindFile
                    ? 'Привязка файла недоступна в этом режиме. Будет скачан JSON без привязки.'
                    : 'Сохранить базу в файл');
        }
    }



    // --- NAVIGATION ---
    function switchSidebarTab(tab) {
        currentSidebarTab = tab;
        const dealView = document.getElementById('dealDetailsView');
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-btn-${tab}`).classList.add('active');
        
        document.querySelectorAll('.sidebar-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`sidebar-${tab}`).classList.add('active');
        document.getElementById('dashboardView').classList.toggle('hidden', tab !== 'dashboard');
        
        if(tab === 'dashboard') {
            document.getElementById('emptyState').classList.add('hidden');
            document.getElementById('clientDetails').classList.add('hidden');
            if (dealView) dealView.classList.add('hidden');
            renderDashboardTimeline();
        } else if(tab === 'tasks') {
            setTaskFilter('active');
            document.getElementById('emptyState').classList.add('hidden');
            document.getElementById('clientDetails').classList.add('hidden');
            if (dealView) dealView.classList.add('hidden');
            renderGlobalTasks();
        } else if (tab === 'deals') {
            document.getElementById('emptyState').classList.add('hidden');
            document.getElementById('clientDetails').classList.add('hidden');
            if (dealView) dealView.classList.remove('hidden');
            renderDealsSidebar();
        } else if (tab === 'calls') {
            document.getElementById('emptyState').classList.add('hidden');
            document.getElementById('clientDetails').classList.add('hidden');
            if (dealView) dealView.classList.add('hidden');
            renderCallQueue();
            updateCallSessionInfo();
        } else {
            if (dealView) dealView.classList.add('hidden');
            if(currentClientId) {
                document.getElementById('emptyState').classList.add('hidden');
                document.getElementById('clientDetails').classList.remove('hidden');
                renderClientList();
            } else {
                document.getElementById('emptyState').classList.remove('hidden');
                document.getElementById('clientDetails').classList.add('hidden');
                renderClientList();
            }
        }
    }

    function switchContentTab(tab, tabBtn) {
        currentContentTab = tab;
        document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
        const activeTabBtn = tabBtn || document.querySelector(`.content-tab[data-tab="${tab}"]`);
        if (activeTabBtn) activeTabBtn.classList.add('active');
        document.getElementById('tab-tasks-content').classList.toggle('hidden', tab !== 'tasks');
        document.getElementById('tab-deals-content').classList.toggle('hidden', tab !== 'deals');
        document.getElementById('tab-history-content').classList.toggle('hidden', tab !== 'history');
    }

    function updateClientContentTabCounts(clientId) {
        const taskCountEl = document.getElementById('clientTasksTabCount');
        const dealCountEl = document.getElementById('clientDealsTabCount');
        const historyCountEl = document.getElementById('clientHistoryTabCount');
        if (!taskCountEl || !dealCountEl || !historyCountEl) return;

        if (!clientId) {
            [taskCountEl, dealCountEl, historyCountEl].forEach((el) => {
                el.textContent = '';
                el.classList.add('hidden');
            });
            return;
        }

        const clientTasks = history.filter(h =>
            String(h.clientId) === String(clientId) &&
            h.nextStep &&
            h.nextStep.trim() !== ''
        );
        const activeTasksCount = clientTasks.filter(h => h.taskStatus === 'new' || h.taskStatus === 'work').length;
        const completedTasksCount = clientTasks.filter(h => h.taskStatus === 'done').length;

        const clientDeals = deals
            .map(d => ensureDealRecord(d))
            .filter(d => String(d.client_id) === String(clientId));
        const openDealsCount = clientDeals.filter(d => !isDealClosed(d)).length;
        const totalDealsCount = clientDeals.length;

        const counts = [
            { el: taskCountEl, text: `${activeTasksCount}/${clientTasks.length}` },
            { el: dealCountEl, text: `${openDealsCount}/${totalDealsCount}` },
            { el: historyCountEl, text: `${completedTasksCount}` }
        ];

        counts.forEach(({ el, text }) => {
            el.textContent = text;
            el.classList.remove('hidden');
            if (text === '0' || text === '0/0') {
                el.style.opacity = '0.72';
            } else {
                el.style.opacity = '1';
            }
        });

        taskCountEl.title = `Активные задачи / всего задач: ${activeTasksCount} / ${clientTasks.length}`;
        dealCountEl.title = `Открытые сделки / всего сделок: ${openDealsCount} / ${totalDealsCount}`;
        historyCountEl.title = `Выполнено задач: ${completedTasksCount}`;
    }

    function setDealTimingFilter(value) {
        const normalized = ['today', 'overdue', 'week', 'open', 'all'].includes(String(value || '')) ? String(value) : 'open';
        currentDealTimingFilter = normalized;
        const timingSelect = document.getElementById('dealTimingFilter');
        if (timingSelect) timingSelect.value = normalized;
        renderDealsSidebar();
    }

    // --- FILTER LOGIC ---
    function setTaskFilter(filter, btnElement) {
        currentTaskFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        const btn = btnElement || document.querySelector(`.filter-btn[data-filter="${filter}"]`);
        if (btn) btn.classList.add('active');
        renderGlobalTasks();
    }

    function setGlobalTaskStatusFilter(value) {
        currentGlobalTaskStatusFilter = ['all', 'new', 'work', 'done'].includes(value) ? value : 'all';
        renderGlobalTasks();
    }

    function setGlobalTaskDateFilter(value) {
        currentGlobalTaskDateFilter = /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
        renderGlobalTasks();
    }

    function setGlobalTaskSort(value) {
        currentGlobalTaskSort = ['due', 'temp_desc', 'temp_asc'].includes(String(value || '')) ? String(value) : 'due';
        renderGlobalTasks();
    }

    function clearGlobalTaskDateFilter() {
        currentGlobalTaskDateFilter = '';
        const input = document.getElementById('globalTaskDateFilter');
        if (input) input.value = '';
        const sortSelect = document.getElementById('globalTaskSort');
        if (sortSelect) sortSelect.value = 'due';
        currentGlobalTaskSort = 'due';
        renderGlobalTasks();
    }

    function openCreateDealPrompt() {
        openDealModal('');
    }

    function getDealTimeBucket(deal, now = new Date()) {
        const next = toIsoOrEmpty(deal?.next_touch_at);
        if (!next) return 'none';
        const nextDt = new Date(next);
        const nowDt = now instanceof Date ? now : new Date(now);
        const today = toIsoLocal(nowDt);
        const nextDay = toIsoLocal(nextDt);
        if (nextDay < today) return 'overdue';
        if (nextDay === today) return 'today';
        const weekEnd = new Date(nowDt);
        weekEnd.setDate(weekEnd.getDate() + 7);
        if (nextDt <= weekEnd) return 'week';
        return 'future';
    }

    function getTouchTypeLabel(type) {
        if (type === 'call') return 'Звонок';
        if (type === 'whatsapp') return 'WhatsApp';
        if (type === 'telegram') return 'Telegram';
        if (type === 'email') return 'Email';
        return 'Другое';
    }

    function getTouchResultLabel(result) {
        if (result === 'reached') return 'Дозвонился';
        if (result === 'no_answer') return 'Не ответил';
        if (result === 'rescheduled') return 'Перенесено';
        if (result === 'price_discussion') return 'Обсуждали цену';
        if (result === 'waiting') return 'Ожидание';
        if (result === 'won') return 'Выиграли';
        if (result === 'lost') return 'Клиент отказался';
        return 'Другое';
    }

    function getDealById(id) {
        return deals.find(d => String(d.id) === String(id)) || null;
    }

    function isDealClosed(deal) {
        const status = normalizeDealStatus(deal?.status);
        const stage = normalizeDealStage(deal?.stage);
        return status === 'won' || status === 'lost' || stage === 'Закрыто';
    }

    function getDealOutcomeInfo(deal) {
        const status = normalizeDealStatus(deal?.status);
        if (status === 'won') return { label: 'Выиграли', className: 'won' };
        if (status === 'lost') return { label: 'Клиент отказался', className: 'lost' };
        return { label: 'Закрыта: результат не указан', className: 'unknown' };
    }

    function createDealClosedChip(deal) {
        if (!isDealClosed(deal)) return null;
        const outcome = getDealOutcomeInfo(deal);
        const chip = document.createElement('div');
        chip.className = `deal-closed-chip ${outcome.className}`;
        chip.textContent = outcome.label;
        return chip;
    }

    function getTasksLinkedToDeal(deal) {
        if (!deal) return [];
        return history.filter(t =>
            String(t.deal_id || '') === String(deal.id) ||
            String(t.id || '') === String(deal.source_task_id || '')
        );
    }

    function getLatestLinkedTaskForDeal(deal) {
        const linked = getTasksLinkedToDeal(deal);
        if (!linked.length) return null;
        return linked
            .slice()
            .sort((a, b) => {
                const am = getTaskMoment(a);
                const bm = getTaskMoment(b);
                const at = am ? am.getTime() : 0;
                const bt = bm ? bm.getTime() : 0;
                return bt - at;
            })[0] || null;
    }

    function getLinkedDealForTask(task) {
        if (!task) return null;
        const directDealId = String(task.deal_id || '').trim();
        if (directDealId) {
            const direct = getDealById(directDealId);
            if (direct) return direct;
        }
        return deals.find(d => String(d.source_task_id || '') === String(task.id || '')) || null;
    }

    function createTaskDealBadge(task) {
        const linked = getLinkedDealForTask(task);
        if (!linked) return null;
        const badge = document.createElement('div');
        badge.style.cssText = 'display:inline-block; margin-top:4px; font-size:0.74rem; color:#1f4b8f; background:#eaf2ff; border:1px solid #cddfff; border-radius:999px; padding:2px 8px;';
        const importantPrefix = linked.is_important ? '❗ ' : '';
        const deliveryPrefix = linked.needs_delivery ? '🚚 ' : '';
        badge.textContent = `🏷 Сделка: ${importantPrefix}${deliveryPrefix}${String(linked.title || 'без названия')}`;
        return badge;
    }

    function getDealImportantPrefix(deal) {
        return deal && deal.is_important ? '❗ ' : '';
    }

    function getDealDeliveryPrefix(deal) {
        return deal && deal.needs_delivery ? '🚚 ' : '';
    }

    function createDealImportantBadge(deal) {
        if (!deal || !deal.is_important) return null;
        const badge = document.createElement('div');
        badge.className = 'deal-important-mark';
        badge.textContent = '❗ Важная';
        return badge;
    }

    function createDealDeliveryBadge(deal) {
        if (!deal || !deal.needs_delivery) return null;
        const badge = document.createElement('div');
        badge.className = 'deal-delivery-mark';
        badge.textContent = '🚚 Нужна доставка';
        return badge;
    }

    function openDealByIdInSidebar(dealId) {
        const safeDealId = String(dealId || '').trim();
        if (!safeDealId) return;
        currentDealTimingFilter = 'open';
        currentDealCategoryFilter = 'all';
        currentDealStageFilter = 'all';
        currentDealId = safeDealId;
        switchSidebarTab('deals');
        renderDealsSidebar();
    }

    function renderDealClientOptions() {
        const input = document.getElementById('dealClientSearch');
        const list = document.getElementById('dealClientOptions');
        if (!input || !list) return;
        const q = String(input.value || '').trim().toLowerCase();
        list.replaceChildren();
        clients
            .filter(c => !q || String(c.name || '').toLowerCase().includes(q))
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
            .slice(0, 50)
            .forEach((client) => {
                const opt = document.createElement('option');
                opt.value = String(client.name || '');
                opt.label = String(client.name || '');
                opt.dataset.clientId = String(client.id || '');
                list.appendChild(opt);
            });
    }

    function populateDealContactPersonSelect(clientId, selectedContactId = '') {
        const select = document.getElementById('dealContactPersonSelect');
        if (!select) return;
        const client = clients.find(c => String(c.id) === String(clientId));
        const contacts = client && Array.isArray(client.contacts)
            ? client.contacts.map((c, idx) => normalizeContact(c, idx)).filter(c => (c.name || '').trim() !== '')
            : [];
        select.replaceChildren();
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = contacts.length ? 'Не выбрано' : 'Нет контактов';
        select.appendChild(emptyOption);
        contacts.forEach(contact => {
            const opt = document.createElement('option');
            opt.value = String(contact.id || '');
            const role = String(contact.role || '').trim();
            const phone = getContactPreferredPhone(contact);
            opt.textContent = `${contact.name}${role ? ` (${role})` : ''}${phone ? ` — ${phone}` : ''}`;
            select.appendChild(opt);
        });
        select.value = String(selectedContactId || '');
    }

    function applyDealClientFromSearch() {
        const input = document.getElementById('dealClientSearch');
        const hidden = document.getElementById('dealClientId');
        const titleInput = document.getElementById('dealTitleInput');
        const contactSelect = document.getElementById('dealContactPersonSelect');
        if (!input || !hidden) return;
        const value = String(input.value || '').trim();
        const prevClientId = String(hidden.value || '').trim();
        const prevContactId = String(contactSelect?.value || '').trim();
        const matched = clients.find(c => String(c.name || '').trim().toLowerCase() === value.toLowerCase()) || null;
        hidden.value = matched ? String(matched.id || '') : '';
        const nextClientId = String(hidden.value || '').trim();
        populateDealContactPersonSelect(nextClientId, nextClientId && nextClientId === prevClientId ? prevContactId : '');
        if (matched && titleInput && !String(titleInput.value || '').trim()) {
            titleInput.value = `Сделка: ${matched.name}`;
        }
    }

    function openDealModal(dealId = '') {
        const modal = document.getElementById('dealModal');
        if (!modal) return;
        const deal = dealId ? getDealById(dealId) : null;
        const titleEl = document.getElementById('dealModalTitle');
        const idInput = document.getElementById('dealFormId');
        const clientSearch = document.getElementById('dealClientSearch');
        const clientIdInput = document.getElementById('dealClientId');
        const titleInput = document.getElementById('dealTitleInput');
        const amountInput = document.getElementById('dealAmountInput');
        const nextDateInput = document.getElementById('dealNextDateInput');
        const statusInput = document.getElementById('dealStatusInput');
        const stageInput = document.getElementById('dealStageInput');
        const categoryInput = document.getElementById('dealCategoryInput');
        const notesInput = document.getElementById('dealNotesInput');
        const importantInput = document.getElementById('dealImportantInput');
        const deliveryInput = document.getElementById('dealDeliveryInput');
        if (!titleEl || !idInput || !clientSearch || !clientIdInput || !titleInput || !amountInput || !nextDateInput || !statusInput || !stageInput || !categoryInput || !notesInput || !importantInput || !deliveryInput) return;

        renderDealClientOptions();
        renderDealStageInputOptions(deal ? deal.stage : 'Новый');
        renderDealCategoryInputOptions(deal ? deal.category : 'Прочее');
        const prefillClient = deal
            ? clients.find(c => String(c.id) === String(deal.client_id || '')) || null
            : (currentClientId ? clients.find(c => String(c.id) === String(currentClientId)) || null : null);
        titleEl.textContent = deal ? 'Редактирование сделки' : 'Новая сделка';
        idInput.value = deal ? String(deal.id || '') : '';
        clientIdInput.value = prefillClient ? String(prefillClient.id || '') : '';
        clientSearch.value = prefillClient ? String(prefillClient.name || '') : '';
        titleInput.value = deal ? String(deal.title || '') : (prefillClient ? `Сделка: ${prefillClient.name}` : '');
        amountInput.value = deal && Number(deal.amount || 0) > 0 ? String(deal.amount) : '';
        nextDateInput.value = deal ? getDateOnlyFromIso(deal.next_touch_at) : getDateOnlyFromIso(addDaysToIso(new Date().toISOString(), 2));
        statusInput.value = deal ? String(deal.status || 'active') : 'active';
        stageInput.value = deal ? normalizeDealStage(deal.stage || 'Новый') : 'Новый';
        categoryInput.value = deal ? normalizeDealCategory(deal.category || 'Прочее') : 'Прочее';
        notesInput.value = deal ? String(deal.notes || '') : '';
        importantInput.checked = Boolean(deal?.is_important);
        deliveryInput.checked = Boolean(deal?.needs_delivery);
        populateDealContactPersonSelect(clientIdInput.value, deal ? String(deal.contact_person_id || '') : '');
        modal.classList.remove('hidden');
    }

    function saveDealModal() {
        const dealId = String(document.getElementById('dealFormId')?.value || '').trim();
        const clientId = String(document.getElementById('dealClientId')?.value || '').trim();
        const title = String(document.getElementById('dealTitleInput')?.value || '').trim();
        const amountRaw = String(document.getElementById('dealAmountInput')?.value || '').trim().replace(',', '.');
        const nextDateRaw = String(document.getElementById('dealNextDateInput')?.value || '').trim();
        const status = String(document.getElementById('dealStatusInput')?.value || 'active');
        const stage = normalizeDealStage(String(document.getElementById('dealStageInput')?.value || 'Новый'));
        const category = normalizeDealCategory(String(document.getElementById('dealCategoryInput')?.value || 'Прочее'));
        const notes = String(document.getElementById('dealNotesInput')?.value || '').trim();
        const contactPersonId = String(document.getElementById('dealContactPersonSelect')?.value || '').trim();
        const isImportant = Boolean(document.getElementById('dealImportantInput')?.checked);
        const needsDelivery = Boolean(document.getElementById('dealDeliveryInput')?.checked);
        if (!title) return showToast('Название сделки обязательно', 'warn');
        if (!clientId) return showToast('Выберите контрагента из базы', 'warn');
        const nextTouchAt = /^\d{4}-\d{2}-\d{2}$/.test(nextDateRaw) ? new Date(`${nextDateRaw}T10:00:00`).toISOString() : '';
        const amount = Math.max(0, Number(amountRaw) || 0);
        if (dealId) {
            const idx = deals.findIndex(d => String(d.id) === dealId);
            if (idx < 0) return showToast('Сделка не найдена', 'error');
            deals[idx] = ensureDealRecord({
                ...deals[idx],
                client_id: clientId,
                contact_person_id: contactPersonId,
                title,
                amount,
                status,
                stage: status === 'active' ? stage : 'Закрыто',
                category,
                next_touch_at: status === 'active' ? nextTouchAt : '',
                notes,
                is_important: isImportant,
                needs_delivery: needsDelivery
            });
            currentDealId = dealId;
        } else {
            const record = ensureDealRecord({
                id: generateDealId(),
                client_id: clientId,
                contact_person_id: contactPersonId,
                title,
                amount,
                category,
                stage: status === 'active' ? stage : 'Закрыто',
                status,
                created_at: new Date().toISOString(),
                next_touch_at: status === 'active' ? nextTouchAt : '',
                notes,
                is_important: isImportant,
                needs_delivery: needsDelivery,
                followup_step: 1
            });
            deals.unshift(record);
            currentDealId = record.id;
        }
        closeModal('dealModal');
        saveData();
        switchSidebarTab('deals');
        showToast(dealId ? 'Сделка обновлена' : 'Сделка создана', 'success');
    }

    function deleteDeal(dealId) {
        const safeDealId = String(dealId || '').trim();
        if (!safeDealId) return;
        const idx = deals.findIndex(d => String(d.id) === safeDealId);
        if (idx < 0) return showToast('Сделка не найдена', 'error');
        if (!confirm('Удалить сделку? Связанные задачи останутся, но отвязка будет сохранена.')) return;
        deals.splice(idx, 1);
        history.forEach(item => {
            if (String(item.deal_id || '') === safeDealId) item.deal_id = '';
        });
        touches = touches.filter(t => String(t.deal_id || '') !== safeDealId);
        if (String(currentDealId || '') === safeDealId) currentDealId = '';
        closeModal('dealModal');
        saveData();
        renderDealsSidebar();
        showToast('Сделка удалена', 'success');
    }

    function openDealLinkedToTask(taskId, createIfMissing = true) {
        const task = history.find(h => String(h.id) === String(taskId));
        if (!task) return showToast('Задача не найдена', 'error');
        const linked = getLinkedDealForTask(task);
        if (linked) {
            if (String(task.deal_id || '') !== String(linked.id || '')) {
                task.deal_id = String(linked.id || '');
                saveData();
            }
            openDealByIdInSidebar(linked.id);
            return;
        }
        if (!createIfMissing) {
            showToast('Для этой задачи сделка не привязана', 'warn');
            return;
        }
        openCreateDealFromTask(taskId);
    }

    function createTaskFromDeal(dealId) {
        const deal = getDealById(dealId);
        if (!deal) return showToast('Сделка не найдена', 'error');
        const clientId = String(deal.client_id || '').trim();
        if (!clientId) return showToast('У сделки не указан контрагент', 'warn');

        const defaultDate = getDateOnlyFromIso(deal.next_touch_at) || getTodayIsoLocal();
        const prefill = String(deal.title || '').trim() || 'Сделка';
        const topicRaw = prompt('Тема задачи по сделке:', `Сделка: ${prefill}`);
        if (topicRaw === null) return;
        const topic = String(topicRaw || '').trim();
        if (!topic) return showToast('Тема задачи обязательна', 'warn');

        const touchedTs = Date.now();
        const taskRecord = {
            id: `task_${touchedTs}_${Math.random().toString(36).slice(2, 7)}`,
            clientId,
            deal_id: String(deal.id || ''),
            contactPersonId: String(deal.contact_person_id || ''),
            created_at: new Date(touchedTs).toISOString(),
            date: defaultDate,
            time: '',
            type: 'Задача по сделке',
            result: '',
            desc: topic,
            nextDate: defaultDate,
            nextTime: '',
            nextStep: topic,
            taskStatus: 'new',
            status: 'active',
            completedAt: '',
            completedDate: '',
            completedTime: '',
            modifiedAt: touchedTs
        };
        ensureWorkItemTempFields(taskRecord, new Date(touchedTs));
        syncWorkItemDueAt(taskRecord);
        history.unshift(taskRecord);
        touchClientTaskActivity(clientId, touchedTs);
        saveData();
        showToast('Задача создана и привязана к сделке', 'success');
    }

    function ensureDealsDelegation() {
        const list = document.getElementById('dealsList');
        const details = document.getElementById('dealDetailsPanel');
        if (list && list.dataset.delegated !== '1') {
            list.dataset.delegated = '1';
            list.addEventListener('click', (e) => {
                const item = e.target.closest('.deal-item');
                if (!item || !list.contains(item)) return;
                const dealId = String(item.dataset.dealId || '');
                if (!dealId) return;
                currentDealId = dealId;

                const btn = e.target.closest('[data-deal-action]');
                if (btn && item.contains(btn)) {
                    const action = String(btn.dataset.dealAction || '');
                    if (action === 'create-task') return createTaskFromDeal(dealId);
                    if (action === 'edit') return openDealModal(dealId);
                    if (action === 'delete') return deleteDeal(dealId);
                }
                renderDealsSidebar();
            });
        }
        if (details && details.dataset.delegated !== '1') {
            details.dataset.delegated = '1';
            details.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-deal-detail-action]');
                if (!btn || !details.contains(btn)) return;
                const action = String(btn.dataset.dealDetailAction || '');
                const dealId = String(btn.dataset.dealId || currentDealId || '');
                if (!dealId) return;
                if (action === 'create-task') return createTaskFromDeal(dealId);
                if (action === 'edit') return openDealModal(dealId);
                if (action === 'delete') return deleteDeal(dealId);
                if (action === 'save-meta') return saveDealMetaFromDetails(dealId);
            });
        }
    }

    function syncDealTouchModalManualNextState() {
        const mode = String(document.getElementById('dealTouchMode')?.value || 'touch');
        const toggle = document.getElementById('dealTouchManualNextToggle');
        const dateInput = document.getElementById('dealTouchNextDate');
        const touchFields = document.getElementById('dealTouchTouchFields');
        const dateLabel = document.getElementById('dealTouchDateLabel');
        if (!dateInput || !touchFields || !dateLabel) return;
        if (mode === 'snooze') {
            touchFields.classList.add('hidden');
            dateInput.disabled = false;
            dateLabel.textContent = 'Новая дата касания';
            return;
        }
        touchFields.classList.remove('hidden');
        dateLabel.textContent = 'Дата следующего касания';
        const manual = Boolean(toggle?.checked);
        dateInput.disabled = !manual;
        if (!manual) dateInput.value = '';
    }

    function openEditDealTouchModal(touchId) {
        const touch = touches.find(t => String(t.id) === String(touchId));
        if (!touch) return showToast('Касание не найдено', 'error');
        openDealTouchModal(touch.deal_id, { mode: 'edit_touch', touchId: String(touch.id) });
    }

    function openDealTouchModal(dealId, options = {}) {
        const deal = getDealById(dealId);
        if (!deal) return showToast('Сделка не найдена', 'error');
        const mode = String(options.mode || 'touch');
        const modal = document.getElementById('dealTouchModal');
        if (!modal) return;
        const titleEl = document.getElementById('dealTouchModalTitle');
        const dealIdInput = document.getElementById('dealTouchDealId');
        const touchIdInput = document.getElementById('dealTouchId');
        const modeInput = document.getElementById('dealTouchMode');
        const typeInput = document.getElementById('dealTouchType');
        const resultInput = document.getElementById('dealTouchResult');
        const commentInput = document.getElementById('dealTouchComment');
        const nextDateInput = document.getElementById('dealTouchNextDate');
        const toggleInput = document.getElementById('dealTouchManualNextToggle');
        if (!titleEl || !dealIdInput || !touchIdInput || !modeInput || !typeInput || !resultInput || !commentInput || !nextDateInput || !toggleInput) return;

        dealIdInput.value = String(deal.id || '');
        touchIdInput.value = '';
        modeInput.value = mode;
        typeInput.value = 'call';
        resultInput.value = 'reached';
        commentInput.value = String(options.commentPrefill || '');
        nextDateInput.value = '';
        toggleInput.checked = false;
        if (mode === 'snooze') {
            titleEl.textContent = `Перенос касания: ${deal.title || 'Сделка'}`;
            const datePrefill = getDateOnlyFromIso(deal.next_touch_at) || getTodayIsoLocal();
            nextDateInput.value = datePrefill;
        } else if (mode === 'edit_touch') {
            const touch = touches.find(t => String(t.id) === String(options.touchId || ''));
            if (!touch) return showToast('Касание не найдено', 'error');
            const normTouch = ensureTouchRecord(touch);
            titleEl.textContent = `Редактировать касание: ${deal.title || 'Сделка'}`;
            touchIdInput.value = String(normTouch.id);
            typeInput.value = String(normTouch.touch_type || 'call');
            resultInput.value = String(normTouch.result || 'other');
            commentInput.value = String(normTouch.comment || '');
            const nextDate = getDateOnlyFromIso(normTouch.next_touch_at);
            if (nextDate) {
                toggleInput.checked = true;
                nextDateInput.value = nextDate;
            }
        } else {
            titleEl.textContent = `Касание: ${deal.title || 'Сделка'}`;
        }
        syncDealTouchModalManualNextState();
        modal.classList.remove('hidden');
    }

    function saveDealTouchModal() {
        const dealId = String(document.getElementById('dealTouchDealId')?.value || '');
        const touchId = String(document.getElementById('dealTouchId')?.value || '');
        const mode = String(document.getElementById('dealTouchMode')?.value || 'touch');
        const deal = getDealById(dealId);
        if (!deal) return showToast('Сделка не найдена', 'error');

        const nextDateRaw = String(document.getElementById('dealTouchNextDate')?.value || '').trim();
        const nextDateIso = /^\d{4}-\d{2}-\d{2}$/.test(nextDateRaw) ? new Date(`${nextDateRaw}T10:00:00`).toISOString() : '';

        if (mode === 'snooze') {
            if (!nextDateIso) return showToast('Укажите корректную дату переноса', 'warn');
            const applied = applyDealSnooze(deal, nextDateIso);
            if (!applied.changed) return showToast('Не удалось перенести касание', 'error');
            const idx = deals.findIndex(d => String(d.id) === String(deal.id));
            if (idx >= 0) deals[idx] = applied.deal;
            touches.unshift(ensureTouchRecord({
                deal_id: deal.id,
                touch_type: 'other',
                result: 'rescheduled',
                comment: 'Перенос касания',
                next_touch_at: applied.deal.next_touch_at,
                snooze_applied_days: Math.max(0, parseInt(applied.overdueAdd, 10) || 0)
            }));
            currentDealId = applied.deal.id;
            closeModal('dealTouchModal');
            saveData();
            showToast('Касание перенесено', 'success');
            return;
        }

        if (mode === 'edit_touch') {
            const touchIdx = touches.findIndex(t => String(t.id) === touchId);
            if (touchIdx < 0) return showToast('Касание не найдено', 'error');
            const type = String(document.getElementById('dealTouchType')?.value || 'call');
            const result = String(document.getElementById('dealTouchResult')?.value || 'reached');
            const comment = String(document.getElementById('dealTouchComment')?.value || '');
            const manualEnabled = Boolean(document.getElementById('dealTouchManualNextToggle')?.checked);
            if (manualEnabled && !nextDateIso) return showToast('Укажите корректную дату следующего касания', 'warn');

            const prev = ensureTouchRecord(touches[touchIdx]);
            const updatedTouch = ensureTouchRecord({
                ...prev,
                touch_type: type,
                result: result,
                comment: comment,
                next_touch_at: manualEnabled ? nextDateIso : ''
            });
            touches[touchIdx] = updatedTouch;

            const dealIdx = deals.findIndex(d => String(d.id) === String(deal.id));
            if (dealIdx >= 0) {
                const latestDealTouch = touches
                    .filter(t => String(t.deal_id) === String(deal.id))
                    .map(t => ensureTouchRecord(t))
                    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;
                if (latestDealTouch && String(latestDealTouch.id) === String(updatedTouch.id)) {
                    const nextDeal = ensureDealRecord({
                        ...deal,
                        last_touch_at: updatedTouch.created_at,
                        next_touch_at: updatedTouch.next_touch_at || deal.next_touch_at,
                        status: ['won', 'lost'].includes(updatedTouch.result) ? updatedTouch.result : deal.status,
                        stage: ['won', 'lost'].includes(updatedTouch.result) ? 'closed' : deal.stage
                    });
                    deals[dealIdx] = nextDeal;
                }
            }

            currentDealId = String(deal.id);
            closeModal('dealTouchModal');
            saveData();
            showToast('Касание обновлено', 'success');
            return;
        }

        const type = String(document.getElementById('dealTouchType')?.value || 'call');
        const result = String(document.getElementById('dealTouchResult')?.value || 'reached');
        const comment = String(document.getElementById('dealTouchComment')?.value || '');
        const manualEnabled = Boolean(document.getElementById('dealTouchManualNextToggle')?.checked);
        if (manualEnabled && !nextDateIso) return showToast('Укажите корректную дату следующего касания', 'warn');
        const applied = applyTouchToDeal(deal, {
            touch_type: type,
            result,
            comment,
            next_touch_at: manualEnabled ? nextDateIso : ''
        });
        const idx = deals.findIndex(d => String(d.id) === String(deal.id));
        if (idx >= 0) deals[idx] = applied.deal;
        touches.unshift(applied.touch);
        currentDealId = applied.deal.id;
        closeModal('dealTouchModal');
        saveData();
        showToast('Касание сохранено', 'success');
    }

    function saveDealMetaFromDetails(dealId) {
        const deal = getDealById(dealId);
        if (!deal) return;
        const title = String(document.getElementById('dealDetailTitleInput')?.value || deal.title || '').trim();
        const amountRaw = String(document.getElementById('dealDetailAmountInput')?.value || '').trim().replace(',', '.');
        const amount = Math.max(0, Number(amountRaw) || 0);
        const status = String(document.getElementById('dealDetailStatusInput')?.value || deal.status || 'active');
        const nextDateRaw = String(document.getElementById('dealDetailNextDateInput')?.value || '').trim();
        const stage = normalizeDealStage(String(document.getElementById('dealDetailStageInput')?.value || deal.stage || 'Новый'));
        const category = normalizeDealCategory(String(document.getElementById('dealDetailCategoryInput')?.value || deal.category || 'Прочее'));
        const notes = String(document.getElementById('dealDetailNotesInput')?.value || '');
        const isImportant = Boolean(document.getElementById('dealDetailImportantInput')?.checked);
        const needsDelivery = Boolean(document.getElementById('dealDetailDeliveryInput')?.checked);
        const nextTouchAt = /^\d{4}-\d{2}-\d{2}$/.test(nextDateRaw) ? new Date(`${nextDateRaw}T10:00:00`).toISOString() : '';
        const idx = deals.findIndex(d => String(d.id) === String(deal.id));
        if (idx < 0) return;
        const normalizedStatus = ['active', 'won', 'lost'].includes(status) ? status : 'active';
        const normalizedStage = normalizedStatus === 'active' ? stage : 'Закрыто';
        deals[idx] = ensureDealRecord({
            ...deal,
            title: title || deal.title || 'Сделка без названия',
            amount,
            status: normalizedStatus,
            stage: normalizedStage,
            next_touch_at: normalizedStatus === 'active' ? nextTouchAt : '',
            category,
            notes,
            is_important: isImportant,
            needs_delivery: needsDelivery
        });
        currentDealId = String(deal.id);
        saveData();
        showToast('Параметры сделки сохранены', 'success');
    }

    function deleteDealTouch(touchId, dealId) {
        const safeTouchId = String(touchId || '').trim();
        const safeDealId = String(dealId || '').trim();
        if (!safeTouchId || !safeDealId) return;
        const idx = touches.findIndex(t => String(t.id) === safeTouchId && String(t.deal_id) === safeDealId);
        if (idx < 0) return showToast('Касание не найдено', 'error');
        if (!confirm('Удалить это касание?')) return;
        touches.splice(idx, 1);

        const dealIdx = deals.findIndex(d => String(d.id) === safeDealId);
        if (dealIdx >= 0) {
            const deal = ensureDealRecord(deals[dealIdx]);
            const latestTouch = touches
                .filter(t => String(t.deal_id) === safeDealId)
                .map(t => ensureTouchRecord(t))
                .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;

            const nextDeal = ensureDealRecord({
                ...deal,
                last_touch_at: latestTouch ? latestTouch.created_at : '',
                next_touch_at: deal.status === 'active' ? (latestTouch?.next_touch_at || deal.next_touch_at || '') : ''
            });
            deals[dealIdx] = nextDeal;
        }

        saveData();
        showToast('Касание удалено', 'success');
    }

    function openDealsSidebar() {
        switchSidebarTab('deals');
    }

    function openDealFromDashboard(dealId) {
        const targetId = String(dealId || '').trim();
        if (!targetId) return;
        const exists = deals.some(d => String(d.id) === targetId);
        if (!exists) return;
        currentDealTimingFilter = 'open';
        currentDealCategoryFilter = 'all';
        currentDealStageFilter = 'all';
        currentDealId = targetId;
        switchSidebarTab('deals');
        renderDealsSidebar();
    }

    function dealOpenClient(clientId) {
        if (!clientId) return;
        selectClient(clientId);
    }

    function dealOpenTask(taskId) {
        if (!taskId) return;
        openTaskView(taskId);
    }

    function dealDialPhone(phone) {
        const value = String(phone || '').trim();
        if (!value) return showToast('Телефон не найден', 'warn');
        window.location.href = `tel:${value.replace(/[^\d+]/g, '')}`;
    }

    function dealWhatsApp(phone) {
        const value = String(phone || '').replace(/[^\d]/g, '');
        if (!value) return showToast('Телефон не найден', 'warn');
        window.open(`https://wa.me/${value}`, '_blank', 'noopener');
    }

    function dealTelegram(phone) {
        const value = String(phone || '').replace(/[^\d]/g, '');
        if (!value) return showToast('Телефон не найден', 'warn');
        window.open(`https://t.me/+${value}`, '_blank', 'noopener');
    }

    function quickAddDealTouch(dealId, commentPrefill = '') {
        const deal = getDealById(dealId);
        if (!deal) return showToast('Сделка не найдена', 'error');
        if (deal.status !== 'active') return showToast('Сделка закрыта', 'warn');
        openDealTouchModal(dealId, { mode: 'touch', commentPrefill });
    }

    function quickSnoozeDeal(dealId) {
        const deal = getDealById(dealId);
        if (!deal) return showToast('Сделка не найдена', 'error');
        if (deal.status !== 'active') return showToast('Сделка закрыта', 'warn');
        openDealTouchModal(dealId, { mode: 'snooze' });
    }

    function closeDealQuick(dealId, status) {
        const deal = getDealById(dealId);
        if (!deal) return showToast('Сделка не найдена', 'error');
        const normalizedStatus = status === 'won' ? 'won' : 'lost';
        const outcome = getDealOutcomeInfo({ status: normalizedStatus });
        if (!confirm(`Закрыть сделку: ${outcome.label}?`)) return;
        const idx = deals.findIndex(d => String(d.id) === String(deal.id));
        if (idx < 0) return;
        const nowIso = new Date().toISOString();
        const overdueAdd = getOverdueDaysBetween(deal.next_touch_at, nowIso);
        const nextDeal = ensureDealRecord({
            ...deal,
            status: normalizedStatus,
            stage: 'closed',
            next_touch_at: '',
            last_touch_at: nowIso,
            overdue_days: Math.max(0, parseInt(deal.overdue_days, 10) || 0) + overdueAdd
        });
        deals[idx] = nextDeal;
        touches.unshift(ensureTouchRecord({
            deal_id: deal.id,
            touch_type: 'other',
            result: normalizedStatus,
            comment: `Сделка закрыта: ${outcome.label}`
        }));
        currentDealId = nextDeal.id;
        saveData();
        showToast(`Сделка закрыта: ${outcome.label}`, 'success');
    }

    function openCreateDealFromTask(taskId) {
        const task = history.find(h => String(h.id) === String(taskId));
        if (!task) return showToast('Задача не найдена', 'error');
        const existing = getLinkedDealForTask(task);
        if (existing) {
            const idxExisting = history.findIndex(h => String(h.id) === String(task.id));
            if (idxExisting >= 0) history[idxExisting].deal_id = String(existing.id || '');
            openDealByIdInSidebar(existing.id);
            return showToast('Для задачи уже есть привязанная сделка', 'info');
        }
        const client = clients.find(c => String(c.id) === String(task.clientId)) || null;
        const titlePrefill = String(task.nextStep || task.desc || '').trim() || `Сделка: ${client?.name || 'контрагент'}`;
        const customTitle = prompt('Название сделки из задачи:', titlePrefill);
        if (customTitle === null) return;
        const safeTitle = String(customTitle || '').trim();
        if (!safeTitle) return showToast('Название сделки обязательно', 'warn');

        const deal = buildDealFromTask(task, client, {
            title: safeTitle,
            stage: 'Расчёт отправлен'
        });
        deal.contact_person_id = String(task.contactPersonId || '');
        deals.unshift(deal);
        currentDealId = deal.id;
        const idx = history.findIndex(h => String(h.id) === String(task.id));
        if (idx >= 0) history[idx].deal_id = String(deal.id);
        saveData();
        showToast('Сделка создана и привязана к задаче', 'success');
        switchSidebarTab('deals');
    }

    function renderDealDetailsPanel(dealId) {
        const panel = document.getElementById('dealDetailsPanel');
        if (!panel) return;
        panel.replaceChildren();
        const deal = getDealById(dealId);
        if (!deal) {
            panel.innerHTML = '<div class="deal-details-meta">Выберите сделку, чтобы увидеть карточку и связанные задачи.</div>';
            return;
        }
        const client = clients.find(c => String(c.id) === String(deal.client_id));
        const contact = client && Array.isArray(client.contacts)
            ? client.contacts.map((item, idx) => normalizeContact(item, idx)).find(item => String(item.id || '') === String(deal.contact_person_id || '')) || null
            : null;
        const linkedTasks = getTasksLinkedToDeal(deal)
            .sort((a, b) => String(getExecutionDate(b) || '').localeCompare(String(getExecutionDate(a) || '')))
            .slice(0, 6);

        const title = document.createElement('h4');
        title.className = 'deal-details-title';
        title.textContent = `${getDealImportantPrefix(deal)}${getDealDeliveryPrefix(deal)}${deal.title || 'Сделка'}`;
        const meta = document.createElement('div');
        meta.className = 'deal-details-meta';
        const amountText = Number(deal.amount || 0) > 0 ? ` · сумма ${Number(deal.amount).toLocaleString('ru-RU')} ₽` : '';
        const clientLabel = client ? String(client.name || 'Без имени') : 'Без клиента';
        meta.innerHTML = `${client ? `<button type="button" class="deal-client-link" data-action="dealOpenClient" data-client-id="${escapeHtml(String(client.id || ''))}">${escapeHtml(clientLabel)}</button>` : escapeHtml(clientLabel)} · ${escapeHtml(normalizeDealStage(deal.stage))} · ${escapeHtml(getDealHeatLabel(deal.heat))}${escapeHtml(amountText)} · срок ${escapeHtml(getDealNextTouchDateLabel(deal.next_touch_at))}`;

        const contactMeta = document.createElement('div');
        contactMeta.className = 'deal-details-meta';
        const contactPhone = contact ? getContactPreferredPhone(contact) : '';
        contactMeta.textContent = contact
            ? `Контактное лицо: ${contact.name}${contactPhone ? ` · ${contactPhone}` : ''}`
            : 'Контактное лицо: не выбрано';

        const actions = document.createElement('div');
        actions.className = 'deal-item-actions';
        actions.innerHTML = `
            <button type="button" class="btn-primary btn-sm" data-deal-detail-action="create-task" data-deal-id="${escapeHtml(String(deal.id))}">+ Создать задачу</button>
            <button type="button" class="btn-primary btn-sm" data-deal-detail-action="edit" data-deal-id="${escapeHtml(String(deal.id))}">Редактировать</button>
            <button type="button" class="btn-danger btn-sm" data-deal-detail-action="delete" data-deal-id="${escapeHtml(String(deal.id))}">Удалить</button>
            ${client ? `<button type="button" class="btn-sm btn-primary" data-action="dealOpenClient" data-client-id="${escapeHtml(String(client.id || ''))}">Карточка клиента</button>` : ''}
        `;

        const metaForm = document.createElement('div');
        metaForm.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;';
        metaForm.innerHTML = `
            <input id="dealDetailTitleInput" type="text" placeholder="Название сделки" style="grid-column:1 / span 2;">
            <input id="dealDetailAmountInput" type="number" min="0" step="0.01" placeholder="Сумма сделки, ₽" style="grid-column:1 / span 2;">
            <select id="dealDetailStatusInput">
                <option value="active">В работе</option>
                <option value="won">Выиграли</option>
                <option value="lost">Клиент отказался</option>
            </select>
            <input id="dealDetailNextDateInput" type="date">
            <div style="display:flex; gap:6px; align-items:center;">
                <select id="dealDetailStageInput" style="flex:1 1 auto;"></select>
                <button type="button" class="btn-primary btn-sm" data-action="manageDealOption" data-kind="stage" data-mode="add" data-target="dealDetailStageInput">+</button>
                <button type="button" class="btn-danger btn-sm" data-action="manageDealOption" data-kind="stage" data-mode="remove" data-target="dealDetailStageInput">−</button>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
                <select id="dealDetailCategoryInput" style="flex:1 1 auto;"></select>
                <button type="button" class="btn-primary btn-sm" data-action="manageDealOption" data-kind="category" data-mode="add" data-target="dealDetailCategoryInput">+</button>
                <button type="button" class="btn-danger btn-sm" data-action="manageDealOption" data-kind="category" data-mode="remove" data-target="dealDetailCategoryInput">−</button>
            </div>
            <div class="deal-flags-row" style="grid-column:1 / span 2;">
                <label class="deal-flag-toggle important">
                    <input id="dealDetailImportantInput" type="checkbox">
                    <span>❗ Важная сделка</span>
                </label>
                <label class="deal-flag-toggle delivery">
                    <input id="dealDetailDeliveryInput" type="checkbox">
                    <span>🚚 Нужна доставка</span>
                </label>
            </div>
            <textarea id="dealDetailNotesInput" placeholder="Заметки по сделке" style="grid-column:1 / span 2; min-height:64px;"></textarea>
            <button type="button" class="btn-primary btn-sm" data-deal-detail-action="save-meta" data-deal-id="${escapeHtml(String(deal.id))}" style="grid-column:1 / span 2;">Сохранить параметры сделки</button>
        `;

        panel.appendChild(title);
        panel.appendChild(meta);
        panel.appendChild(contactMeta);
        const importantBadge = createDealImportantBadge(deal);
        if (importantBadge) {
            importantBadge.style.marginBottom = '8px';
            panel.appendChild(importantBadge);
        }
        const deliveryBadge = createDealDeliveryBadge(deal);
        if (deliveryBadge) {
            deliveryBadge.style.marginBottom = '8px';
            panel.appendChild(deliveryBadge);
        }
        if (isDealClosed(deal)) {
            const detailClosedChip = createDealClosedChip(deal);
            detailClosedChip.style.marginBottom = '8px';
            panel.appendChild(detailClosedChip);
        }
        panel.appendChild(actions);
        panel.appendChild(metaForm);
        if (linkedTasks.length) {
            const tasksWrap = document.createElement('div');
            tasksWrap.style.cssText = 'margin-bottom:8px; border:1px solid #edf1f5; border-radius:8px; background:#fcfdff; padding:8px;';
            const tasksTitle = document.createElement('div');
            tasksTitle.style.cssText = 'font-size:0.76rem; color:#54687c; margin-bottom:6px;';
            tasksTitle.textContent = 'Связанные задачи';
            tasksWrap.appendChild(tasksTitle);
            linkedTasks.forEach((t) => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; gap:3px; font-size:0.76rem; margin-bottom:6px;';
                const taskText = String(t.nextStep || t.desc || 'Задача');
                const doneResult = String(t.result || '').trim();
                const suffix = t.taskStatus === 'done'
                    ? (doneResult ? ` · Итог: ${doneResult}` : ' · Выполнена')
                    : '';
                const taskDueLabel = formatDateTimeRu(getExecutionDate(t), getExecutionTime(t));
                const taskContactLabel = getTaskContactPersonLabel(t, client) || 'не указано';
                row.className = t.taskStatus === 'done' ? 'deal-linked-task-row done' : 'deal-linked-task-row';
                row.dataset.action = 'dealOpenTask';
                row.dataset.taskId = String(t.id || '');
                row.innerHTML = `
                    <span class="deal-linked-task-meta">
                        <span class="deal-linked-task-due">Срок: ${escapeHtml(taskDueLabel)}</span>
                        <span class="deal-linked-task-contact">Контакт: ${escapeHtml(taskContactLabel)}</span>
                    </span>
                    <span>${escapeHtml(`${taskText}${suffix}`)}</span>
                    <span class="task-created-meta">${escapeHtml(getTaskCreatedDateLabel(t))}</span>
                `;
                tasksWrap.appendChild(row);
            });
            panel.appendChild(tasksWrap);
        }
        const stageInput = document.getElementById('dealDetailStageInput');
        const titleInput = document.getElementById('dealDetailTitleInput');
        const amountInput = document.getElementById('dealDetailAmountInput');
        const statusInput = document.getElementById('dealDetailStatusInput');
        const nextDateInput = document.getElementById('dealDetailNextDateInput');
        const categoryInput = document.getElementById('dealDetailCategoryInput');
        const notesInput = document.getElementById('dealDetailNotesInput');
        renderDealDetailStageOptions(deal.stage || 'Новый');
        renderDealDetailCategoryOptions(deal.category || 'Прочее');
        if (titleInput) titleInput.value = String(deal.title || '');
        if (amountInput) amountInput.value = Number(deal.amount || 0) > 0 ? String(deal.amount) : '';
        if (statusInput) statusInput.value = String(deal.status || 'active');
        if (nextDateInput) nextDateInput.value = getDateOnlyFromIso(deal.next_touch_at);
        if (stageInput) stageInput.value = normalizeDealStage(deal.stage || 'Новый');
        if (categoryInput) categoryInput.value = normalizeDealCategory(deal.category || 'Прочее');
        const importantInput = document.getElementById('dealDetailImportantInput');
        if (importantInput) importantInput.checked = Boolean(deal.is_important);
        const deliveryInput = document.getElementById('dealDetailDeliveryInput');
        if (deliveryInput) deliveryInput.checked = Boolean(deal.needs_delivery);
        if (notesInput) notesInput.value = String(deal.notes || '');
    }

    function renderDealReminderSummary() {
        const todayEl = document.getElementById('dealTodayCount');
        const overdueEl = document.getElementById('dealOverdueCount');
        const todayChip = todayEl ? todayEl.closest('.deal-summary-chip') : null;
        const overdueChip = overdueEl ? overdueEl.closest('.deal-summary-chip') : null;
        if (!todayEl || !overdueEl) return;
        const activeDeals = (Array.isArray(deals) ? deals : [])
            .map(d => ensureDealRecord(d))
            .filter(d => String(d.status || '') === 'active');
        const todayCount = activeDeals.filter(d => getDealTimeBucket(d) === 'today').length;
        const overdueCount = activeDeals.filter(d => getDealTimeBucket(d) === 'overdue').length;
        todayEl.textContent = String(todayCount);
        overdueEl.textContent = String(overdueCount);
        if (todayChip) todayChip.classList.toggle('active', currentDealTimingFilter === 'today');
        if (overdueChip) overdueChip.classList.toggle('active', currentDealTimingFilter === 'overdue');
    }

    function renderDashboardDealsQueue() {
        const wrap = document.getElementById('dashboardDealsQueue');
        const stat = document.getElementById('statDealsDue');
        if (!wrap || !stat) return;
        const queue = (Array.isArray(deals) ? deals : [])
            .map(d => ensureDealRecord(d))
            .filter(d => String(d.status || '') === 'active')
            .filter(d => {
                const b = getDealTimeBucket(d);
                return b === 'today' || b === 'overdue' || b === 'week';
            })
            .sort((a, b) => String(a.next_touch_at || '').localeCompare(String(b.next_touch_at || '')));

        stat.textContent = String(queue.length);
        wrap.replaceChildren();

        const head = document.createElement('div');
        head.className = 'dashboard-deals-queue-head';
        head.innerHTML = `<strong>Сделки: контроль сроков</strong><button type="button" class="btn-sm btn-primary" data-action="openDealsSidebar">Открыть раздел</button>`;
        wrap.appendChild(head);

        if (!queue.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'font-size:0.78rem; color:#64748b;';
            empty.textContent = 'Нет сделок со сроком на сегодня/неделю.';
            wrap.appendChild(empty);
            return;
        }

        queue.slice(0, 6).forEach((deal) => {
            const client = clients.find(c => String(c.id) === String(deal.client_id));
            const item = document.createElement('div');
            item.className = `dashboard-deal-item clickable${deal.is_important ? ' important' : ''}`;
            item.dataset.action = 'openDealFromDashboard';
            item.dataset.dealId = String(deal.id || '');
            const bucket = getDealTimeBucket(deal);
            const badge = bucket === 'overdue' ? '🔴' : (bucket === 'today' ? '🟢' : '🔵');
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; gap:8px;">
                    <strong>${escapeHtml(`${getDealImportantPrefix(deal)}${getDealDeliveryPrefix(deal)}${String(deal.title || 'Сделка')}`)}</strong>
                    <span>${escapeHtml(getDealNextTouchDateLabel(deal.next_touch_at))}</span>
                </div>
                <div style="font-size:0.74rem; color:#5f7286; margin-top:4px;">
                    <span>${escapeHtml(String(client?.name || 'Без клиента'))} · ${escapeHtml(getDealHeatLabel(deal.heat))}${deal.is_important ? ' · ❗ важная' : ''}${deal.needs_delivery ? ' · 🚚 доставка' : ''}</span>
                </div>
            `;
            wrap.appendChild(item);
        });
    }

    function renderDealsSidebar() {
        const list = document.getElementById('dealsList');
        const badge = document.getElementById('dealCountBadge');
        if (!list || !badge) return;
        const timingSelect = document.getElementById('dealTimingFilter');
        const categorySelect = document.getElementById('dealCategoryFilter');
        const stageSelect = document.getElementById('dealStageFilter');
        const sortSelect = document.getElementById('dealSortFilter');
        if (timingSelect && timingSelect.value !== currentDealTimingFilter) timingSelect.value = currentDealTimingFilter;
        if (categorySelect && categorySelect.value !== currentDealCategoryFilter) categorySelect.value = currentDealCategoryFilter;
        if (stageSelect && stageSelect.value !== currentDealStageFilter) stageSelect.value = currentDealStageFilter;
        if (sortSelect && sortSelect.value !== currentDealSort) sortSelect.value = currentDealSort;
        ensureDealsDelegation();
        renderDealReminderSummary();

        let activeDeals = (Array.isArray(deals) ? deals : [])
            .map(d => ensureDealRecord(d));
        activeDeals = activeDeals.filter((d) => {
            if (currentDealCategoryFilter !== 'all' && String(d.category) !== String(currentDealCategoryFilter)) return false;
            if (currentDealStageFilter !== 'all' && String(d.stage) !== String(currentDealStageFilter)) return false;
            const bucket = getDealTimeBucket(d);
            if (currentDealTimingFilter === 'all') return true;
            if (currentDealTimingFilter === 'open') return !isDealClosed(d);
            return bucket === currentDealTimingFilter;
        });
        activeDeals.sort((a, b) => {
            if (currentDealSort === 'amount_desc') {
                const amountDiff = Number(b.amount || 0) - Number(a.amount || 0);
                if (amountDiff !== 0) return amountDiff;
            }
            return String(a.next_touch_at || '').localeCompare(String(b.next_touch_at || ''));
        });

        badge.textContent = String(activeDeals.length);
        list.replaceChildren();

        if (!activeDeals.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:20px; text-align:center; color:#999; font-size:0.9rem;';
            empty.textContent = (Array.isArray(deals) && deals.length) ? 'Нет сделок по выбранным фильтрам' : 'Сделок пока нет';
            list.appendChild(empty);
            currentDealId = '';
            renderDealDetailsPanel('');
            return;
        }

        const allDeals = (Array.isArray(deals) ? deals : []).map(d => ensureDealRecord(d));
        if (!currentDealId || !allDeals.some(d => String(d.id) === String(currentDealId))) {
            currentDealId = String(activeDeals[0].id || '');
        }

        activeDeals.forEach((deal) => {
            const client = clients.find(c => String(c.id) === String(deal.client_id));
            const overdueLive = calcDealOverdueDays(deal);
            const item = document.createElement('div');
            const isActiveDeal = String(deal.id) === String(currentDealId);
            const isOverdueDeal = getDealTimeBucket(deal) === 'overdue';
            item.className = `deal-item${isActiveDeal ? ' active' : ''}${isOverdueDeal ? ' overdue' : ''}${deal.is_important ? ' important' : ''}`;
            item.dataset.dealId = String(deal.id || '');
            item.title = deal.notes || '';

            const head = document.createElement('div');
            head.className = 'deal-item-head';
            const left = document.createElement('span');
            left.textContent = `${normalizeDealStage(deal.stage)} · ${getDealHeatLabel(deal.heat)}${deal.is_important ? ' · ❗ важная' : ''}${deal.needs_delivery ? ' · 🚚 доставка' : ''}`;
            const right = document.createElement('span');
            right.textContent = `Срок: ${getDealNextTouchDateLabel(deal.next_touch_at)}`;
            head.appendChild(left);
            head.appendChild(right);

            const title = document.createElement('div');
            title.className = 'deal-item-title';
            title.textContent = `${getDealImportantPrefix(deal)}${getDealDeliveryPrefix(deal)}${deal.title || 'Сделка без названия'}`;

            const clientLine = document.createElement('div');
            clientLine.className = 'deal-item-client';
            clientLine.textContent = client ? (client.name || 'Без имени') : 'Без клиента';

            const meta = document.createElement('div');
            meta.className = 'deal-item-meta';
            const overdueText = overdueLive > 0 ? ` · просрочка ${overdueLive} дн.` : '';
            const amountLabel = Number(deal.amount || 0) > 0 ? `${Number(deal.amount).toLocaleString('ru-RU')} ₽` : 'без суммы';
            meta.textContent = `${amountLabel}${overdueText}`;

            let lastTaskLine = null;
            if (isDealClosed(deal)) {
                const latestTask = getLatestLinkedTaskForDeal(deal);
                lastTaskLine = document.createElement('div');
                lastTaskLine.className = 'deal-last-task';
                if (latestTask) {
                    const taskText = String(latestTask.nextStep || latestTask.desc || 'Задача');
                    const doneResult = String(latestTask.result || '').trim();
                    if (latestTask.taskStatus === 'done') {
                        const resultText = doneResult ? `Итог: ${doneResult}` : 'Итог: Выполнена';
                        lastTaskLine.classList.add('done');
                        lastTaskLine.textContent = `Последняя задача: ${taskText} · ${resultText}`;
                    } else {
                        lastTaskLine.classList.add('open');
                        lastTaskLine.textContent = `Последняя задача: ${taskText} · Не завершена`;
                    }
                } else {
                    lastTaskLine.classList.add('empty');
                    lastTaskLine.textContent = 'Последняя задача: нет связанной задачи';
                }
            }

            const actions = document.createElement('div');
            actions.className = 'deal-item-actions';
            actions.innerHTML = `
                <button type="button" class="btn-primary btn-sm" data-deal-action="create-task">+ Задача</button>
                <button type="button" class="btn-primary btn-sm" data-deal-action="edit">Ред.</button>
                <button type="button" class="btn-danger btn-sm" data-deal-action="delete">Удал.</button>
            `;

            item.appendChild(head);
            if (isDealClosed(deal)) {
                item.appendChild(createDealClosedChip(deal));
            }
            item.appendChild(clientLine);
            item.appendChild(title);
            item.appendChild(meta);
            if (lastTaskLine) item.appendChild(lastTaskLine);
            item.appendChild(actions);
            list.appendChild(item);
        });
        renderDealDetailsPanel(currentDealId);
    }

    // --- RENDER CLIENTS ---
    function setClientSort(sortValue) {
        currentClientSort = ['alpha','class','recent_task'].includes(sortValue) ? sortValue : 'alpha';
        CRMStore.set('clientSort', currentClientSort);
        renderClientList();
    }

    function clearClientSearch() {
        const input = document.getElementById('searchClient');
        if (!input) return;
        input.value = '';
        input.focus();
        renderClientList();
    }

    function clearHeaderSmartSearch() {
        const input = document.getElementById('headerSmartSearchInput');
        if (!input) return;
        input.value = '';
        headerSmartSearchResults = [];
        headerSmartSearchActiveIndex = -1;
        updateHeaderSmartSearchClearBtn();
        hideHeaderSmartSearchDropdown();
        input.focus();
    }

    function updateHeaderSmartSearchClearBtn() {
        const input = document.getElementById('headerSmartSearchInput');
        const btn = document.getElementById('headerSmartSearchClearBtn');
        if (!input || !btn) return;
        btn.style.visibility = String(input.value || '').trim() ? 'visible' : 'hidden';
    }

    function hideHeaderSmartSearchDropdown() {
        const dropdown = document.getElementById('headerSmartSearchDropdown');
        if (!dropdown) return;
        dropdown.classList.add('hidden');
    }

    function showHeaderSmartSearchDropdown() {
        const dropdown = document.getElementById('headerSmartSearchDropdown');
        if (!dropdown) return;
        dropdown.classList.remove('hidden');
    }

    function parseHeaderSmartSearchQuery(rawQuery) {
        const raw = String(rawQuery || '').trim();
        const lowered = raw.toLowerCase();
        const prefixes = [
            { keys: ['задача:', 'задачи:', 'task:', 'tasks:'], scope: 'task' },
            { keys: ['контрагент:', 'контрагенты:', 'клиент:', 'клиенты:', 'client:', 'clients:'], scope: 'client' },
            { keys: ['контакт:', 'контакты:', 'contact:', 'contacts:'], scope: 'contact' }
        ];
        for (const group of prefixes) {
            const key = group.keys.find(prefix => lowered.startsWith(prefix));
            if (key) {
                return {
                    scope: group.scope,
                    query: raw.slice(key.length).trim()
                };
            }
        }
        return { scope: 'all', query: raw };
    }

    function normalizeSearchText(value) {
        return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function tokenizeSearchText(value) {
        return normalizeSearchText(value).split(' ').filter(Boolean);
    }

    function getHeaderSmartSearchItemScore(queryNorm, tokens, primaryText, extraTexts = []) {
        const primary = normalizeSearchText(primaryText);
        const all = normalizeSearchText([primary, ...extraTexts].join(' '));
        if (!tokens.every(t => all.includes(t))) return -1;

        let score = 0;
        if (queryNorm && all.includes(queryNorm)) score += 30;
        if (queryNorm && primary.includes(queryNorm)) score += 70;
        if (queryNorm && primary.startsWith(queryNorm)) score += 110;

        tokens.forEach(token => {
            if (primary === token) score += 45;
            if (primary.startsWith(token)) score += 25;
            if (primary.includes(token)) score += 10;
        });

        const firstPos = tokens.reduce((minPos, token) => {
            const pos = primary.indexOf(token);
            if (pos === -1) return minPos;
            return Math.min(minPos, pos);
        }, 9999);
        if (firstPos < 9999) score += Math.max(0, 18 - firstPos);

        return score;
    }

    function getHeaderSmartSearchStatusLabel(task) {
        const timeState = getTaskTimeState(task);
        if (task.taskStatus === 'done') return 'Выполнена';
        if (timeState === 'overdue') return 'Просрочена';
        if (timeState === 'today') return 'Сегодня';
        if (timeState === 'future') return 'Будущая';
        return task.taskStatus === 'work' ? 'В работе' : 'Новая';
    }

    function buildHeaderSmartSearchResults(rawQuery) {
        const parsed = parseHeaderSmartSearchQuery(rawQuery);
        const queryNorm = normalizeSearchText(parsed.query);
        const tokens = tokenizeSearchText(parsed.query);
        if (!tokens.length) return [];

        const typeOrder = { task: 0, client: 1, contact: 2 };
        const results = [];

        const canShow = (kind) => parsed.scope === 'all' || parsed.scope === kind;

        if (canShow('client')) {
            clients.forEach(client => {
                const contacts = Array.isArray(client.contacts) ? client.contacts : [];
                const contactStrings = contacts.flatMap(contact => {
                    const phones = normalizeContactPhones(contact?.phones, contact?.phone || '');
                    const phoneStr = phones.map(p => `${(p.labels || []).join(' ')} ${p.value || ''}`).join(' ');
                    return [
                        contact?.name || '',
                        contact?.role || '',
                        phoneStr
                    ];
                });
                const extraTexts = [
                    client.status || '',
                    client.type || '',
                    client.address || '',
                    client.phone || '',
                    client.notes || '',
                    client.related || '',
                    ...contactStrings
                ];
                const score = getHeaderSmartSearchItemScore(queryNorm, tokens, client.name || '', extraTexts);
                if (score < 0) return;
                const classValue = normalizeClientClass(client.class);
                results.push({
                    kind: 'client',
                    score: score + 8,
                    id: String(client.id || ''),
                    clientId: String(client.id || ''),
                    title: `${getClientClassIcon(classValue) ? `${getClientClassIcon(classValue)} ` : ''}${client.name || 'Без названия'}`,
                    subtitle: `Контрагент • ${client.status || 'Без статуса'} • Класс ${classValue}${client.phone ? ` • ${client.phone}` : ''}`
                });
            });
        }

        if (canShow('contact')) {
            clients.forEach(client => {
                const contacts = Array.isArray(client.contacts) ? client.contacts : [];
                contacts.forEach((contact, idx) => {
                    const phones = normalizeContactPhones(contact?.phones, contact?.phone || '');
                    const phoneText = phones.map(p => p.value || '').filter(Boolean).join(', ');
                    const primary = contact?.name || contact?.role || phoneText || '';
                    const score = getHeaderSmartSearchItemScore(queryNorm, tokens, primary, [
                        contact?.name || '',
                        contact?.role || '',
                        phoneText,
                        client.name || '',
                        client.phone || '',
                        client.status || '',
                        client.type || ''
                    ]);
                    if (score < 0) return;
                    const contactName = String(contact?.name || '').trim() || 'Контакт без имени';
                    const role = String(contact?.role || '').trim();
                    results.push({
                        kind: 'contact',
                        score: score + 4,
                        id: `${client.id}:${idx}`,
                        clientId: String(client.id || ''),
                        contactIndex: idx,
                        title: `${contactName}${role ? ` (${role})` : ''}`,
                        subtitle: `Контакт • ${client.name || 'Без клиента'}${phoneText ? ` • ${phoneText}` : ''}`
                    });
                });
            });
        }

        if (canShow('task')) {
            history.forEach(item => {
                const taskText = String(item.nextStep || item.desc || '').trim();
                if (!taskText && !String(item.result || '').trim()) return;
                const client = clients.find(c => String(c.id) === String(item.clientId || ''));
                const clientName = client ? client.name : 'Удаленный контрагент';
                const score = getHeaderSmartSearchItemScore(queryNorm, tokens, taskText || item.result || '', [
                    item.type || '',
                    item.result || '',
                    clientName,
                    getExecutionDate(item) || '',
                    getExecutionTime(item) || '',
                    item.taskStatus || ''
                ]);
                if (score < 0) return;
                results.push({
                    kind: 'task',
                    score: score + 12,
                    id: String(item.id || ''),
                    taskId: String(item.id || ''),
                    clientId: String(item.clientId || ''),
                    title: taskText || (item.result ? `Итог: ${item.result}` : 'Задача без текста'),
                    subtitle: `Задача • ${getHeaderSmartSearchStatusLabel(item)} • ${clientName} • ${formatDateTimeRu(getExecutionDate(item), getExecutionTime(item))}`
                });
            });
        }

        return results
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                const byType = (typeOrder[a.kind] ?? 9) - (typeOrder[b.kind] ?? 9);
                if (byType !== 0) return byType;
                return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
            })
            .slice(0, 14);
    }

    function getHeaderSmartSearchScopeLabel(scope) {
        if (scope === 'task') return 'только задачи';
        if (scope === 'client') return 'только контрагенты';
        if (scope === 'contact') return 'только контакты';
        return 'все сущности';
    }

    function renderHeaderSmartSearch() {
        const input = document.getElementById('headerSmartSearchInput');
        const dropdown = document.getElementById('headerSmartSearchDropdown');
        if (!input || !dropdown) return;

        updateHeaderSmartSearchClearBtn();
        const rawValue = String(input.value || '');
        const parsed = parseHeaderSmartSearchQuery(rawValue);
        if (!String(parsed.query || '').trim()) {
            headerSmartSearchResults = [];
            headerSmartSearchActiveIndex = -1;
            dropdown.replaceChildren();
            hideHeaderSmartSearchDropdown();
            return;
        }

        headerSmartSearchResults = buildHeaderSmartSearchResults(rawValue);
        if (headerSmartSearchResults.length === 0) {
            headerSmartSearchActiveIndex = -1;
        } else if (headerSmartSearchActiveIndex < 0 || headerSmartSearchActiveIndex >= headerSmartSearchResults.length) {
            headerSmartSearchActiveIndex = 0;
        }

        dropdown.replaceChildren();

        const head = document.createElement('div');
        head.className = 'header-smart-search-head';
        const left = document.createElement('span');
        left.textContent = `Найдено: ${headerSmartSearchResults.length} (${getHeaderSmartSearchScopeLabel(parsed.scope)})`;
        const right = document.createElement('span');
        right.textContent = '↑↓ Enter Esc';
        head.appendChild(left);
        head.appendChild(right);
        dropdown.appendChild(head);

        if (!headerSmartSearchResults.length) {
            const empty = document.createElement('div');
            empty.className = 'header-smart-search-empty';
            empty.textContent = 'Ничего не найдено. Попробуйте имя, телефон или префикс: задача:, контрагент:, контакт:';
            dropdown.appendChild(empty);
            showHeaderSmartSearchDropdown();
            return;
        }

        const list = document.createElement('div');
        list.className = 'header-smart-search-list';
        headerSmartSearchResults.forEach((result, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `header-smart-search-item ${index === headerSmartSearchActiveIndex ? 'active' : ''}`;
            btn.dataset.action = 'openHeaderSmartSearchResult';
            btn.dataset.index = String(index);

            const top = document.createElement('div');
            top.className = 'header-smart-search-item-top';

            const chip = document.createElement('span');
            chip.className = `header-smart-search-type ${result.kind}`;
            chip.textContent = result.kind === 'task' ? 'Задача' : (result.kind === 'client' ? 'Контрагент' : 'Контакт');

            const title = document.createElement('div');
            title.className = 'header-smart-search-title';
            title.textContent = result.title || '-';

            top.appendChild(chip);
            top.appendChild(title);

            const subtitle = document.createElement('div');
            subtitle.className = 'header-smart-search-subtitle';
            subtitle.textContent = result.subtitle || '';

            btn.appendChild(top);
            btn.appendChild(subtitle);
            list.appendChild(btn);
        });
        dropdown.appendChild(list);
        showHeaderSmartSearchDropdown();
    }

    function setHeaderSmartSearchActiveIndex(nextIndex) {
        if (!headerSmartSearchResults.length) return;
        if (nextIndex < 0) nextIndex = headerSmartSearchResults.length - 1;
        if (nextIndex >= headerSmartSearchResults.length) nextIndex = 0;
        headerSmartSearchActiveIndex = nextIndex;
        renderHeaderSmartSearch();
        const dropdown = document.getElementById('headerSmartSearchDropdown');
        const active = dropdown?.querySelector('.header-smart-search-item.active');
        if (active && typeof active.scrollIntoView === 'function') {
            active.scrollIntoView({ block: 'nearest' });
        }
    }

    function handleHeaderSmartSearchKeydown(e) {
        const hasResults = headerSmartSearchResults.length > 0;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!hasResults) renderHeaderSmartSearch();
            if (headerSmartSearchResults.length) setHeaderSmartSearchActiveIndex(headerSmartSearchActiveIndex + 1);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!hasResults) renderHeaderSmartSearch();
            if (headerSmartSearchResults.length) setHeaderSmartSearchActiveIndex(headerSmartSearchActiveIndex - 1);
            return;
        }
        if (e.key === 'Enter') {
            if (headerSmartSearchActiveIndex >= 0 && headerSmartSearchResults[headerSmartSearchActiveIndex]) {
                e.preventDefault();
                openHeaderSmartSearchResult(headerSmartSearchActiveIndex);
            }
            return;
        }
        if (e.key === 'Escape') {
            hideHeaderSmartSearchDropdown();
        }
    }

    function openHeaderSmartSearchResult(index) {
        const safeIndex = Number.isFinite(index) ? index : -1;
        const item = headerSmartSearchResults[safeIndex];
        if (!item) return;

        const input = document.getElementById('headerSmartSearchInput');
        if (input) input.blur();
        hideHeaderSmartSearchDropdown();

        if (item.kind === 'task' && item.taskId) {
            switchSidebarTab('tasks');
            openTaskView(item.taskId);
            return;
        }

        if ((item.kind === 'client' || item.kind === 'contact') && item.clientId) {
            selectClient(item.clientId);
            if (item.kind === 'contact') {
                const contactsBlock = document.getElementById('detailContactsList');
                if (contactsBlock) {
                    setTimeout(() => {
                        contactsBlock.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    }, 0);
                }
            }
        }
    }

    function bindClientModalValidationLive() {
        ['cName','cAddress','cPhone','cType','cClass','cStatus','cRelated','cNotes'].forEach(id => {
            const el = document.getElementById(id);
            if (!el || el.dataset.fillValidationBound === '1') return;
            const handler = () => {
                renderClientModalValidationState();
                renderClientWizardPanel();
            };
            el.addEventListener('input', handler);
            el.addEventListener('change', handler);
            el.dataset.fillValidationBound = '1';
        });
    }

    function getClientCompletenessCheck(client) {
        const clientName = String(client?.name || '').trim();
        const clientPhone = String(client?.phone || '').trim();
        const contacts = Array.isArray(client?.contacts) ? client.contacts.map((c, idx) => normalizeContact(c, idx)) : [];
        const hasContactName = contacts.some(c => String(c.name || '').trim());
        const hasContactPhone = contacts.some(c => (Array.isArray(c.phones) ? c.phones : []).some(p => String(p?.value || '').trim()));
        const hasPhone = Boolean(clientPhone) || hasContactPhone;
        const hasAddress = Boolean(String(client?.address || '').trim());
        const hasNotes = Boolean(String(client?.notes || '').trim());
        const hasClass = normalizeClientClass(client?.class) !== 'Не указан';
        const rawTypes = Array.isArray(client?.type) ? client.type : [client?.type];
        const hasType = rawTypes
            .map(v => String(v || '').trim())
            .filter(Boolean)
            .some(v => v.toLowerCase() !== 'не указан');

        const items = [
            { key: 'name', label: 'Название', required: true, ok: Boolean(clientName) },
            { key: 'phone_or_contact', label: 'Телефон / канал связи', required: true, ok: hasPhone },
            { key: 'address', label: 'Адрес', required: false, ok: hasAddress },
            { key: 'type', label: 'Тип клиента', required: false, ok: hasType },
            { key: 'class', label: 'Класс ABC', required: false, ok: hasClass },
            { key: 'contact_person', label: 'Контактное лицо', required: false, ok: hasContactName },
            { key: 'notes', label: 'Заметки', required: false, ok: hasNotes }
        ];

        const missingCritical = items.filter(i => i.required && !i.ok);
        const missingRecommended = items.filter(i => !i.required && !i.ok);
        const missingItems = items.filter(i => !i.ok);
        const score = Math.round((items.filter(i => i.ok).length / items.length) * 100);

        return {
            items,
            missingItems,
            missingCritical,
            missingRecommended,
            missingCount: missingItems.length,
            isComplete: missingItems.length === 0,
            score
        };
    }

    function getClientCompletenessStats() {
        const rows = clients.map(c => ({ client: c, check: getClientCompletenessCheck(c) }));
        const incompleteCount = rows.filter(r => !r.check.isComplete).length;
        const criticalCount = rows.filter(r => r.check.missingCritical.length > 0).length;
        return { total: rows.length, incompleteCount, criticalCount };
    }

    function refreshClientCompletenessSummaryUI() {
        const summaryEl = document.getElementById('clientCompletenessSummary');
        const btn = document.getElementById('clientFillWizardBtn');
        if (!summaryEl) return;
        const stats = getClientCompletenessStats();
        if (!stats.total) {
            summaryEl.textContent = 'Клиентов пока нет';
            if (btn) {
                btn.disabled = true;
                btn.textContent = '🧩 Дозаполнить';
            }
            return;
        }
        if (!stats.incompleteCount) {
            summaryEl.textContent = `Все карточки заполнены (${stats.total}/${stats.total})`;
            if (btn) {
                btn.disabled = true;
                btn.textContent = '✅ Заполнено';
            }
            return;
        }
        summaryEl.textContent = `Неполных: ${stats.incompleteCount} из ${stats.total}${stats.criticalCount ? ` · критично: ${stats.criticalCount}` : ''}`;
        if (btn) {
            btn.disabled = false;
            btn.textContent = `🧩 Дозаполнить (${stats.incompleteCount})`;
        }
    }

    function buildClientModalDraftForValidation() {
        const clientModal = document.getElementById('clientModal');
        if (!clientModal) return null;
        return {
            id: document.getElementById('clientId')?.value || '',
            name: document.getElementById('cName')?.value || '',
            address: document.getElementById('cAddress')?.value || '',
            phone: formatPhoneValue(document.getElementById('cPhone')?.value || ''),
            type: typeof getSelectedClientTypes === 'function' ? getSelectedClientTypes() : [],
            class: document.getElementById('cClass')?.value || 'Не указан',
            status: document.getElementById('cStatus')?.value || 'Новый',
            notes: document.getElementById('cNotes')?.value || '',
            contacts: (Array.isArray(modalContacts) ? modalContacts : []).map((c, idx) => normalizeContact(c, idx))
        };
    }

    function setFieldMissingState(id, isMissing) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('card-modal-field-missing', Boolean(isMissing));
    }

    function renderClientModalValidationState() {
        const banner = document.getElementById('clientValidationBanner');
        if (!banner) return;
        const draft = buildClientModalDraftForValidation();
        if (!draft) {
            banner.classList.add('hidden');
            banner.replaceChildren();
            return;
        }

        const check = getClientCompletenessCheck(draft);
        const hasWarnings = check.missingCount > 0;
        banner.classList.remove('hidden', 'warn', 'ok');
        banner.classList.add(hasWarnings ? 'warn' : 'ok');
        banner.replaceChildren();

        const titleRow = document.createElement('div');
        titleRow.className = 'card-completeness-title';
        const titleMain = document.createElement('span');
        titleMain.textContent = hasWarnings ? `Проверка заполнения: ${check.score}%` : 'Карточка заполнена';
        const titleMeta = document.createElement('span');
        titleMeta.style.cssText = `font-size:0.75rem; color:${hasWarnings ? '#a25132' : '#2a7749'};`;
        titleMeta.textContent = hasWarnings ? `Не заполнено: ${check.missingCount}` : 'Все пункты чек-листа заполнены';
        titleRow.appendChild(titleMain);
        titleRow.appendChild(titleMeta);

        const chips = document.createElement('div');
        chips.className = 'card-completeness-list';
        check.items.forEach(item => {
            const chip = document.createElement('span');
            chip.className = `card-completeness-chip ${item.ok ? 'ok' : 'missing'}`;
            chip.textContent = `${item.ok ? '✓' : '•'} ${item.label}${item.required ? ' *' : ''}`;
            chips.appendChild(chip);
        });

        banner.appendChild(titleRow);
        banner.appendChild(chips);

        const missing = new Set(check.missingItems.map(i => i.key));
        setFieldMissingState('cName', missing.has('name'));
        setFieldMissingState('cPhone', missing.has('phone_or_contact'));
        setFieldMissingState('cAddress', missing.has('address'));
        setFieldMissingState('cType', missing.has('type'));
        setFieldMissingState('cClass', missing.has('class'));
        setFieldMissingState('cNotes', missing.has('notes'));
        setFieldMissingState('modalContactsGroup', missing.has('contact_person') || missing.has('phone_or_contact'));
    }

    function getClientFillWizardQueue() {
        return clients
            .map(c => ({ client: c, check: getClientCompletenessCheck(c) }))
            .filter(row => row.check.missingCount > 0)
            .sort((a, b) => {
                const critDiff = b.check.missingCritical.length - a.check.missingCritical.length;
                if (critDiff !== 0) return critDiff;
                const missingDiff = b.check.missingCount - a.check.missingCount;
                if (missingDiff !== 0) return missingDiff;
                return String(a.client.name || '').localeCompare(String(b.client.name || ''));
            })
            .map(row => String(row.client.id));
    }

    function getClientFillWizardCurrentId() {
        if (!clientFillWizardState.active || !clientFillWizardState.queue.length) return '';
        return String(clientFillWizardState.queue[Math.max(0, Math.min(clientFillWizardState.index, clientFillWizardState.queue.length - 1))] || '');
    }

    function startClientFillWizard() {
        const queue = getClientFillWizardQueue();
        if (!queue.length) {
            refreshClientCompletenessSummaryUI();
            return alert('Неполных карточек не найдено.');
        }
        clientFillWizardState = { active: true, queue, index: 0 };
        openClientFillWizardStep(0);
    }

    function stopClientFillWizard(silent = false) {
        clientFillWizardState = { active: false, queue: [], index: 0 };
        renderClientWizardPanel();
        refreshClientCompletenessSummaryUI();
        if (!silent) alert('Режим дозаполнения завершен.');
    }

    function openClientFillWizardStep(index) {
        if (!clientFillWizardState.active) return;
        if (!clientFillWizardState.queue.length) return stopClientFillWizard(true);
        clientFillWizardState.index = Math.max(0, Math.min(index, clientFillWizardState.queue.length - 1));
        const targetId = clientFillWizardState.queue[clientFillWizardState.index];
        if (!targetId) return;
        selectClient(targetId);
        editCurrentClient();
    }

    function clientFillWizardPrev() {
        if (!clientFillWizardState.active) return;
        if (clientFillWizardState.index <= 0) return;
        openClientFillWizardStep(clientFillWizardState.index - 1);
    }

    function clientFillWizardSkip() {
        if (!clientFillWizardState.active) return;
        if (clientFillWizardState.queue.length <= 1) return alert('Это единственная карточка в очереди дозаполнения.');
        const nextIndex = (clientFillWizardState.index + 1) % clientFillWizardState.queue.length;
        openClientFillWizardStep(nextIndex);
    }

    function ensureClientWizardDelegation() {
        const panel = document.getElementById('clientWizardPanel');
        if (!panel || panel.dataset.delegated === '1') return;
        panel.dataset.delegated = '1';
        panel.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-wizard-action]');
            if (!btn || !panel.contains(btn)) return;
            const action = String(btn.dataset.wizardAction || '');
            if (action === 'prev') return clientFillWizardPrev();
            if (action === 'skip') return clientFillWizardSkip();
            if (action === 'stop') return stopClientFillWizard();
        });
    }

    function renderClientWizardPanel() {
        const panel = document.getElementById('clientWizardPanel');
        const saveNextBtn = document.getElementById('clientSaveNextBtn');
        if (!panel || !saveNextBtn) return;
        ensureClientWizardDelegation();

        const modalClientId = String(modalEditingClientId || document.getElementById('clientId')?.value || '');
        const currentWizardId = getClientFillWizardCurrentId();
        const isWizardStep = clientFillWizardState.active && modalClientId && currentWizardId && modalClientId === currentWizardId;

        saveNextBtn.classList.toggle('hidden', !isWizardStep);
        if (!isWizardStep) {
            panel.classList.add('hidden');
            panel.replaceChildren();
            return;
        }

        const draft = buildClientModalDraftForValidation();
        const draftCheck = draft ? getClientCompletenessCheck(draft) : null;
        panel.classList.remove('hidden');
        panel.replaceChildren();

        const head = document.createElement('div');
        head.className = 'client-wizard-head';

        const textWrap = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'client-wizard-title';
        title.textContent = 'Режим дозаполнения карточек';
        const sub = document.createElement('div');
        sub.className = 'client-wizard-sub';
        sub.textContent = `Шаг ${clientFillWizardState.index + 1} из ${clientFillWizardState.queue.length}${draftCheck ? ` · не заполнено: ${draftCheck.missingCount}` : ''}`;
        textWrap.appendChild(title);
        textWrap.appendChild(sub);

        const actions = document.createElement('div');
        actions.className = 'client-wizard-actions';
        const defs = [
            ['prev', 'btn-secondary btn-sm', '◀ Назад'],
            ['skip', 'btn-warning btn-sm', 'Пропустить'],
            ['stop', 'btn-danger btn-sm', 'Завершить']
        ];
        defs.forEach(([action, className, label]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = className;
            btn.dataset.wizardAction = action;
            if (action === 'prev') btn.disabled = clientFillWizardState.index <= 0;
            btn.textContent = label;
            actions.appendChild(btn);
        });

        head.appendChild(textWrap);
        head.appendChild(actions);
        panel.appendChild(head);
    }

    function reconcileClientFillWizardAfterSave(savedClientId, advanceRequested, prevQueue, prevIndex) {
        if (!clientFillWizardState.active) return;
        const freshQueue = getClientFillWizardQueue();
        if (!freshQueue.length) {
            clientFillWizardState = { active: false, queue: [], index: 0 };
            renderClientWizardPanel();
            refreshClientCompletenessSummaryUI();
            alert('Все неполные карточки заполнены. Режим дозаполнения завершен.');
            return;
        }

        clientFillWizardState.queue = freshQueue;
        const savedId = String(savedClientId || '');
        let targetId = '';

        if (advanceRequested) {
            const tail = Array.isArray(prevQueue) ? prevQueue.slice((prevIndex || 0) + 1) : [];
            targetId = tail.find(id => freshQueue.some(x => String(x) === String(id))) || '';
            if (!targetId) targetId = freshQueue[0];
        } else {
            targetId = freshQueue.find(id => String(id) === savedId) || freshQueue[Math.min(prevIndex || 0, freshQueue.length - 1)] || freshQueue[0];
        }

        clientFillWizardState.index = Math.max(0, freshQueue.findIndex(id => String(id) === String(targetId)));
        refreshClientCompletenessSummaryUI();

        if (advanceRequested) setTimeout(() => openClientFillWizardStep(clientFillWizardState.index), 0);
    }

    function saveClientAndNext() {
        saveClient({ advanceWizard: true });
    }

    function ensureClientListDelegation() {
        const list = document.getElementById('clientList');
        if (!list || list.dataset.delegated === '1') return;
        list.dataset.delegated = '1';
        list.addEventListener('click', (e) => {
            const item = e.target.closest('.list-item');
            if (!item || !list.contains(item)) return;
            const clientId = String(item.dataset.clientId || '');
            if (!clientId) return;
            selectClient(clientId);
        });
    }

    function renderClientList() {
        const list = document.getElementById('clientList');
        ensureClientListDelegation();
        const searchInput = document.getElementById('searchClient');
        const search = (searchInput?.value || '').toLowerCase();
        const clearBtn = document.getElementById('searchClearBtn');
        if (clearBtn) clearBtn.style.visibility = search ? 'visible' : 'hidden';
        list.replaceChildren();
        refreshClientCompletenessSummaryUI();
        const clientDealCountMap = new Map();
        deals.forEach((d) => {
            const clientId = String(d?.client_id || '').trim();
            if (!clientId) return;
            clientDealCountMap.set(clientId, (clientDealCountMap.get(clientId) || 0) + 1);
        });

        const sortedClients = clients
            .filter(c => {
                const nameMatch = String(c.name || '').toLowerCase().includes(search);
                if (nameMatch) return true;
                const contacts = Array.isArray(c.contacts) ? c.contacts : [];
                return contacts.some(contact => {
                    const contactName = String(contact.name || '').toLowerCase();
                    const contactRole = String(contact.role || '').toLowerCase();
                    return contactName.includes(search) || contactRole.includes(search);
                });
            })
            .sort((a, b) => {
                if (currentClientSort === 'class') {
                    const byClass = getClientClassSortRank(a.class) - getClientClassSortRank(b.class);
                    if (byClass !== 0) return byClass;
                } else if (currentClientSort === 'recent_task') {
                    const byRecentTask = getClientLatestTaskCreatedAt(b.id) - getClientLatestTaskCreatedAt(a.id);
                    if (byRecentTask !== 0) return byRecentTask;
                }
                return (a.name || '').localeCompare(b.name || '');
            });

        sortedClients.forEach(c => {
            const div = document.createElement('div');
            div.className = `list-item ${String(c.id) === String(currentClientId) ? 'active' : ''}`;
            div.dataset.clientId = String(c.id);
            const typeDisplayValue = formatClientTypes(c.type);
            const typeDisplay = typeDisplayValue ? `(${typeDisplayValue})` : '';
            const classValue = normalizeClientClass(c.class);
            const classIcon = getClientClassIcon(classValue);
            const classPrefix = classIcon ? `${classIcon} ` : '';
            const completeness = getClientCompletenessCheck(c);
            const badge = completeness.isComplete
                ? { cls: 'client-complete-badge', text: '✓ заполнено' }
                : { cls: 'client-incomplete-badge', text: `⚠ ${completeness.missingCount}${completeness.missingCritical.length ? ` / критично ${completeness.missingCritical.length}` : ''}` };

            const head = document.createElement('div');
            head.style.cssText = 'display:flex; justify-content:space-between; align-items:flex-start; gap:8px;';

            const name = document.createElement('div');
            name.style.cssText = 'font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            name.textContent = `${classPrefix}${c.name || 'Без названия'}`;

            const badgeEl = document.createElement('span');
            badgeEl.className = badge.cls;
            badgeEl.textContent = badge.text;

            head.appendChild(name);
            head.appendChild(badgeEl);

            const meta = document.createElement('div');
            meta.style.cssText = 'font-size:0.75rem; color:#7f8c8d';
            const dealCount = clientDealCountMap.get(String(c.id)) || 0;
            const dealsText = dealCount > 0 ? `🏷 Сделок: ${dealCount}` : 'Сделок: 0';
            meta.textContent = `${c.status || ''} ${typeDisplay} | Класс ${classValue} | ${dealsText}`;

            div.appendChild(head);
            div.appendChild(meta);
            list.appendChild(div);
        });
    }

    function selectClient(id, keepSidebarTab = false) {
        currentClientId = id;
        if(!keepSidebarTab && currentSidebarTab !== 'clients') switchSidebarTab('clients');
        renderClientList();
        renderClientDetails(id);
    }

    function renderRelatedClientPicker() {
        const searchInput = document.getElementById('relatedClientSearch');
        const select = document.getElementById('relatedClientSelect');
        if (!searchInput || !select) return;
        const q = String(searchInput.value || '').trim().toLowerCase();
        const excludeId = String(modalEditingClientId || '');
        const selectedSet = new Set(modalRelatedClientIds.map(v => String(v)));
        const options = clients
            .filter(c => String(c.id) !== excludeId)
            .filter(c => !selectedSet.has(String(c.id)))
            .filter(c => !q || String(c.name || '').toLowerCase().includes(q))
            .sort((a,b) => String(a.name || '').localeCompare(String(b.name || '')));
        select.replaceChildren();
        options.forEach(c => {
            const opt = document.createElement('option');
            opt.value = String(c.id);
            const icon = getClientClassIcon(c.class);
            opt.textContent = `${icon ? `${icon} ` : ''}${c.name || 'Без названия'}`;
            select.appendChild(opt);
        });
    }

    function ensureRelatedClientsDelegation() {
        const wrap = document.getElementById('relatedClientSelected');
        if (!wrap || wrap.dataset.delegated === '1') return;
        wrap.dataset.delegated = '1';
        wrap.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-related-action]');
            if (!btn || !wrap.contains(btn)) return;
            const action = String(btn.dataset.relatedAction || '');
            const id = String(btn.dataset.relatedId || '');
            if (action === 'remove' && id) removeRelatedClient(id);
        });
    }

    function renderSelectedRelatedClients() {
        const wrap = document.getElementById('relatedClientSelected');
        if (!wrap) return;
        ensureRelatedClientsDelegation();
        wrap.replaceChildren();
        if (!modalRelatedClientIds.length) {
            const empty = document.createElement('span');
            empty.style.cssText = 'font-size:0.78rem; color:#777;';
            empty.textContent = 'Нет выбранных связей';
            wrap.appendChild(empty);
            return;
        }
        modalRelatedClientIds.forEach(id => {
            const c = clients.find(x => String(x.id) === String(id));
            if (!c) return;
            const chip = document.createElement('div');
            chip.style.cssText = 'display:flex; align-items:center; gap:6px; background:#eef5ff; border:1px solid #cfe0ff; color:#224; border-radius:999px; padding:3px 8px; font-size:0.78rem;';
            const icon = getClientClassIcon(c.class);
            const text = document.createElement('span');
            text.textContent = `${icon ? `${icon} ` : ''}${c.name}`;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-icon delete';
            btn.style.cssText = 'padding:0 2px; font-size:0.85rem;';
            btn.dataset.relatedAction = 'remove';
            btn.dataset.relatedId = String(c.id);
            btn.textContent = '×';
            chip.appendChild(text);
            chip.appendChild(btn);
            wrap.appendChild(chip);
        });
    }

    function addSelectedRelatedClient() {
        const select = document.getElementById('relatedClientSelect');
        if (!select || !select.value) return;
        const id = String(select.value);
        if (!modalRelatedClientIds.some(v => String(v) === id)) modalRelatedClientIds.push(id);
        renderSelectedRelatedClients();
        renderRelatedClientPicker();
    }

    function removeRelatedClient(id) {
        modalRelatedClientIds = modalRelatedClientIds.filter(v => String(v) !== String(id));
        renderSelectedRelatedClients();
        renderRelatedClientPicker();
    }

    function ensureDetailRelatedDelegation() {
        const detailRelated = document.getElementById('detailRelated');
        if (!detailRelated || detailRelated.dataset.delegated === '1') return;
        detailRelated.dataset.delegated = '1';
        detailRelated.addEventListener('click', (e) => {
            const link = e.target.closest('[data-related-client-id]');
            if (!link || !detailRelated.contains(link)) return;
            const id = String(link.dataset.relatedClientId || '');
            if (id) selectClient(id);
        });
    }

    function renderClientDetails(id) {
        const client = clients.find(c => String(c.id) === String(id));
        if (!client) return;

        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('clientDetails').classList.remove('hidden');

        document.getElementById('detailName').innerText = client.name;
        document.getElementById('detailAddress').innerText = client.address || '-';
        const mainPhone = String(client.phone || '').trim() || getMainClientPhoneFromContacts(client.contacts || []);
        document.getElementById('detailPhone').innerText = mainPhone || '-';
        document.getElementById('detailStatus').innerText = client.status || 'Новый';
        const typeText = formatClientTypes(client.type);
        document.getElementById('detailType').innerText = typeText || '';
        document.getElementById('detailType').style.display = typeText ? 'inline-block' : 'none';
        const classValue = normalizeClientClass(client.class);
        const classIcon = getClientClassIcon(classValue);
        document.getElementById('detailClass').innerText = `${classIcon ? `${classIcon} ` : ''}Класс ${classValue}`;
        document.getElementById('detailClass').style.display = 'inline-block';
        
        const relatedText = String(client.related || '').trim();
        const directRelated = normalizeRelatedClientIds(client.relatedClientIds)
            .map(idVal => clients.find(c => String(c.id) === String(idVal)))
            .filter(Boolean);
        const backRelated = clients
            .filter(c => String(c.id) !== String(client.id))
            .filter(c => normalizeRelatedClientIds(c.relatedClientIds).some(idVal => String(idVal) === String(client.id)));

        const detailRelated = document.getElementById('detailRelated');
        detailRelated.replaceChildren();
        const buildClientLinkNode = (clientItem) => {
            const link = document.createElement('span');
            link.className = 'task-client-link';
            link.dataset.relatedClientId = String(clientItem.id || '');
            const icon = getClientClassIcon(clientItem.class);
            link.textContent = `${icon ? `${icon} ` : ''}${clientItem.name || 'Без названия'}`;
            return link;
        };
        const appendLine = (labelText, contentBuilder) => {
            const line = document.createElement('div');
            const strong = document.createElement('strong');
            strong.textContent = `${labelText}:`;
            line.appendChild(strong);
            line.appendChild(document.createTextNode(' '));
            contentBuilder(line);
            detailRelated.appendChild(line);
        };

        if (relatedText) {
            appendLine('Текст', (line) => {
                line.appendChild(document.createTextNode(relatedText));
            });
        }
        if (directRelated.length) {
            appendLine('Связанные', (line) => {
                directRelated.forEach((item, idx) => {
                    if (idx > 0) line.appendChild(document.createTextNode(', '));
                    line.appendChild(buildClientLinkNode(item));
                });
            });
        }
        if (backRelated.length) {
            appendLine('Ссылаются на этого', (line) => {
                backRelated.forEach((item, idx) => {
                    if (idx > 0) line.appendChild(document.createTextNode(', '));
                    line.appendChild(buildClientLinkNode(item));
                });
            });
        }
        if (!detailRelated.childNodes.length) {
            detailRelated.textContent = '-';
        }
        ensureDetailRelatedDelegation();
        document.getElementById('detailRelatedBlock').style.display = detailRelated.textContent === '-' ? 'none' : 'block';
        document.getElementById('detailNotes').innerText = client.notes || '-';

        renderContacts(client);
        renderTasks(id);
        renderClientDealsList(id);
        renderHistoryList(id);
        updateClientContentTabCounts(id);
        switchContentTab(currentContentTab);
    }

    // --- GLOBAL TASKS RENDER ---
    function ensureGlobalTasksListDelegation() {
        const list = document.getElementById('globalTasksList');
        if (!list || list.dataset.delegated === '1') return;
        list.dataset.delegated = '1';
        list.addEventListener('click', (e) => {
            const item = e.target.closest('.task-item-mini');
            if (!item || !list.contains(item)) return;
            const taskId = String(item.dataset.taskId || '');
            if (!taskId) return;

            const actionBtn = e.target.closest('[data-task-action]');
            if (actionBtn && item.contains(actionBtn)) {
                const action = String(actionBtn.dataset.taskAction || '');
                if (action === 'done') {
                    if (actionBtn.disabled) return;
                    startTaskCompletionFlow(taskId);
                    return;
                }
                if (action === 'edit') {
                    editHistoryItem(taskId);
                    return;
                }
                if (action === 'deal') {
                    openDealLinkedToTask(taskId, true);
                    return;
                }
                if (action === 'reschedule') {
                    if (actionBtn.disabled) return;
                    openRescheduleTaskModal(taskId);
                    return;
                }
                if (action === 'delete') {
                    deleteTask(taskId);
                    return;
                }
            }

            openTaskView(taskId);
        });
    }

    function renderGlobalTasks() {
        const list = document.getElementById('globalTasksList');
        ensureGlobalTasksListDelegation();
        list.replaceChildren();
        const today = new Date().toISOString().split('T')[0];
        const statusSelect = document.getElementById('globalTaskStatusFilter');
        const dateInput = document.getElementById('globalTaskDateFilter');
        const sortSelect = document.getElementById('globalTaskSort');
        if (statusSelect && statusSelect.value !== currentGlobalTaskStatusFilter) statusSelect.value = currentGlobalTaskStatusFilter;
        if (dateInput && dateInput.value !== currentGlobalTaskDateFilter) dateInput.value = currentGlobalTaskDateFilter;
        if (sortSelect && sortSelect.value !== currentGlobalTaskSort) sortSelect.value = currentGlobalTaskSort;
        
        let filteredHistory = [];
        
        if (currentTaskFilter === 'active') {
            filteredHistory = history.filter(h => h.nextStep && h.nextStep.trim() !== "" && (h.taskStatus === 'new' || h.taskStatus === 'work'));
        } else if (currentTaskFilter === 'done') {
            filteredHistory = history.filter(h => h.taskStatus === 'done');
        } else {
            filteredHistory = history.filter(h => h.nextStep && h.nextStep.trim() !== "");
        }

        if (currentGlobalTaskStatusFilter !== 'all') {
            filteredHistory = filteredHistory.filter(h => String(h.taskStatus || 'new') === currentGlobalTaskStatusFilter);
        }

        if (currentGlobalTaskDateFilter) {
            filteredHistory = filteredHistory.filter(h => getExecutionDate(h) === currentGlobalTaskDateFilter);
        }

        filteredHistory.sort((a,b) => {
            if (currentGlobalTaskSort === 'temp_desc' || currentGlobalTaskSort === 'temp_asc') {
                const at = clamp(refreshWorkItemTempState(a, new Date())?.temp ?? 0, 0, 100);
                const bt = clamp(refreshWorkItemTempState(b, new Date())?.temp ?? 0, 0, 100);
                const byTemp = currentGlobalTaskSort === 'temp_desc' ? (bt - at) : (at - bt);
                if (byTemp !== 0) return byTemp;
            }

            const ad = getExecutionDate(a) || '';
            const bd = getExecutionDate(b) || '';
            if (!ad) return 1;
            if (!bd) return -1;
            const byDate = ad.localeCompare(bd);
            if (byDate !== 0) return byDate;
            return (getExecutionTime(a) || '').localeCompare(getExecutionTime(b) || '');
        });
        
        document.getElementById('taskCountBadge').innerText = filteredHistory.length;

        if(filteredHistory.length === 0) {
            let msg = "✅ Задач нет!";
            if(currentTaskFilter === 'done') msg = "Нет выполненных задач.";
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:20px; text-align:center; color:#999; font-size:0.9rem;';
            empty.textContent = msg;
            list.appendChild(empty);
            return;
        }

        filteredHistory.forEach(t => {
            refreshWorkItemTempState(t);
            const client = clients.find(c => String(c.id) === String(t.clientId));
            const contactPerson = getTaskContactPersonLabel(t, client);
            const clientName = client ? client.name : 'Удаленный клиент';
            const clientClassIcon = client ? getClientClassIcon(client.class) : '';
            const timeState = getTaskTimeState(t);
            const isOverdue = timeState === 'overdue';
            const isToday = timeState === 'today';
            const isFuture = timeState === 'future';
            const isDone = t.taskStatus === 'done';
            const workflow = getTaskWorkflowStatusMeta(t);
            const taskId = String(t.id || '');
            
            const div = document.createElement('div');
            div.className = `task-item-mini ${isDone ? 'done' : (isOverdue ? 'overdue' : (isToday ? 'today' : (isFuture ? 'future' : '')))}`;
            div.dataset.taskId = taskId;

            let statusBadge = isDone ? '✅ Выполнена' : (t.taskStatus === 'work' ? '🟡 В работе' : '🔵 Новая');
            if(isOverdue && !isDone) statusBadge = '🔴 Просрочено';
            if(isToday && !isDone) statusBadge = '🟢 Сегодня';
            if(isFuture && !isDone) statusBadge = '🔵 Будущая';

            let dateDisplay = formatDateTimeRu(t.nextDate, t.nextTime);
            if (isDone) dateDisplay = formatDateTimeRu(getExecutionDate(t), getExecutionTime(t));

            const dateRow = document.createElement('div');
            dateRow.className = 'task-date';
            const dateSpan = document.createElement('span');
            dateSpan.textContent = dateDisplay;
            const statusSpan = document.createElement('span');
            statusSpan.textContent = statusBadge;
            dateRow.appendChild(dateSpan);
            dateRow.appendChild(statusSpan);

            const clientEl = document.createElement('div');
            clientEl.className = 'task-client';
            clientEl.title = `Статус задачи: ${workflow.label}`;
            clientEl.textContent = `${workflow.icon} ${clientClassIcon ? `${clientClassIcon} ` : ''}${clientName}`;

            const desc = document.createElement('div');
            desc.className = 'task-desc';
            desc.textContent = t.nextStep || '';
            const createdMeta = document.createElement('div');
            createdMeta.className = 'task-created-meta';
            createdMeta.textContent = getTaskCreatedDateLabel(t);
            const dealBadge = createTaskDealBadge(t);
            const contactEl = document.createElement('div');
            contactEl.className = 'task-contact-mini';
            if (contactPerson) contactEl.textContent = `👤 ${contactPerson}`;

            const tempMeta = document.createElement('div');
            tempMeta.style.cssText = 'display:flex; align-items:center; gap:6px; margin-top:5px;';
            tempMeta.appendChild(createTempBadgeElement(t));
            tempMeta.appendChild(createTempScaleElement(t, new Date(), true));

            const tempReason = document.createElement('div');
            tempReason.style.cssText = 'font-size:0.72rem; color:#647789; margin-top:4px;';
            tempReason.textContent = getTempReason(t, new Date());

            const actions = document.createElement('div');
            actions.className = 'task-actions';
            const hasLinkedDeal = Boolean(getLinkedDealForTask(t));
            const buttonDefs = [
                ['done', 'task-action-btn done', 'Выполнено', true],
                ['deal', 'task-action-btn deal', hasLinkedDeal ? 'Открыть сделку' : 'Создать сделку', false],
                ['reschedule', 'task-action-btn reschedule', 'Перенести', true],
                ['edit', 'task-action-btn edit', 'Редактировать', false],
                ['delete', 'task-action-btn delete', 'Удалить', false]
            ];
            buttonDefs.forEach(([action, className, label, disableWhenDone]) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = className;
                btn.dataset.taskAction = action;
                if (disableWhenDone && isDone) btn.disabled = true;
                btn.textContent = label;
                actions.appendChild(btn);
            });

            div.appendChild(dateRow);
            div.appendChild(clientEl);
            div.appendChild(desc);
            div.appendChild(createdMeta);
            if (dealBadge) div.appendChild(dealBadge);
            if (contactPerson) div.appendChild(contactEl);
            div.appendChild(tempMeta);
            div.appendChild(tempReason);
            div.appendChild(actions);
            list.appendChild(div);
        });
    }

    function markTaskDone(id, completionResult = '', skipConfirm = false) {
        if(!skipConfirm && !confirm('Отметить задачу как выполненную?')) return;
        const idx = history.findIndex(h => String(h.id) === String(id));
        if(idx !== -1) {
            const touchedTs = Date.now();
            refreshWorkItemTempState(history[idx]);
            const sourceDate = history[idx].nextDate || history[idx].date || '';
            const sourceTime = history[idx].nextTime || history[idx].time || '';
            const completion = getCompletionByTaskMoment(sourceDate, sourceTime);
            if (String(completionResult || '').trim()) {
                history[idx].result = String(completionResult).trim();
            }
            history[idx].taskStatus = 'done';
            history[idx].completedDate = completion.finalDate;
            history[idx].completedTime = completion.finalTime;
            history[idx].completedAt = completion.finalIso;
            history[idx].modifiedAt = touchedTs;
            history[idx].status = 'won';
            applyEvent(history[idx], {
                type: 'DECISION_MADE',
                at: completion.finalIso,
                meta: { status: 'won' },
                comment: 'Задача закрыта как выполненная'
            });
            touchClientTaskActivity(history[idx].clientId, touchedTs);
            setClientLastContact(history[idx].clientId, touchedTs);
            markClientCalledToday(history[idx].clientId, touchedTs);
            if (callSessionState.active && currentSidebarTab === 'calls') callSessionState.done += 1;
            saveData();
        }
    }

    function deleteTask(id) {
        if(!confirm('Удалить задачу?')) return;
        const task = history.find(h => String(h.id) === String(id));
        if (task) touchClientTaskActivity(task.clientId, Date.now());
        history = history.filter(h => String(h.id) !== String(id));
        rebuildClientLastContactCache();
        saveData();
        closeModal('taskViewModal');
    }

    function deleteHistoryItem(id) {
        if(!confirm('Удалить запись из истории?')) return;
        const item = history.find(h => String(h.id) === String(id));
        if (item) touchClientTaskActivity(item.clientId, Date.now());
        history = history.filter(h => String(h.id) !== String(id));
        rebuildClientLastContactCache();
        saveData();
    }

    function openTaskInMainView(id) {
        const task = history.find(h => String(h.id) === String(id));
        if(!task || !task.clientId) return;
        closeModal('taskViewModal');
        selectClient(task.clientId, true);
        switchContentTab('tasks');
    }

    function openTaskView(id) {
        const task = history.find(h => String(h.id) === String(id));
        if(!task) return;
        refreshWorkItemTempState(task);
        const client = clients.find(c => String(c.id) === String(task.clientId));
        const isDone = task.taskStatus === 'done';
        const prevResult = getPreviousContactResult(task);

        document.getElementById('tvTaskId').value = task.id;
        document.getElementById('tvClientId').value = task.clientId || '';
        document.getElementById('tvClientName').innerText = client ? client.name : 'Удаленный контрагент';
        document.getElementById('tvNextDateTime').innerText = formatDateTimeRu(getExecutionDate(task), getExecutionTime(task));
        document.getElementById('tvType').innerText = task.type || '-';
        document.getElementById('tvContactPerson').innerText = getTaskContactPersonLabel(task, client) || '-';
        document.getElementById('tvResult').innerText = prevResult || '-';
        const taskTopicText = String(task.nextStep || task.desc || '-');
        document.getElementById('tvDesc').innerText = taskTopicText;
        const tvCreatedAt = document.getElementById('tvCreatedAt');
        if (tvCreatedAt) tvCreatedAt.innerText = getTaskCreatedDateLabel(task);
        const tvDescEdit = document.getElementById('tvDescEdit');
        if (tvDescEdit) tvDescEdit.value = taskTopicText === '-' ? '' : taskTopicText;

        let statusText = 'Новая';
        if(task.taskStatus === 'work') statusText = 'В работе';
        if(isDone) statusText = 'Выполнена';
        document.getElementById('tvStatus').innerText = statusText;

        const doneBtn = document.getElementById('tvDoneBtn');
        doneBtn.disabled = isDone;
        doneBtn.innerText = 'Выполнено';
        const dealBtn = document.getElementById('tvDealBtn');
        if (dealBtn) {
            const hasDeal = Boolean(getLinkedDealForTask(task));
            dealBtn.disabled = false;
            dealBtn.textContent = hasDeal ? 'Открыть сделку' : 'Создать сделку';
        }
        taskViewDoneConfirmMode = false;
        document.getElementById('tvDoneResultWrap').classList.add('hidden');
        document.getElementById('tvDoneResultInput').value = String(task.result || '').trim();
        document.getElementById('tvProgressPanel')?.classList.add('hidden');
        setTaskViewProgressDraftMode(false);
        renderTaskViewHeat(task);

        showModalOnTop('taskViewModal');
    }

    function startTaskCompletionFlow(id, returnStatKind = '') {
        taskViewReturnStatKind = returnStatKind || '';
        if (taskViewReturnStatKind) closeModal('statsModal');
        openTaskView(id);
        if (document.getElementById('tvDoneBtn')?.disabled) return;
        taskViewDoneConfirmMode = true;
        document.getElementById('tvDoneResultWrap').classList.remove('hidden');
        document.getElementById('tvDoneBtn').innerText = 'Сохранить итог и выполнить';
        const input = document.getElementById('tvDoneResultInput');
        if (input) input.focus();
    }

    function getPreviousContactResult(task) {
        const currentMoment = getTaskMoment(task);
        const clientItems = history
            .filter(h =>
                String(h.clientId) === String(task.clientId) &&
                String(h.id) !== String(task.id) &&
                h.taskStatus === 'done'
            )
            .sort((a, b) => {
                const am = getTaskMoment(a);
                const bm = getTaskMoment(b);
                const at = am ? am.getTime() : 0;
                const bt = bm ? bm.getTime() : 0;
                return bt - at;
            });

        for (const item of clientItems) {
            const itemMoment = getTaskMoment(item);
            if (itemMoment && currentMoment && itemMoment < currentMoment && (item.result || '').trim()) {
                return item.result.trim();
            }
        }
        return '';
    }

    function markTaskDoneFromModal() {
        const id = document.getElementById('tvTaskId').value;
        if(!id) return;
        const wrap = document.getElementById('tvDoneResultWrap');
        const input = document.getElementById('tvDoneResultInput');
        const clientId = document.getElementById('tvClientId').value;

        if (!taskViewDoneConfirmMode) {
            taskViewDoneConfirmMode = true;
            wrap.classList.remove('hidden');
            document.getElementById('tvDoneBtn').innerText = 'Сохранить итог и выполнить';
            input.focus();
            return;
        }

        const completionResult = String(input.value || '').trim();
        if (!completionResult) {
            alert('Заполните итог выполнения задачи.');
            input.focus();
            return;
        }

        markTaskDone(id, completionResult, true);
        taskViewDoneConfirmMode = false;
        const shouldCreateNext = confirm('Создать следующую задачу для этого контрагента?');
        if (shouldCreateNext && clientId) {
            taskViewReturnStatKind = '';
            closeModal('taskViewModal');
            openNewTaskModalForClient(clientId);
            return;
        }

        if (taskViewReturnStatKind) {
            const kind = taskViewReturnStatKind;
            taskViewReturnStatKind = '';
            closeModal('taskViewModal');
            openStatModal(kind);
            return;
        }

        openTaskView(id);
    }

    function cancelMarkTaskDoneFromModal() {
        taskViewDoneConfirmMode = false;
        taskViewReturnStatKind = '';
        document.getElementById('tvDoneResultWrap').classList.add('hidden');
        const id = document.getElementById('tvTaskId').value;
        const task = history.find(h => String(h.id) === String(id));
        document.getElementById('tvDoneResultInput').value = task ? String(task.result || '').trim() : '';
        document.getElementById('tvDoneBtn').innerText = 'Выполнено';
    }

    function toggleTaskViewProgressPanel() {
        const panel = document.getElementById('tvProgressPanel');
        if (!panel) return;
        panel.classList.toggle('hidden');
    }

    function taskViewOpenReschedule() {
        const taskId = document.getElementById('tvTaskId')?.value;
        if (!taskId) return;
        configureRescheduleTaskModal(taskId, 'POSTPONE', 'Ручной перенос срока', 'Перенести срок задачи');
    }

    function taskViewOpenNoAnswerReschedule() {
        const taskId = document.getElementById('tvTaskId')?.value;
        if (!taskId) return;
        configureRescheduleTaskModal(taskId, 'CALL_NO_ANSWER', 'Не дозвонился', 'Не дозвонился: перенести задачу');
    }

    function taskViewAddProgressEvent(progressType) {
        const taskId = document.getElementById('tvTaskId')?.value;
        if (!taskId || !progressType) return;
        const task = history.find(h => String(h.id) === String(taskId));
        if (!task) return;
        if (task.taskStatus === 'done') return alert('Для выполненной задачи шаги не добавляются.');
        setTaskViewProgressDraftMode(true, progressType);
    }

    function cancelTaskViewProgressDraft() {
        setTaskViewProgressDraftMode(false);
    }

    function saveTaskViewProgressDraft() {
        const taskId = document.getElementById('tvTaskId')?.value;
        const progressType = String(taskViewPendingProgressType || '').trim();
        const descEdit = document.getElementById('tvDescEdit');
        if (!taskId || !progressType || !descEdit) return;

        const idx = history.findIndex(h => String(h.id) === String(taskId));
        if (idx === -1) return;
        const task = history[idx];
        if (String(task.taskStatus || '') === 'done') return alert('Для выполненной задачи шаги не добавляются.');

        const draftText = String(descEdit.value || '').trim();
        if (!draftText) {
            descEdit.focus();
            return alert('Заполните тему задачи (подробности шага), затем сохраните.');
        }

        refreshWorkItemTempState(task);
        task.nextStep = draftText;
        if (!String(task.desc || '').trim()) task.desc = draftText;

        const label = getTaskEventTypeLabel(progressType);
        const result = applyProgress(task, progressType, `Шаг: ${label}. ${draftText}`, new Date());
        task.modifiedAt = Date.now();
        touchClientTaskActivity(task.clientId, task.modifiedAt);
        rebuildClientLastContactCache();
        saveData();

        if (result && result.applied === false && result.reason === 'cooldown') {
            alert('Тема сохранена. Это событие уже учитывалось сегодня, поэтому охлаждение не начислено.');
        }
        openTaskView(taskId);
    }

    function taskViewPostponeQuick(kind) {
        const taskId = document.getElementById('tvTaskId')?.value;
        if (!taskId) return;
        const task = history.find(h => String(h.id) === String(taskId));
        if (!task) return;
        if (task.taskStatus === 'done') return alert('Выполненную задачу переносить нельзя.');
        const base = getTaskDueDateTime(task);
        const dt = new Date(base);
        let reason = '';
        if (kind === '30m') {
            dt.setMinutes(dt.getMinutes() + 30);
            reason = 'Отложено из просмотра: +30 мин';
        } else if (kind === 'tomorrow') {
            dt.setDate(dt.getDate() + 1);
            reason = 'Отложено из просмотра: на завтра';
        } else if (kind === 'week') {
            dt.setDate(dt.getDate() + 7);
            reason = 'Отложено из просмотра: на неделю';
        } else {
            return;
        }
        if (!postponeTaskWithTemp(taskId, dt, reason)) return;
        saveData();
        openTaskView(taskId);
    }

    function editTaskFromModal() {
        const id = document.getElementById('tvTaskId').value;
        if(!id) return;
        closeModal('taskViewModal');
        editHistoryItem(id);
    }

    function createDealFromTaskModal() {
        const id = document.getElementById('tvTaskId').value;
        if(!id) return;
        closeModal('taskViewModal');
        openDealLinkedToTask(id, true);
    }

    function deleteTaskFromModal() {
        const id = document.getElementById('tvTaskId').value;
        if(!id) return;
        deleteTask(id);
    }

    function openTaskClientFromModal() {
        const clientId = document.getElementById('tvClientId').value;
        if(!clientId) return;
        closeModal('taskViewModal');
        selectClient(clientId);
        switchContentTab('tasks');
    }

    // --- CONTACTS LOGIC ---
    function renderContacts(client) {
        const container = document.getElementById('detailContactsList');
        if (!container) return;
        container.replaceChildren();
        const contacts = Array.isArray(client.contacts) ? client.contacts.map((contact, idx) => normalizeContact(contact, idx)) : [];
        if (contacts.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:#999; font-style:italic; padding:5px; font-size:0.85rem;';
            empty.textContent = 'Нет контактов';
            container.appendChild(empty);
            return;
        }

        const buildCol = (label, valueNode, extraClass = '') => {
            const col = document.createElement('div');
            col.className = extraClass ? `contact-col ${extraClass}` : 'contact-col';
            const strong = document.createElement('strong');
            strong.textContent = `${label}:`;
            col.appendChild(strong);
            if (valueNode instanceof Node) {
                col.appendChild(valueNode);
            } else {
                col.appendChild(document.createTextNode(String(valueNode)));
            }
            return col;
        };

        contacts.forEach((contact) => {
            const phones = normalizeContactPhones(contact.phones, contact.phone || '');
            const row = document.createElement('div');
            row.className = 'contact-row view';

            const phoneContent = phones.length ? (() => {
                const list = document.createElement('div');
                list.className = 'contact-phone-list';
                phones.forEach((phone) => {
                    const item = document.createElement('div');
                    item.className = 'contact-phone-item';

                    const labels = document.createElement('span');
                    labels.style.cssText = 'color:#556; font-size:0.78rem;';
                    labels.textContent = `${formatPhoneLabels(phone.labels)}:`;
                    item.appendChild(labels);
                    item.appendChild(document.createTextNode(` ${phone.value}`));

                    list.appendChild(item);
                });
                return list;
            })() : '-';

            row.appendChild(buildCol('Роль', contact.role || '-'));
            row.appendChild(buildCol('Имя', contact.name || '-'));
            row.appendChild(buildCol('Тел', phoneContent, 'phones'));
            container.appendChild(row);
        });
    }

    function addContactRow() {
        const client = clients.find(c => String(c.id) === String(currentClientId));
        if(!client) return;
        if(!client.contacts) client.contacts = [];
        client.contacts.push({ name: '', phone: '', role: '' });
        saveData();
    }

    function removeContact(index) {
        if(!confirm('Удалить контакт?')) return;
        const client = clients.find(c => String(c.id) === String(currentClientId));
        if(client && client.contacts) {
            client.contacts.splice(index, 1);
            saveData();
        }
    }

    function updateContact(index, field, value) {
        const client = clients.find(c => String(c.id) === String(currentClientId));
        if(client && client.contacts && client.contacts[index]) {
            client.contacts[index][field] = field === 'phone' ? formatPhoneValue(value) : value;
            writeStateToLocalStorage();
            markDatabaseDirty();
        }
    }

    // --- MODAL CONTACTS LOGIC ---
    function addModalContact() {
        const shouldAutoPrimary = modalContacts.length === 0;
        modalContacts.push(normalizeContact({
            role: '',
            name: '',
            isPrimaryForClient: shouldAutoPrimary,
            phones: [{ labels: ['сотовый'], value: '' }]
        }, modalContacts.length));
        renderModalContacts();
    }
    function removeModalContact(index) {
        modalContacts.splice(index, 1);
        if (modalContacts.length === 1) modalContacts[0].isPrimaryForClient = true;
        renderModalContacts();
    }
    function updateModalContact(index, field, value) {
        if (!modalContacts[index]) return;
        modalContacts[index][field] = String(value || '').trim();
        renderModalContacts();
    }
    function setModalContactPrimary(index, checked) {
        modalContacts.forEach((contact, idx) => {
            contact.isPrimaryForClient = checked ? idx === index : false;
        });
        renderModalContacts();
    }
    function toggleModalContactPrimary(index) {
        const isActive = Boolean(modalContacts[index] && modalContacts[index].isPrimaryForClient);
        setModalContactPrimary(index, !isActive);
    }
    function addModalContactPhone(contactIndex) {
        if (!modalContacts[contactIndex]) return;
        if (!Array.isArray(modalContacts[contactIndex].phones)) modalContacts[contactIndex].phones = [];
        modalContacts[contactIndex].phones.push({ labels: ['сотовый'], value: '' });
        renderModalContacts();
    }
    function removeModalContactPhone(contactIndex, phoneIndex) {
        if (!modalContacts[contactIndex] || !Array.isArray(modalContacts[contactIndex].phones)) return;
        modalContacts[contactIndex].phones.splice(phoneIndex, 1);
        renderModalContacts();
    }
    function updateModalContactPhone(contactIndex, phoneIndex, field, value) {
        const contact = modalContacts[contactIndex];
        if (!contact) return;
        if (!Array.isArray(contact.phones)) contact.phones = [];
        if (!contact.phones[phoneIndex]) contact.phones[phoneIndex] = { labels: ['сотовый'], value: '' };
        if (field === 'toggleLabel') {
            const currentLabels = contact.phones[phoneIndex].labels || ['сотовый'];
            contact.phones[phoneIndex].labels = togglePhoneLabel(currentLabels, value.label, value.checked);
            const current = contact.phones[phoneIndex].value || '';
            contact.phones[phoneIndex].value = normalizeContactPhoneValue(contact.phones[phoneIndex].labels, current);
        } else {
            const labels = contact.phones[phoneIndex].labels || ['сотовый'];
            contact.phones[phoneIndex].value = normalizeContactPhoneValue(labels, value);
        }
        renderModalContacts();
    }

    function ensureModalContactsDelegation() {
        const container = document.getElementById('modalContactsList');
        if (!container || container.dataset.delegated === '1') return;
        container.dataset.delegated = '1';
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-mc-action]');
            if (!btn || !container.contains(btn)) return;
            const action = String(btn.dataset.mcAction || '');
            const index = parseInt(btn.dataset.index, 10);
            const phoneIndex = parseInt(btn.dataset.phoneIndex, 10);
            if (!action || Number.isNaN(index)) return;
            if (action === 'toggle-primary') return toggleModalContactPrimary(index);
            if (action === 'remove-contact') return removeModalContact(index);
            if (action === 'add-phone') return addModalContactPhone(index);
            if (action === 'remove-phone' && !Number.isNaN(phoneIndex)) return removeModalContactPhone(index, phoneIndex);
        });
        container.addEventListener('change', (e) => {
            const target = e.target;
            if (!container.contains(target)) return;
            const field = target.dataset.mcField;
            if (field) {
                const index = parseInt(target.dataset.index, 10);
                if (Number.isNaN(index)) return;
                return updateModalContact(index, field, target.value);
            }
            const phoneAction = target.dataset.mcPhoneAction;
            if (phoneAction) {
                const index = parseInt(target.dataset.index, 10);
                const phoneIndex = parseInt(target.dataset.phoneIndex, 10);
                if (Number.isNaN(index) || Number.isNaN(phoneIndex)) return;
                if (phoneAction === 'toggle-label') {
                    const label = String(target.dataset.label || '');
                    return updateModalContactPhone(index, phoneIndex, 'toggleLabel', { label, checked: Boolean(target.checked) });
                }
                if (phoneAction === 'value') {
                    return updateModalContactPhone(index, phoneIndex, 'value', target.value);
                }
            }
        });
    }
    function renderModalContacts() {
        const container = document.getElementById('modalContactsList');
        ensureModalContactsDelegation();
        modalContacts = (Array.isArray(modalContacts) ? modalContacts : []).map((contact, idx) => normalizeContact(contact, idx, true));
        if (modalContacts.length > 1) {
            const selectedCount = modalContacts.filter(c => c.isPrimaryForClient).length;
            if (selectedCount > 1) {
                let met = false;
                modalContacts.forEach(c => {
                    if (c.isPrimaryForClient && !met) met = true;
                    else c.isPrimaryForClient = false;
                });
            }
        } else if (modalContacts.length === 1) {
            modalContacts[0].isPrimaryForClient = true;
        }

        container.replaceChildren();
        if (modalContacts.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:#999; font-style: italic; padding:10px; text-align:center;';
            empty.textContent = 'Нет контактных лиц';
            container.appendChild(empty);
            syncClientPhoneFromModalContacts();
            renderClientModalValidationState();
            renderClientWizardPanel();
            return;
        }

        const buildLabelToggle = (index, phoneIndex, label, checked) => {
            const labelEl = document.createElement('label');
            labelEl.style.cssText = 'display:flex; gap:3px; align-items:center; margin:0; font-weight:500;';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.dataset.mcPhoneAction = 'toggle-label';
            input.dataset.index = String(index);
            input.dataset.phoneIndex = String(phoneIndex);
            input.dataset.label = label;
            if (checked) input.checked = true;
            labelEl.appendChild(input);
            labelEl.appendChild(document.createTextNode(label));
            return labelEl;
        };

        const buildPhoneRow = (index, phone, phoneIndex, includeAddButton) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; gap:6px; align-items:center; flex-wrap:nowrap;';
            const labelsWrap = document.createElement('div');
            labelsWrap.style.cssText = 'display:flex; gap:6px; align-items:center; flex:0 0 250px; min-width:230px; font-size:0.8rem;';
            const labels = normalizeContactPhoneLabels(phone.labels);
            labelsWrap.appendChild(buildLabelToggle(index, phoneIndex, 'сотовый', labels.includes('сотовый')));
            labelsWrap.appendChild(buildLabelToggle(index, phoneIndex, 'MAX', labels.includes('MAX')));
            labelsWrap.appendChild(buildLabelToggle(index, phoneIndex, 'Telegram', labels.includes('Telegram')));
            row.appendChild(labelsWrap);

            const valueInput = document.createElement('input');
            valueInput.type = 'text';
            valueInput.placeholder = 'Телефон / username';
            valueInput.value = phone.value || '';
            valueInput.dataset.mcPhoneAction = 'value';
            valueInput.dataset.index = String(index);
            valueInput.dataset.phoneIndex = String(phoneIndex);
            valueInput.style.cssText = 'flex:0 0 150px; min-width:150px; max-width:170px; padding:6px; font-size:0.84rem;';
            row.appendChild(valueInput);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.dataset.mcAction = 'remove-phone';
            removeBtn.dataset.index = String(index);
            removeBtn.dataset.phoneIndex = String(phoneIndex);
            removeBtn.style.cssText = 'background:#f3f6fa; color:#556; border:1px solid #dbe5ef; border-radius:4px; cursor:pointer; padding:4px 8px;';
            removeBtn.textContent = '−';
            row.appendChild(removeBtn);

            if (includeAddButton) {
                const addBtn = document.createElement('button');
                addBtn.type = 'button';
                addBtn.className = 'btn-primary btn-sm';
                addBtn.dataset.mcAction = 'add-phone';
                addBtn.dataset.index = String(index);
                addBtn.textContent = '+ Телефон';
                row.appendChild(addBtn);
            }
            return row;
        };

        modalContacts.forEach((contact, index) => {
            const row = document.createElement('div');
            row.style.cssText = 'margin-bottom: 8px; border:1px solid #e6edf5; border-radius:6px; padding:8px; background:#fbfdff;';
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex; gap:6px; align-items:flex-start; flex-wrap:nowrap;';

            const primaryBtn = document.createElement('button');
            primaryBtn.type = 'button';
            primaryBtn.dataset.mcAction = 'toggle-primary';
            primaryBtn.dataset.index = String(index);
            primaryBtn.title = 'Основной контакт';
            primaryBtn.style.cssText = 'border:1px solid #d8dee8; background:#fff; border-radius:4px; cursor:pointer; width:30px; height:30px; padding:0; font-size:16px; line-height:1;';
            primaryBtn.style.color = contact.isPrimaryForClient ? '#f1b600' : '#a7b0bb';
            primaryBtn.textContent = '★';
            wrap.appendChild(primaryBtn);

            const roleInput = document.createElement('input');
            roleInput.type = 'text';
            roleInput.placeholder = 'Роль';
            roleInput.value = contact.role || '';
            roleInput.dataset.mcField = 'role';
            roleInput.dataset.index = String(index);
            roleInput.style.cssText = 'flex:0 0 160px; min-width:140px; padding:6px; font-size:0.84rem;';
            wrap.appendChild(roleInput);

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = 'Имя';
            nameInput.value = contact.name || '';
            nameInput.dataset.mcField = 'name';
            nameInput.dataset.index = String(index);
            nameInput.style.cssText = 'flex:1 1 260px; min-width:220px; padding:6px; font-size:0.84rem;';
            wrap.appendChild(nameInput);

            const phonesCol = document.createElement('div');
            phonesCol.style.cssText = 'display:flex; flex-direction:column; gap:6px; align-items:flex-start;';
            const phones = normalizeContactPhones(contact.phones, contact.phone || '', true);
            const phoneRows = phones.length ? phones : [{ labels: ['сотовый'], value: '' }];
            phonesCol.appendChild(buildPhoneRow(index, phoneRows[0], 0, true));
            phoneRows.slice(1).forEach((phone, phoneIndexOffset) => {
                const phoneIndex = phoneIndexOffset + 1;
                phonesCol.appendChild(buildPhoneRow(index, phone, phoneIndex, false));
            });
            wrap.appendChild(phonesCol);

            const removeContact = document.createElement('button');
            removeContact.type = 'button';
            removeContact.dataset.mcAction = 'remove-contact';
            removeContact.dataset.index = String(index);
            removeContact.style.cssText = 'background:#fee; color:#e74c3c; border:none; border-radius:4px; cursor:pointer; padding:6px 8px;';
            removeContact.textContent = '×';
            wrap.appendChild(removeContact);

            row.appendChild(wrap);
            container.appendChild(row);
        });
        syncClientPhoneFromModalContacts();
        renderClientModalValidationState();
        renderClientWizardPanel();
    }

    // --- TASKS & HISTORY INSIDE CARD ---
    function ensureClientTasksListDelegation() {
        const container = document.getElementById('tasksList');
        if (!container || container.dataset.delegated === '1') return;
        container.dataset.delegated = '1';
        container.addEventListener('click', (e) => {
            const item = e.target.closest('.main-task-item');
            if (!item || !container.contains(item)) return;
            const taskId = String(item.dataset.taskId || '');
            if (!taskId) return;

            const actionBtn = e.target.closest('[data-task-action]');
            if (actionBtn && item.contains(actionBtn)) {
                const action = String(actionBtn.dataset.taskAction || '');
                if (action === 'done') return startTaskCompletionFlow(taskId);
                if (action === 'edit') return editHistoryItem(taskId);
                if (action === 'deal') return openDealLinkedToTask(taskId, true);
                if (action === 'delete') return deleteTask(taskId);
            }

            openTaskView(taskId);
        });
    }

    function ensureClientHistoryListDelegation() {
        const container = document.getElementById('historyList');
        if (!container || container.dataset.delegated === '1') return;
        container.dataset.delegated = '1';
        container.addEventListener('click', (e) => {
            const item = e.target.closest('.history-item');
            if (!item || !container.contains(item)) return;
            const historyId = String(item.dataset.historyId || '');
            if (!historyId) return;

            const actionBtn = e.target.closest('[data-history-action]');
            if (actionBtn && item.contains(actionBtn)) {
                const action = String(actionBtn.dataset.historyAction || '');
                if (action === 'edit') return editHistoryItem(historyId);
                if (action === 'deal') return openDealLinkedToTask(historyId, false);
                if (action === 'delete') return deleteHistoryItem(historyId);
            }

            editHistoryItem(historyId);
        });
    }

    function ensureClientDealsListDelegation() {
        const container = document.getElementById('clientDealsList');
        if (!container || container.dataset.delegated === '1') return;
        container.dataset.delegated = '1';
        container.addEventListener('click', (e) => {
            const item = e.target.closest('.deal-item');
            if (!item || !container.contains(item)) return;
            const dealId = String(item.dataset.dealId || '');
            if (!dealId) return;

            const actionBtn = e.target.closest('[data-client-deal-action]');
            if (actionBtn && item.contains(actionBtn)) {
                const action = String(actionBtn.dataset.clientDealAction || '');
                if (action === 'open') return openDealByIdInSidebar(dealId);
                if (action === 'edit') return openDealModal(dealId);
                if (action === 'delete') return deleteDeal(dealId);
                if (action === 'task') return createTaskFromDeal(dealId);
            }

            openDealByIdInSidebar(dealId);
        });
    }

    function renderTasks(clientId) {
        const container = document.getElementById('tasksList');
        ensureClientTasksListDelegation();
        container.replaceChildren();
        const tasks = history.filter(h => String(h.clientId) === String(clientId) && h.nextStep && h.nextStep.trim() !== "" && (h.taskStatus === 'new' || h.taskStatus === 'work'));
        tasks.sort((a,b) => (a.nextDate || '').localeCompare(b.nextDate || ''));

        if(tasks.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:15px; text-align:center; color:#999; background:#f9f9f9; border-radius:6px;';
            empty.textContent = '✅ Нет активных задач';
            container.appendChild(empty);
            return;
        }

        tasks.forEach(t => {
            refreshWorkItemTempState(t);
            const timeState = getTaskTimeState(t);
            const isOverdue = timeState === 'overdue';
            const isToday = timeState === 'today';
            const isFuture = timeState === 'future';
            const dateAccent = isOverdue ? 'var(--danger)' : (isToday ? 'var(--success)' : (isFuture ? 'var(--primary)' : '#666'));
            const timeBadgeBg = isOverdue ? '#ffe9e9' : (isToday ? '#e8f8ef' : (isFuture ? '#e7f1ff' : '#eee'));
            const prevResult = getPreviousContactResult(t);
            const div = document.createElement('div');
            div.className = `main-task-item ${isOverdue ? 'overdue' : 'active-task'}`;
            div.dataset.taskId = String(t.id);
            const actions = document.createElement('div');
            actions.className = 'item-actions';
            const hasLinkedDeal = Boolean(getLinkedDealForTask(t));
            const btnDone = document.createElement('button');
            btnDone.className = 'task-action-btn done';
            btnDone.dataset.taskAction = 'done';
            btnDone.type = 'button';
            btnDone.textContent = 'Выполнено';
            const btnDeal = document.createElement('button');
            btnDeal.className = 'task-action-btn deal';
            btnDeal.dataset.taskAction = 'deal';
            btnDeal.type = 'button';
            btnDeal.textContent = hasLinkedDeal ? 'Сделка' : 'Создать сделку';
            const btnEdit = document.createElement('button');
            btnEdit.className = 'task-action-btn edit';
            btnEdit.dataset.taskAction = 'edit';
            btnEdit.type = 'button';
            btnEdit.textContent = 'Редактировать';
            const btnDelete = document.createElement('button');
            btnDelete.className = 'task-action-btn delete';
            btnDelete.dataset.taskAction = 'delete';
            btnDelete.type = 'button';
            btnDelete.textContent = 'Удалить';
            actions.appendChild(btnDone);
            actions.appendChild(btnDeal);
            actions.appendChild(btnEdit);
            actions.appendChild(btnDelete);

            const head = document.createElement('div');
            head.className = 'task-head';
            const headStrong = document.createElement('strong');
            headStrong.style.color = dateAccent;
            headStrong.textContent = `📅 ${formatDateTimeRu(t.nextDate, t.nextTime)}`;
            const headType = document.createElement('span');
            headType.style.cssText = `font-size:0.8rem; background:${timeBadgeBg}; padding:2px 6px; border-radius:4px;`;
            headType.textContent = t.type || '';
            head.appendChild(headStrong);
            head.appendChild(headType);

            const step = document.createElement('div');
            step.style.fontWeight = '600';
            step.textContent = t.nextStep || '';
            const createdMeta = document.createElement('div');
            createdMeta.className = 'task-created-meta';
            createdMeta.textContent = getTaskCreatedDateLabel(t);
            const dealBadge = createTaskDealBadge(t);

            const tempRow = document.createElement('div');
            tempRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-top:6px;';
            tempRow.appendChild(createTempBadgeElement(t));
            tempRow.appendChild(createTempScaleElement(t, new Date(), true));

            const tempReason = document.createElement('div');
            tempReason.style.cssText = 'font-size:0.78rem; color:#566575; margin-top:4px;';
            tempReason.textContent = getTempReason(t, new Date());

            const prev = document.createElement('div');
            prev.style.cssText = 'font-size:0.85rem; color:#666; margin-top:4px;';
            const prevEm = document.createElement('em');
            prevEm.textContent = prevResult || '';
            prev.appendChild(document.createTextNode('Итог прошлого: '));
            prev.appendChild(prevEm);

            div.appendChild(actions);
            div.appendChild(head);
            div.appendChild(step);
            div.appendChild(createdMeta);
            if (dealBadge) div.appendChild(dealBadge);
            div.appendChild(tempRow);
            div.appendChild(tempReason);
            div.appendChild(prev);
            container.appendChild(div);
        });
    }

    function renderClientDealsList(clientId) {
        const container = document.getElementById('clientDealsList');
        if (!container) return;
        ensureClientDealsListDelegation();
        container.replaceChildren();

        const clientDeals = deals
            .map(d => ensureDealRecord(d))
            .filter(d => String(d.client_id) === String(clientId))
            .sort((a, b) => String(a.next_touch_at || '').localeCompare(String(b.next_touch_at || '')));

        if (!clientDeals.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:15px; text-align:center; color:#999; background:#f9f9f9; border-radius:6px;';
            empty.textContent = 'У этого контрагента пока нет сделок';
            container.appendChild(empty);
            return;
        }

        clientDeals.forEach((deal) => {
            const client = clients.find(c => String(c.id) === String(deal.client_id)) || null;
            const contact = client && Array.isArray(client.contacts)
                ? client.contacts.map((item, idx) => normalizeContact(item, idx)).find(item => String(item.id || '') === String(deal.contact_person_id || '')) || null
                : null;
            const item = document.createElement('div');
            item.className = `deal-item ${String(currentDealId || '') === String(deal.id || '') ? 'active' : ''}${deal.is_important ? ' important' : ''}`;
            item.dataset.dealId = String(deal.id || '');

            const head = document.createElement('div');
            head.className = 'deal-item-head';
            head.innerHTML = `<span>${escapeHtml(`${normalizeDealStage(deal.stage)} · ${getDealHeatLabel(deal.heat)}${deal.is_important ? ' · ❗ важная' : ''}${deal.needs_delivery ? ' · 🚚 доставка' : ''}`)}</span><span>Срок: ${escapeHtml(getDealNextTouchDateLabel(deal.next_touch_at))}</span>`;

            const title = document.createElement('div');
            title.className = 'deal-item-title';
            title.textContent = `${getDealImportantPrefix(deal)}${getDealDeliveryPrefix(deal)}${String(deal.title || 'Сделка')}`;

            const meta = document.createElement('div');
            meta.className = 'deal-item-meta';
            const amountLabel = Number(deal.amount || 0) > 0 ? `${Number(deal.amount).toLocaleString('ru-RU')} ₽` : 'без суммы';
            const contactLabel = contact ? ` · Контакт: ${contact.name}` : '';
            meta.textContent = `${amountLabel}${contactLabel}`;

            const actions = document.createElement('div');
            actions.className = 'deal-item-actions';
            actions.innerHTML = `
                <button type="button" class="btn-primary btn-sm" data-client-deal-action="open">Открыть</button>
                <button type="button" class="btn-primary btn-sm" data-client-deal-action="task">+ Задача</button>
                <button type="button" class="btn-primary btn-sm" data-client-deal-action="edit">Ред.</button>
                <button type="button" class="btn-danger btn-sm" data-client-deal-action="delete">Удал.</button>
            `;

            item.appendChild(head);
            if (isDealClosed(deal)) {
                item.appendChild(createDealClosedChip(deal));
            }
            item.appendChild(title);
            item.appendChild(meta);
            item.appendChild(actions);
            container.appendChild(item);
        });
    }

    function renderHistoryList(clientId) {
        const container = document.getElementById('historyList');
        ensureClientHistoryListDelegation();
        container.replaceChildren();
        const items = history
            .filter(h => String(h.clientId) === String(clientId) && h.taskStatus === 'done')
            .sort((a,b) => {
                const aDate = getExecutionDate(a) || '';
                const bDate = getExecutionDate(b) || '';
                const byDate = bDate.localeCompare(aDate);
                if (byDate !== 0) return byDate;
                return (getExecutionTime(b) || '').localeCompare(getExecutionTime(a) || '');
            });

        if(items.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:15px; text-align:center; color:#999;';
            empty.textContent = 'Нет выполненных задач';
            container.appendChild(empty);
            return;
        }

        items.forEach(h => {
            const div = document.createElement('div');
            div.className = 'history-item done';
            div.dataset.historyId = String(h.id);
            const actions = document.createElement('div');
            actions.className = 'item-actions';
            const btnEdit = document.createElement('button');
            btnEdit.className = 'btn-icon';
            btnEdit.dataset.historyAction = 'edit';
            btnEdit.type = 'button';
            btnEdit.textContent = '✏️';
            const btnDeal = document.createElement('button');
            btnDeal.className = 'btn-icon';
            btnDeal.dataset.historyAction = 'deal';
            btnDeal.type = 'button';
            btnDeal.title = 'Открыть сделку';
            btnDeal.textContent = '🏷️';
            const btnDelete = document.createElement('button');
            btnDelete.className = 'btn-icon delete';
            btnDelete.dataset.historyAction = 'delete';
            btnDelete.type = 'button';
            btnDelete.textContent = '🗑';
            actions.appendChild(btnEdit);
            actions.appendChild(btnDeal);
            actions.appendChild(btnDelete);

            const head = document.createElement('div');
            head.className = 'history-head';
            const headStrong = document.createElement('strong');
            headStrong.textContent = formatDateTimeRu(getExecutionDate(h), getExecutionTime(h));
            const headType = document.createElement('span');
            headType.style.cssText = 'font-size:0.75rem; background:#eee; padding:2px 5px; border-radius:3px;';
            headType.textContent = h.type || '';
            head.appendChild(headStrong);
            head.appendChild(headType);

            const topic = document.createElement('div');
            topic.style.cssText = 'color:#444; font-size:0.9rem; white-space: pre-wrap; margin-bottom:8px;';
            const topicStrong = document.createElement('strong');
            topicStrong.textContent = 'Тема:';
            topic.appendChild(topicStrong);
            topic.appendChild(document.createTextNode(` ${h.desc || h.nextStep || '-'}`));
            const createdMeta = document.createElement('div');
            createdMeta.className = 'task-created-meta';
            createdMeta.textContent = getTaskCreatedDateLabel(h);
            const dealBadge = createTaskDealBadge(h);

            const result = document.createElement('div');
            result.style.cssText = 'font-size:0.9rem; margin-bottom:4px;';
            const resultStrong = document.createElement('strong');
            resultStrong.textContent = 'Итог:';
            result.appendChild(resultStrong);
            result.appendChild(document.createTextNode(` ${h.result || ''}`));

            const done = document.createElement('div');
            done.style.cssText = 'color:#7f8c8d; font-size:0.85rem; font-weight:bold;';
            done.textContent = '✅ Задача выполнена';

            div.appendChild(actions);
            div.appendChild(head);
            div.appendChild(topic);
            div.appendChild(createdMeta);
            if (dealBadge) div.appendChild(dealBadge);
            div.appendChild(result);
            div.appendChild(done);
            container.appendChild(div);
        });
    }


    function getInactiveThresholdDate() {
        const now = new Date();
        const threshold = new Date(now);
        const count = Math.max(1, parseInt(inactiveFilterCount, 10) || 30);

        if (inactiveFilterUnit === 'days') threshold.setDate(threshold.getDate() - count);
        else if (inactiveFilterUnit === 'weeks') threshold.setDate(threshold.getDate() - (count * 7));
        else threshold.setMonth(threshold.getMonth() - count);

        threshold.setHours(0, 0, 0, 0);
        return threshold;
    }

    function getInactiveClients() {
        const threshold = getInactiveThresholdDate();
        return clients.filter(c => {
            const tasks = history.filter(h => String(h.clientId) === String(c.id) && h.nextStep && h.nextStep.trim() !== "");
            if (tasks.length === 0) return true;
            let latest = null;
            tasks.forEach(t => {
                const d = new Date(`${t.date || ''}T00:00:00`);
                if (!isNaN(d.getTime()) && (!latest || d > latest)) latest = d;
            });
            if (!latest) return true;
            return latest <= threshold;
        });
    }

    function updateDashboard() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const weekLater = new Date(); weekLater.setDate(weekLater.getDate() + 7);
        const weekStr = weekLater.toISOString().split('T')[0];

        const todayCount = history.filter(h => isActiveTask(h) && getTaskTimeState(h, now) === 'today').length;
        const overdueCount = history.filter(h => isActiveTask(h) && getTaskTimeState(h, now) === 'overdue').length;
        document.getElementById('statToday').innerText = todayCount;
        document.getElementById('statOverdue').innerText = overdueCount;
        document.getElementById('statWeek').innerText = history.filter(h => {
            if (!isActiveTask(h) || !h.nextDate) return false;
            return getTaskTimeState(h, now) === 'future' && h.nextDate <= weekStr;
        }).length;
        document.getElementById('statNoTouch').innerText = getInactiveClients().length;
        renderDashboardDealsQueue();

        const unitMap = { days: 'дн.', weeks: 'нед.', months: 'мес.' };
        document.getElementById('statNoTouchLabel').innerText = `Без задач >= ${inactiveFilterCount} ${unitMap[inactiveFilterUnit]}`;
        document.title = overdueCount > 0 ? `(${overdueCount}) ${baseDocumentTitle}` : baseDocumentTitle;
    }

    function openStatModal(kind) {
        const title = document.getElementById('statsModalTitle');
        const list = document.getElementById('statsModalList');
        const inactiveBlock = document.getElementById('inactiveConfigBlock');
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const weekLater = new Date(); weekLater.setDate(weekLater.getDate() + 7);
        const weekStr = weekLater.toISOString().split('T')[0];

        list.replaceChildren();
        inactiveBlock.classList.add('hidden');

        if (kind === 'inactive') {
            title.innerText = 'Долго без касаний';
            inactiveBlock.classList.remove('hidden');
            document.getElementById('inactiveCountInput').value = inactiveFilterCount;
            document.getElementById('inactiveUnitSelect').value = inactiveFilterUnit;
            renderInactiveClientsModalList();
            showModalOnTop('statsModal');
            return;
        }
        if (kind === 'completedNoActive') {
            title.innerText = 'Есть выполненные, нет актуальных задач';
            renderCompletedNoActiveClientsModalList();
            showModalOnTop('statsModal');
            return;
        }

        let tasks = [];
        if (kind === 'today') {
            title.innerText = 'Задачи на сегодня';
            tasks = history.filter(h => isActiveTask(h) && getTaskTimeState(h, now) === 'today');
        } else if (kind === 'overdue') {
            title.innerText = 'Просроченные задачи';
            tasks = history.filter(h => isActiveTask(h) && getTaskTimeState(h, now) === 'overdue');
        } else {
            title.innerText = 'Будущие задачи на 7 дней';
            tasks = history.filter(h => h.nextDate && isActiveTask(h) && getTaskTimeState(h, now) === 'future' && h.nextDate <= weekStr);
        }

        tasks.sort((a,b) => (a.nextDate || '').localeCompare(b.nextDate || '') || (a.nextTime || '').localeCompare(b.nextTime || ''));
        renderTasksStatsList(tasks, list, today, kind);
        showModalOnTop('statsModal');
    }

    function ensureStatsModalTaskListDelegation() {
        const container = document.getElementById('statsModalList');
        if (!container || container.dataset.taskDelegated === '1') return;
        container.dataset.taskDelegated = '1';
        container.addEventListener('click', (e) => {
            const clientBtn = e.target.closest('[data-stats-client-action]');
            if (clientBtn && container.contains(clientBtn)) {
                const clientAction = String(clientBtn.dataset.statsClientAction || '');
                const clientId = String(clientBtn.dataset.clientId || '');
                if (!clientAction || !clientId) return;
                if (clientAction === 'first-contact') {
                    openFirstContactTaskModal(clientId);
                    return;
                }
                if (clientAction === 'open-client') {
                    closeModal('statsModal');
                    selectClient(clientId);
                    return;
                }
            }

            const btn = e.target.closest('[data-stats-task-action]');
            if (btn && container.contains(btn)) {
                const action = String(btn.dataset.statsTaskAction || '');
                const taskId = String(btn.dataset.taskId || '');
                const kind = String(btn.dataset.statKind || '');
                const clientId = String(btn.dataset.clientId || '');
                if (!action) return;

                if (action === 'done') {
                    if (btn.disabled || !taskId) return;
                    startTaskCompletionFlow(taskId, kind);
                    return;
                }
                if (action === 'edit') {
                    if (!taskId) return;
                    closeModal('statsModal');
                    editHistoryItem(taskId);
                    return;
                }
                if (action === 'delete') {
                    if (!taskId) return;
                    deleteTask(taskId);
                    openStatModal(kind);
                    return;
                }
                if (action === 'reschedule') {
                    if (!taskId) return;
                    closeModal('statsModal');
                    openRescheduleTaskModal(taskId);
                    return;
                }
                if (action === 'deal') {
                    if (!taskId) return;
                    closeModal('statsModal');
                    openDealLinkedToTask(taskId, true);
                    return;
                }
                if (action === 'client') {
                    if (!clientId) return;
                    closeModal('statsModal');
                    selectClient(clientId);
                }
                return;
            }

            const item = e.target.closest('.stats-modal-item');
            if (!item || !container.contains(item)) return;
            const taskId = String(item.dataset.taskId || '');
            if (!taskId) return;
            openTaskView(taskId);
        });
    }

    function renderTasksStatsList(tasks, container, today, kind) {
        ensureStatsModalTaskListDelegation();
        if (!container) return;
        container.replaceChildren();
        if (!tasks.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:14px; text-align:center; color:#777;';
            empty.textContent = 'Пусто';
            container.appendChild(empty);
            return;
        }

        tasks.forEach(t => {
            refreshWorkItemTempState(t);
            const client = clients.find(c => String(c.id) === String(t.clientId));
            const isDone = t.taskStatus === 'done';
            const timeState = getTaskTimeState(t);
            const isOverdue = timeState === 'overdue' && !isDone;
            const isToday = timeState === 'today' && !isDone;
            const isFuture = timeState === 'future' && !isDone;
            const item = document.createElement('div');
            item.className = `stats-modal-item ${isDone ? 'done' : (isOverdue ? 'overdue' : (isToday ? 'today' : (isFuture ? 'future' : '')))}`;
            item.dataset.taskId = String(t.id || '');
            const taskId = String(t.id || '');
            const clientId = String(t.clientId || '');

            const head = document.createElement('div');
            head.className = 'stats-modal-item-head';
            const headDate = document.createElement('strong');
            headDate.textContent = formatDateTimeRu(t.nextDate, t.nextTime);
            const headStatus = document.createElement('span');
            headStatus.textContent = isDone ? 'Выполнена' : (isOverdue ? 'Просрочено' : (isToday ? 'Сегодня' : (isFuture ? 'Будущая' : 'Активна')));
            head.appendChild(headDate);
            head.appendChild(headStatus);

            const clientName = document.createElement('div');
            clientName.style.cssText = 'font-weight:600; margin-bottom:3px;';
            clientName.textContent = client ? client.name : 'Удаленный контрагент';

            const step = document.createElement('div');
            step.style.cssText = 'font-size:0.9rem; color:#444;';
            step.textContent = t.nextStep || '-';
            const createdMeta = document.createElement('div');
            createdMeta.className = 'task-created-meta';
            createdMeta.textContent = getTaskCreatedDateLabel(t);
            const dealBadge = createTaskDealBadge(t);

            const tempMeta = document.createElement('div');
            tempMeta.style.cssText = 'display:flex; align-items:center; gap:8px; margin-top:6px;';
            tempMeta.appendChild(createTempBadgeElement(t, new Date()));
            tempMeta.appendChild(createTempScaleElement(t, new Date(), true));

            const tempReason = document.createElement('div');
            tempReason.style.cssText = 'font-size:0.78rem; color:#566575; margin-top:4px;';
            tempReason.textContent = getTempReason(t, new Date());

            const actions = document.createElement('div');
            actions.className = 'stats-modal-actions';
            const hasLinkedDeal = Boolean(getLinkedDealForTask(t));

            const doneBtn = document.createElement('button');
            doneBtn.type = 'button';
            doneBtn.className = 'task-action-btn done';
            doneBtn.dataset.statsTaskAction = 'done';
            doneBtn.dataset.taskId = taskId;
            doneBtn.dataset.statKind = kind;
            doneBtn.disabled = isDone;
            doneBtn.textContent = 'Выполнено';

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'task-action-btn edit';
            editBtn.dataset.statsTaskAction = 'edit';
            editBtn.dataset.taskId = taskId;
            editBtn.textContent = 'Редактировать';

            const rescheduleBtn = document.createElement('button');
            rescheduleBtn.type = 'button';
            rescheduleBtn.className = 'task-action-btn reschedule';
            rescheduleBtn.dataset.statsTaskAction = 'reschedule';
            rescheduleBtn.dataset.taskId = taskId;
            rescheduleBtn.textContent = 'Перенести';
            rescheduleBtn.disabled = isDone;

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'task-action-btn delete';
            deleteBtn.dataset.statsTaskAction = 'delete';
            deleteBtn.dataset.taskId = taskId;
            deleteBtn.dataset.statKind = kind;
            deleteBtn.textContent = 'Удалить';

            const clientBtn = document.createElement('button');
            clientBtn.type = 'button';
            clientBtn.className = 'task-action-btn';
            clientBtn.dataset.statsTaskAction = 'client';
            clientBtn.dataset.clientId = clientId;
            clientBtn.textContent = 'Контрагент';

            const dealBtn = document.createElement('button');
            dealBtn.type = 'button';
            dealBtn.className = 'task-action-btn deal';
            dealBtn.dataset.statsTaskAction = 'deal';
            dealBtn.dataset.taskId = taskId;
            dealBtn.textContent = hasLinkedDeal ? 'Сделка' : 'Создать сделку';

            actions.appendChild(doneBtn);
            actions.appendChild(rescheduleBtn);
            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            actions.appendChild(dealBtn);
            actions.appendChild(clientBtn);

            item.appendChild(head);
            item.appendChild(clientName);
            item.appendChild(step);
            item.appendChild(createdMeta);
            if (dealBadge) item.appendChild(dealBadge);
            item.appendChild(tempMeta);
            item.appendChild(tempReason);
            item.appendChild(actions);
            container.appendChild(item);
        });
    }

    function renderInactiveClientsModalList() {
        const list = document.getElementById('statsModalList');
        if (!list) return;
        const threshold = getInactiveThresholdDate();
        const inactiveClients = getInactiveClients();
        list.replaceChildren();

        if (!inactiveClients.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:14px; text-align:center; color:#777;';
            empty.textContent = 'Нет контрагентов по текущему фильтру';
            list.appendChild(empty);
            return;
        }

        const thresholdStr = formatDateRu(threshold.toISOString().split('T')[0]);
        const info = document.createElement('div');
        info.style.cssText = 'font-size:0.85rem; color:#666; margin-bottom:6px;';
        info.appendChild(document.createTextNode('Последняя задача не позже: '));
        const strong = document.createElement('strong');
        strong.textContent = thresholdStr;
        info.appendChild(strong);
        list.appendChild(info);

        inactiveClients
            .sort((a,b) => (a.name || '').localeCompare(b.name || ''))
            .forEach(c => {
                const clientTasks = history.filter(h => String(h.clientId) === String(c.id) && h.nextStep && h.nextStep.trim() !== "");
                const hasNeverTask = clientTasks.length === 0;
                let lastDate = 'никогда';
                if (clientTasks.length) {
                    const latest = clientTasks
                        .map(t => getExecutionDate(t) || '')
                        .filter(Boolean)
                        .sort()
                        .slice(-1)[0];
                    if (latest) lastDate = formatDateRu(latest);
                }

                const item = document.createElement('div');
                item.className = 'stats-modal-item inactive';
                const clientId = String(c.id || '');

                const head = document.createElement('div');
                head.className = 'stats-modal-item-head';
                const headName = document.createElement('strong');
                headName.textContent = c.name || 'Без имени';
                const headMeta = document.createElement('span');
                headMeta.textContent = `Последняя задача: ${lastDate}`;
                head.appendChild(headName);
                head.appendChild(headMeta);

                const actions = document.createElement('div');
                actions.className = 'stats-modal-actions';

                if (hasNeverTask) {
                    const firstBtn = document.createElement('button');
                    firstBtn.type = 'button';
                    firstBtn.className = 'task-action-btn done';
                    firstBtn.dataset.statsClientAction = 'first-contact';
                    firstBtn.dataset.clientId = clientId;
                    firstBtn.textContent = 'Создать задачу первого контакта';
                    actions.appendChild(firstBtn);
                }

                const openBtn = document.createElement('button');
                openBtn.type = 'button';
                openBtn.className = 'task-action-btn';
                openBtn.dataset.statsClientAction = 'open-client';
                openBtn.dataset.clientId = clientId;
                openBtn.textContent = 'Открыть карточку';
                actions.appendChild(openBtn);

                item.appendChild(head);
                item.appendChild(actions);
                list.appendChild(item);
            });
    }

    function openFirstContactTaskModal(clientId) {
        if (!clientId) return;
        closeModal('statsModal');
        openNewTaskModalForClient(clientId);
    }

    function renderCompletedNoActiveClientsModalList() {
        const list = document.getElementById('statsModalList');
        if (!list) return;
        const reportItems = clients
            .map(c => {
                if (String(c.status || '').trim().toLowerCase() === 'архив') return null;
                const doneTasks = history.filter(h => String(h.clientId) === String(c.id) && h.taskStatus === 'done');
                if (!doneTasks.length) return null;
                const activeTasks = history.filter(h => String(h.clientId) === String(c.id) && isActiveTask(h));
                if (activeTasks.length) return null;

                const latestDone = doneTasks
                    .slice()
                    .sort((a, b) => {
                        const aMoment = getTaskMoment(a);
                        const bMoment = getTaskMoment(b);
                        return (bMoment ? bMoment.getTime() : 0) - (aMoment ? aMoment.getTime() : 0);
                    })[0];

                return { client: c, doneCount: doneTasks.length, latestDone };
            })
            .filter(Boolean)
            .sort((a, b) => (a.client.name || '').localeCompare(b.client.name || ''));
        list.replaceChildren();

        if (!reportItems.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:14px; text-align:center; color:#777;';
            empty.textContent = 'Нет контрагентов по текущему условию';
            list.appendChild(empty);
            return;
        }

        const info = document.createElement('div');
        info.style.cssText = 'font-size:0.85rem; color:#666; margin-bottom:6px;';
        info.textContent = 'Показаны контрагенты, у которых есть выполненные задачи, но нет активных.';
        list.appendChild(info);

        reportItems.forEach(itemData => {
            const c = itemData.client;
            const latestDone = itemData.latestDone;
            const latestDoneDate = latestDone ? (getExecutionDate(latestDone) || latestDone.nextDate || latestDone.date || '') : '';
            const latestDoneTime = latestDone ? (getExecutionTime(latestDone) || latestDone.nextTime || latestDone.time || '') : '';
            const item = document.createElement('div');
            item.className = 'stats-modal-item inactive';
            const clientId = String(c.id || '');

            const head = document.createElement('div');
            head.className = 'stats-modal-item-head';
            const headName = document.createElement('strong');
            headName.textContent = c.name || 'Без имени';
            const headMeta = document.createElement('span');
            headMeta.textContent = `Выполнено задач: ${itemData.doneCount}`;
            head.appendChild(headName);
            head.appendChild(headMeta);

            const lastDone = document.createElement('div');
            lastDone.style.cssText = 'font-size:0.88rem; color:#4b5b6a; margin-bottom:8px;';
            lastDone.textContent = `Последняя выполненная: ${latestDoneDate ? formatDateTimeRu(latestDoneDate, latestDoneTime) : 'нет даты'}`;

            const actions = document.createElement('div');
            actions.className = 'stats-modal-actions';
            const openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.className = 'task-action-btn';
            openBtn.dataset.statsClientAction = 'open-client';
            openBtn.dataset.clientId = clientId;
            openBtn.textContent = 'Открыть карточку';
            actions.appendChild(openBtn);

            item.appendChild(head);
            item.appendChild(lastDone);
            item.appendChild(actions);
            list.appendChild(item);
        });
    }

    function saveInactiveFilter() {
        const countInput = document.getElementById('inactiveCountInput');
        const unitInput = document.getElementById('inactiveUnitSelect');
        inactiveFilterCount = Math.max(1, parseInt(countInput.value, 10) || 30);
        inactiveFilterUnit = ['days','weeks','months'].includes(unitInput.value) ? unitInput.value : 'days';
        CRMStore.setJSON('inactiveFilter', { count: inactiveFilterCount, unit: inactiveFilterUnit });
        markDatabaseDirty();
        updateDashboard();
        renderInactiveClientsModalList();
    }

    // --- MODALS & ACTIONS ---
    function openClientModal() {
        document.getElementById('modalTitle').innerText = 'Новый контрагент';
        document.getElementById('clientId').value = '';
        document.getElementById('cName').value = '';
        document.getElementById('cAddress').value = '';
        document.getElementById('cPhone').value = '';
        renderClientTypeOptions();
        setClientTypesSelection('Не указан');
        document.getElementById('cClass').value = 'Не указан';
        document.getElementById('cStatus').value = 'Новый';
        document.getElementById('cRelated').value = '';
        document.getElementById('cNotes').value = '';
        document.getElementById('relatedClientSearch').value = '';
        modalEditingClientId = '';
        modalRelatedClientIds = [];
        renderSelectedRelatedClients();
        renderRelatedClientPicker();
        modalContacts = [];
        renderModalContacts();
        renderClientWizardPanel();
        renderClientModalValidationState();
        document.getElementById('clientModal').classList.remove('hidden');
    }

    function editCurrentClient() {
        if(!currentClientId) return;
        const client = clients.find(c => String(c.id) === String(currentClientId));
        if(!client) return;
        
        document.getElementById('modalTitle').innerText = 'Редактировать: ' + client.name;
        document.getElementById('clientId').value = client.id;
        document.getElementById('cName').value = client.name || '';
        document.getElementById('cAddress').value = client.address || '';
        document.getElementById('cPhone').value = client.phone || '';
        ensureClientTypesInOptions(client.type);
        renderClientTypeOptions();
        setClientTypesSelection(client.type);
        document.getElementById('cClass').value = normalizeClientClass(client.class);
        document.getElementById('cStatus').value = client.status || 'Новый';
        document.getElementById('cRelated').value = client.related || '';
        document.getElementById('cNotes').value = client.notes || '';
        document.getElementById('relatedClientSearch').value = '';
        modalEditingClientId = String(client.id);
        modalRelatedClientIds = normalizeRelatedClientIds(client.relatedClientIds);
        renderSelectedRelatedClients();
        renderRelatedClientPicker();
        
        modalContacts = client.contacts ? JSON.parse(JSON.stringify(client.contacts)).map((contact, idx) => normalizeContact(contact, idx)) : [];
        renderModalContacts();
        renderClientWizardPanel();
        renderClientModalValidationState();
        document.getElementById('clientModal').classList.remove('hidden');
    }

    function openHistoryModal() {
        if (!currentClientId) return alert('Выберите клиента!');
        resetHistoryModalFields();
        document.getElementById('hId').value = ''; 
        document.getElementById('hClientId').value = currentClientId;
        forcedHistoryClientId = String(currentClientId || '');
        document.getElementById('hClientSelectWrap').classList.add('hidden');
        populateHistoryContactPersonSelect(currentClientId);
        document.getElementById('histModalTitle').innerText = 'Записать контакт / Задачу';
        isTaskCreateMode = true;
        setModalStatus('new');
        checkSmartVisibility(); // Check immediately
        document.getElementById('historyModal').classList.remove('hidden');
    }

    function normalizeSearchValue(value) {
        return String(value || '').toLowerCase().trim();
    }

    function getRelatedClientIdsForSearch(clientId) {
        const ownId = String(clientId || '');
        if (!ownId) return [];
        const direct = normalizeRelatedClientIds((clients.find(c => String(c.id) === ownId) || {}).relatedClientIds);
        const back = clients
            .filter(c => String(c.id) !== ownId)
            .filter(c => normalizeRelatedClientIds(c.relatedClientIds).some(idVal => String(idVal) === ownId))
            .map(c => String(c.id));
        return [...new Set([...direct.map(String), ...back])].filter(idVal => idVal !== ownId);
    }

    function getTaskClientSearchResults(queryRaw) {
        const query = normalizeSearchValue(queryRaw);
        const sorted = clients
            .slice()
            .sort((a,b) => (a.name || '').localeCompare(b.name || ''));

        if (!query) {
            return sorted.map(c => ({
                client: c,
                label: c.name || 'Без названия'
            }));
        }

        const matchedIds = new Set();
        const matchedContactNamesByClientId = new Map();
        sorted.forEach(c => {
            const clientName = normalizeSearchValue(c.name);
            const contacts = Array.isArray(c.contacts) ? c.contacts : [];
            const matchedContacts = contacts
                .map(contact => String(contact.name || '').trim())
                .filter(Boolean)
                .filter(contactName => normalizeSearchValue(contactName).includes(query));
            const contactMatch = matchedContacts.length > 0;
            if (contactMatch) matchedContactNamesByClientId.set(String(c.id), matchedContacts);
            if (clientName.includes(query) || contactMatch) matchedIds.add(String(c.id));
        });

        const relatedIds = new Set();
        matchedIds.forEach(idVal => {
            getRelatedClientIdsForSearch(idVal).forEach(relId => relatedIds.add(String(relId)));
        });
        matchedIds.forEach(idVal => relatedIds.delete(String(idVal)));

        const byId = new Map(sorted.map(c => [String(c.id), c]));
        const matchedItems = [...matchedIds]
            .map(idVal => byId.get(String(idVal)))
            .filter(Boolean)
            .sort((a,b) => (a.name || '').localeCompare(b.name || ''))
            .map(c => {
                const matchedContacts = matchedContactNamesByClientId.get(String(c.id)) || [];
                if (!matchedContacts.length) {
                    return { client: c, label: c.name || 'Без названия' };
                }
                const hint = matchedContacts.slice(0, 2).join(', ');
                const tail = matchedContacts.length > 2 ? ` +${matchedContacts.length - 2}` : '';
                return { client: c, label: `${c.name || 'Без названия'} — контакт: ${hint}${tail}` };
            });

        const relatedItems = [...relatedIds]
            .map(idVal => byId.get(String(idVal)))
            .filter(Boolean)
            .sort((a,b) => (a.name || '').localeCompare(b.name || ''))
            .map(c => ({ client: c, label: `${c.name || 'Без названия'} (связанный)` }));

        return [...matchedItems, ...relatedItems];
    }

    function populateTaskClientSelect(selectedId, keepTypedInput = false) {
        const hiddenSelect = document.getElementById('hClientSelect');
        const datalist = document.getElementById('hClientOptions');
        const searchInput = document.getElementById('hClientSearch');
        const query = searchInput ? searchInput.value : '';
        const desiredValue = keepTypedInput ? '' : String(selectedId || (hiddenSelect ? hiddenSelect.value : '') || '');
        const items = getTaskClientSearchResults(query);
        taskClientSearchCache = items.map(item => ({ id: String(item.client.id), label: item.label }));

        if (datalist) {
            datalist.replaceChildren();
            taskClientSearchCache.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.label;
                datalist.appendChild(opt);
            });
        }

        if (hiddenSelect) hiddenSelect.value = '';
        if (desiredValue) {
            const selectedClient = clients.find(c => String(c.id) === desiredValue);
            if (selectedClient) {
                if (hiddenSelect) hiddenSelect.value = desiredValue;
                if (searchInput) searchInput.value = selectedClient.name || 'Без названия';
            }
        }
        onHistoryClientChanged();
    }

    function filterTaskClientSelect() {
        populateTaskClientSelect('', true);
        applyTaskClientFromSearch(false);
    }

    function applyTaskClientFromSearch(usePartialMatch = true) {
        const searchInput = document.getElementById('hClientSearch');
        const hiddenSelect = document.getElementById('hClientSelect');
        if (!searchInput || !hiddenSelect) return;

        const query = normalizeSearchValue(searchInput.value);
        if (!query) {
            hiddenSelect.value = '';
            onHistoryClientChanged();
            return;
        }
        const baseQuery = normalizeSearchValue(String(searchInput.value || '').split('— контакт:')[0].replace(/\(связанный\)\s*$/, '').trim());

        const exactLabelMatches = taskClientSearchCache.filter(item => normalizeSearchValue(item.label) === query);
        const exactNameMatches = clients
            .filter(c => normalizeSearchValue(c.name) === query)
            .map(c => ({ id: String(c.id), label: c.name || 'Без названия' }));
        const exactBaseNameMatches = baseQuery && baseQuery !== query
            ? clients.filter(c => normalizeSearchValue(c.name) === baseQuery).map(c => ({ id: String(c.id), label: c.name || 'Без названия' }))
            : [];
        const exactMatches = [...exactLabelMatches, ...exactNameMatches, ...exactBaseNameMatches].filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx);
        if (exactMatches.length === 1) {
            hiddenSelect.value = exactMatches[0].id;
            onHistoryClientChanged();
            return;
        }

        if (!usePartialMatch) {
            hiddenSelect.value = '';
            onHistoryClientChanged();
            return;
        }
        const partialMatches = taskClientSearchCache.filter(item => normalizeSearchValue(item.label).includes(query));
        if (partialMatches.length === 1) {
            hiddenSelect.value = partialMatches[0].id;
            searchInput.value = partialMatches[0].label;
            onHistoryClientChanged();
            return;
        }

        hiddenSelect.value = '';
        onHistoryClientChanged();
    }

    function resolveTaskClientIdFromSearch(usePartialMatch = true) {
        const searchInput = document.getElementById('hClientSearch');
        const hiddenSelect = document.getElementById('hClientSelect');
        if (hiddenSelect && String(hiddenSelect.value || '').trim()) return String(hiddenSelect.value || '').trim();
        if (!searchInput) return '';

        const query = normalizeSearchValue(searchInput.value);
        if (!query) return '';
        const baseQuery = normalizeSearchValue(String(searchInput.value || '').split('— контакт:')[0].replace(/\(связанный\)\s*$/, '').trim());

        const cachedItems = Array.isArray(taskClientSearchCache) ? taskClientSearchCache : [];
        const freshItems = getTaskClientSearchResults(searchInput.value).map(item => ({ id: String(item.client.id), label: item.label }));
        const allItems = [...cachedItems, ...freshItems].filter((item, idx, arr) => arr.findIndex(x => String(x.id) === String(item.id)) === idx);

        const exactLabelMatches = allItems.filter(item => normalizeSearchValue(item.label) === query);
        const exactNameMatches = clients
            .filter(c => normalizeSearchValue(c.name) === query)
            .map(c => ({ id: String(c.id), label: c.name || 'Без названия' }));
        const exactBaseNameMatches = baseQuery && baseQuery !== query
            ? clients.filter(c => normalizeSearchValue(c.name) === baseQuery).map(c => ({ id: String(c.id), label: c.name || 'Без названия' }))
            : [];
        const exactMatches = [...exactLabelMatches, ...exactNameMatches, ...exactBaseNameMatches].filter((item, idx, arr) => arr.findIndex(x => String(x.id) === String(item.id)) === idx);
        if (exactMatches.length === 1) return String(exactMatches[0].id);

        if (!usePartialMatch) return '';

        const partialMatches = allItems.filter(item => normalizeSearchValue(item.label).includes(query));
        if (partialMatches.length === 1) return String(partialMatches[0].id);

        return '';
    }

    function populateHistoryContactPersonSelect(clientId, selectedContactId = '') {
        const wrap = document.getElementById('hContactPersonWrap');
        const select = document.getElementById('hContactPersonSelect');
        if (!wrap || !select) return;
        const client = clients.find(c => String(c.id) === String(clientId));
        const contacts = client && Array.isArray(client.contacts)
            ? client.contacts.map((c, idx) => normalizeContact(c, idx)).filter(c => (c.name || '').trim() !== '')
            : [];

        if (!client || contacts.length === 0) {
            wrap.classList.add('hidden');
            select.replaceChildren();
            return;
        }

        wrap.classList.remove('hidden');
        select.replaceChildren();
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Не выбрано';
        select.appendChild(emptyOption);
        contacts.forEach(contact => {
            const opt = document.createElement('option');
            opt.value = String(contact.id || '');
            const role = (contact.role || '').trim();
            const phone = getContactPreferredPhone(contact);
            opt.textContent = `${contact.name}${role ? ` (${role})` : ''}${phone ? ` — ${phone}` : ''}`;
            select.appendChild(opt);
        });

        if (selectedContactId) select.value = String(selectedContactId);
    }

    function onHistoryClientChanged(preserveSelectedContact = true) {
        const clientSelect = document.getElementById('hClientSelect');
        const contactSelect = document.getElementById('hContactPersonSelect');
        if (!clientSelect) return;
        const selectedContactId = preserveSelectedContact && contactSelect ? (contactSelect.value || '') : '';
        populateHistoryContactPersonSelect(clientSelect.value, selectedContactId);
    }

    function openHistoryModalClientCard() {
        applyTaskClientFromSearch();
        const selectedClientId = document.getElementById('hClientSelect').value;
        const hiddenClientId = document.getElementById('hClientId').value;
        const clientId = selectedClientId || hiddenClientId;
        if (!clientId) return;
        closeModal('historyModal');
        selectClient(clientId);
        switchContentTab('history');
    }

    function openGlobalTaskModal() {
        if (!clients.length) return alert('Сначала создайте контрагента');
        resetHistoryModalFields();
        document.getElementById('hId').value = '';
        document.getElementById('hClientId').value = '';
        document.getElementById('hClientSelect').value = '';
        forcedHistoryClientId = '';
        document.getElementById('hClientSelectWrap').classList.remove('hidden');
        const searchInput = document.getElementById('hClientSearch');
        if (searchInput) searchInput.value = '';
        populateTaskClientSelect('');
        document.getElementById('histModalTitle').innerText = 'Новая задача';
        isTaskCreateMode = true;
        setModalStatus('new');
        checkSmartVisibility();
        document.getElementById('historyModal').classList.remove('hidden');
    }

    function openNewTaskModalForClient(clientId) {
        const targetClientId = String(clientId || '');
        const targetClient = clients.find(c => String(c.id) === targetClientId);
        if (!targetClient) return alert('Контрагент не найден');
        resetHistoryModalFields();
        document.getElementById('hId').value = '';
        document.getElementById('hClientId').value = targetClientId;
        forcedHistoryClientId = targetClientId;
        document.getElementById('hClientSelectWrap').classList.add('hidden');
        populateHistoryContactPersonSelect(targetClientId);
        document.getElementById('histModalTitle').innerText = `Новая задача: ${targetClient.name || 'Без имени'}`;
        isTaskCreateMode = true;
        setModalStatus('new');
        checkSmartVisibility();
        document.getElementById('historyModal').classList.remove('hidden');
    }

    function resetHistoryModalFields() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('hDate').value = today;
        document.getElementById('hTime').value = getNowTimeLocalHHMM();
        document.getElementById('hType').value = 'Исходящий';
        document.getElementById('hResult').value = '';
        document.getElementById('hTopic').value = '';
        document.getElementById('hNextDate').value = today;
        document.getElementById('hNextTime').value = '';
        document.getElementById('hNextStep').value = '';
        document.getElementById('hStatus').value = 'new';
        document.getElementById('hContactPersonWrap').classList.add('hidden');
        document.getElementById('hContactPersonSelect').replaceChildren();
        renderTaskTopicTemplateOptions();
        updateStatusButtonsUI('new');
    }

    // EDIT FUNCTION (GLOBAL)
    function editHistoryItem(id) {
        const item = history.find(h => String(h.id) === String(id));
        if(!item) {
            console.error("Запись не найдена:", id);
            return;
        }
        
        document.getElementById('hId').value = item.id;
        document.getElementById('hClientId').value = '';
        forcedHistoryClientId = '';
        document.getElementById('hClientSelectWrap').classList.remove('hidden');
        const searchInput = document.getElementById('hClientSearch');
        if (searchInput) searchInput.value = '';
        populateTaskClientSelect(item.clientId);
        populateHistoryContactPersonSelect(item.clientId, item.contactPersonId || '');
        document.getElementById('histModalTitle').innerText = 'Редактировать запись';
        
        document.getElementById('hDate').value = item.date;
        document.getElementById('hTime').value = item.time || '';
        document.getElementById('hType').value = item.type;
        document.getElementById('hResult').value = item.result;
        document.getElementById('hTopic').value = item.nextStep || item.desc || '';
        renderTaskTopicTemplateOptions();
        
        document.getElementById('hNextDate').value = item.nextDate || '';
        document.getElementById('hNextTime').value = item.nextTime || '';
        document.getElementById('hNextStep').value = item.nextStep || '';
        
        isTaskCreateMode = false;
        const status = item.taskStatus || 'new';
        setModalStatus(status);
        checkSmartVisibility(); // Check visibility based on loaded date
        
        document.getElementById('historyModal').classList.remove('hidden');
    }

    // SMART VISIBILITY LOGIC
    function checkSmartVisibility() {
        const section = document.getElementById('smartNextStepSection');
        // Single-task flow: "Следующие действия" are not used.
        section.classList.add('hidden');
    }

    // STATUS TOGGLE LOGIC
    function setModalStatus(status) {
        document.getElementById('hStatus').value = status;
        updateStatusButtonsUI(status);
        
        const inputs = [document.getElementById('hNextStep'), document.getElementById('hNextDate'), document.getElementById('hNextTime')];
        
        if (status === 'done') {
            inputs.forEach(inp => inp.disabled = true);
            document.getElementById('hNextStep').placeholder = "Задача выполнена";
        } else {
            inputs.forEach(inp => inp.disabled = false);
            document.getElementById('hNextStep').placeholder = "Конкретное действие...";
        }
    }

    function updateStatusButtonsUI(status) {
        const newBtn = document.getElementById('statusNewBtn');
        const workBtn = document.getElementById('statusWorkBtn');
        const doneBtn = document.getElementById('statusDoneBtn');
        
        newBtn.classList.remove('active-new');
        workBtn.classList.remove('active-work');
        doneBtn.classList.remove('active-done');
        
        if (status === 'new') newBtn.classList.add('active-new');
        else if (status === 'work') workBtn.classList.add('active-work');
        else if (status === 'done') doneBtn.classList.add('active-done');
    }

    function closeModal(id) {
        document.getElementById(id).classList.add('hidden');
        if (id === 'clientModal') {
            renderClientWizardPanel();
            renderClientModalValidationState();
        }
    }

    function showModalOnTop(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        const openModals = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden)'));
        const topZ = openModals.reduce((max, item) => {
            const z = parseInt(window.getComputedStyle(item).zIndex, 10);
            return Number.isFinite(z) ? Math.max(max, z) : max;
        }, 1000);
        modal.style.zIndex = String(topZ + 1);
        modal.classList.remove('hidden');
    }
    window.onclick = function(e) { if(e.target.classList.contains('modal-overlay')) e.target.classList.add('hidden'); }

    function saveClient(options = {}) {
        const advanceWizard = Boolean(options && options.advanceWizard);
        const idVal = document.getElementById('clientId').value;
        const name = document.getElementById('cName').value.trim();
        if(!name) return alert('Название обязательно!');
        const wizardWasActive = clientFillWizardState.active;
        const prevQueue = wizardWasActive ? [...clientFillWizardState.queue] : [];
        const prevIndex = wizardWasActive ? clientFillWizardState.index : 0;
        const touchedTs = Date.now();
        const normalizedContacts = (Array.isArray(modalContacts) ? modalContacts : [])
            .map((c, idx) => normalizeContact(c, idx))
            .filter(c => c.name || c.role || c.phones.length);
        const autoPhone = getMainClientPhoneFromContacts(normalizedContacts);
        
        const clientData = {
            id: idVal ? (isNaN(idVal) ? idVal : parseInt(idVal)) : Date.now(),
            name: name,
            address: document.getElementById('cAddress').value.trim(),
            phone: autoPhone || formatPhoneValue(document.getElementById('cPhone').value.trim()),
            type: getSelectedClientTypes(),
            class: normalizeClientClass(document.getElementById('cClass').value),
            status: document.getElementById('cStatus').value,
            related: document.getElementById('cRelated').value.trim(),
            relatedClientIds: normalizeRelatedClientIds(modalRelatedClientIds),
            notes: document.getElementById('cNotes').value.trim(),
            contacts: normalizedContacts,
            updatedAt: touchedTs
        };
        
        if(idVal) {
            const idx = clients.findIndex(c => String(c.id) === String(idVal));
            if(idx !== -1) {
                if(!clientData.contacts.length && clients[idx].contacts) clientData.contacts = clients[idx].contacts;
                clients[idx] = clientData;
            }
        } else {
            clients.push(clientData);
        }
        touchClientActivity(clientData.id, touchedTs);
        
        saveData();
        closeModal('clientModal');
        if(!idVal) selectClient(clientData.id);
        reconcileClientFillWizardAfterSave(clientData.id, advanceWizard, prevQueue, prevIndex);
        return clientData;
    }

    function saveHistory() {
        const touchedTs = Date.now();
        const idVal = document.getElementById('hId').value;
        const hiddenClientId = document.getElementById('hClientId').value;
        applyTaskClientFromSearch();
        const hClientSelect = document.getElementById('hClientSelect');
        const selectedClientId = hClientSelect.value || resolveTaskClientIdFromSearch(true);
        if (selectedClientId && !hClientSelect.value) hClientSelect.value = selectedClientId;
        const existingRecord = idVal ? history.find(h => String(h.id) === String(idVal)) : null;
        const clientId = (forcedHistoryClientId || hiddenClientId || selectedClientId || (existingRecord ? existingRecord.clientId : '') || '').toString();
        const selectedContactPersonId = document.getElementById('hContactPersonSelect').value || '';
        const status = document.getElementById('hStatus').value;
        const wasDoneBeforeSave = existingRecord ? String(existingRecord.taskStatus || 'new') === 'done' : false;
        if (!clientId) return alert('Выберите контрагента');

        const date = document.getElementById('hDate').value;
        const timeRaw = document.getElementById('hTime').value;
        const time = timeRaw || '00:00';
        const type = document.getElementById('hType').value;
        const result = document.getElementById('hResult').value;
        const desc = document.getElementById('hTopic').value;
        if (status === 'done' && !String(result || '').trim()) {
            alert('Заполните итог выполнения задачи.');
            document.getElementById('hResult').focus();
            return;
        }

        let nextDate = document.getElementById('hNextDate').value;
        let nextTime = document.getElementById('hNextTime').value;
        let nextStep = (document.getElementById('hNextStep').value || '').trim();

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const contactDateTime = new Date(`${date}T${time}`);
        const isFutureContact = !isNaN(contactDateTime.getTime()) && contactDateTime > now;
        let completedAt = '';
        let completedDate = '';
        let completedTime = '';

        if (status !== 'done') {
            // Single-task flow: task text comes from "Тема".
            nextStep = (desc || result || 'Задача без описания').trim();
            // Single-task flow: execution date/time always follows main date/time fields.
            nextDate = date;
            nextTime = timeRaw || '';
        } else {
            nextDate = '';
            nextTime = '';
            nextStep = '';
            const completion = getCompletionByTaskMoment(date, timeRaw || '');
            completedDate = completion.finalDate;
            completedTime = completion.finalTime;
            completedAt = completion.finalIso;
        }

        // If this is a future contact/task and "next step" is empty, treat current record as an active task.
        if (!nextStep && isFutureContact && status !== 'done') {
            nextDate = date;
            nextTime = timeRaw;
            nextStep = (desc || '').trim() || 'Задача без описания';
        }

        const record = {
            id: idVal ? idVal : Date.now(),
            clientId: clientId,
            deal_id: existingRecord ? String(existingRecord.deal_id || '') : '',
            contactPersonId: selectedContactPersonId,
            created_at: existingRecord ? String(existingRecord.created_at || '') : new Date(touchedTs).toISOString(),
            date: date,
            time: time,
            type: type,
            result: result,
            desc: desc,
            nextDate: nextDate,
            nextTime: nextTime,
            nextStep: nextStep,
            taskStatus: status,
            completedAt: status === 'done' ? completedAt : '',
            completedDate: status === 'done' ? completedDate : '',
            completedTime: status === 'done' ? completedTime : '',
            modifiedAt: touchedTs
        };
        const oldDueIso = existingRecord ? String(existingRecord.due_at || buildTaskDueIso(existingRecord) || '') : '';
        if (existingRecord) {
            [
                'temp',
                'created_at',
                'due_at',
                'last_event_at',
                'last_progress_at',
                'postpone_count',
                'postpone_points_total',
                'postpone_streak',
                'status',
                'events',
                'temp_last_recalc_at',
                'stagnation_points_total',
                'next_contact_at'
            ].forEach((key) => {
                if (existingRecord[key] === undefined) return;
                if (key === 'events' && Array.isArray(existingRecord.events)) {
                    record.events = existingRecord.events.map(e => ({
                        ...e,
                        meta: e && e.meta && typeof e.meta === 'object' ? { ...e.meta } : {}
                    }));
                    return;
                }
                record[key] = existingRecord[key];
            });
        }
        ensureWorkItemTempFields(record, new Date(touchedTs));
        ensureTaskCreatedAt(record);

        if (status !== 'done' && existingRecord) {
            const newDueIso = String(record.due_at || buildTaskDueIso(record) || '');
            const oldDueTs = new Date(oldDueIso).getTime();
            const newDueTs = new Date(newDueIso).getTime();
            if (Number.isFinite(oldDueTs) && Number.isFinite(newDueTs) && newDueTs > oldDueTs && oldDueIso !== newDueIso) {
                record.due_at = oldDueIso;
                applyPostpone(record, newDueIso, 'Перенос через редактирование', new Date(touchedTs));
            } else {
                syncWorkItemDueAt(record);
            }
            if (!['frozen', 'lost', 'dnc', 'frozen_closed'].includes(String(record.status || '').trim())) {
                record.status = 'active';
            }
        }
        if (status === 'done') {
            record.status = 'won';
            if (!wasDoneBeforeSave) {
                applyEvent(record, {
                    type: 'DECISION_MADE',
                    at: record.completedAt || new Date(touchedTs),
                    meta: { status: 'won' },
                    comment: 'Задача закрыта через редактирование'
                });
            } else {
                record.temp = 0;
            }
        }

        if (idVal) {
            const idx = history.findIndex(h => String(h.id) === String(idVal));
            if (idx !== -1) history[idx] = record;
        } else {
            history.push(record);
        }
        touchClientTaskActivity(clientId, touchedTs);
        if (status === 'done') {
            setClientLastContact(clientId, touchedTs);
            markClientCalledToday(clientId, touchedTs);
        }

        saveData();
        forcedHistoryClientId = '';
        closeModal('historyModal');

        const becameDoneNow = status === 'done' && !wasDoneBeforeSave;
        if (becameDoneNow) {
            const shouldCreateNext = confirm('Создать следующую задачу для этого контрагента?');
            if (shouldCreateNext) openNewTaskModalForClient(clientId);
        }
    }

    function deleteCurrentClient() {
        if(!confirm('Удалить клиента и всю историю?')) return;
        delete clientTaskTouchedAt[String(currentClientId)];
        delete clientLastContactAt[String(currentClientId)];
        clients = clients.filter(c => String(c.id) !== String(currentClientId));
        history = history.filter(h => String(h.clientId) !== String(currentClientId));
        currentClientId = null;
        document.getElementById('clientDetails').classList.add('hidden');
        document.getElementById('emptyState').classList.remove('hidden');
        saveData();
    }

    function resetData() {
        if(confirm('Удалить ВСЕ данные?')) { CRMStore.clearAll(); location.reload(); }
    }

    // --- SOUND ---
    function toggleSound() {
        soundEnabled = !soundEnabled;
        const btn = document.getElementById('soundBtn');
        btn.innerText = soundEnabled ? '🔊 Звук вкл' : '🔇 Звук выкл';
        btn.className = soundEnabled ? 'btn-success' : 'btn-warning';
        if(soundEnabled) {
            void ensureNotificationAudioContext().then(() => playNotification());
            checkTaskReminders();
        }
    }
    function openCustomSoundPicker() {
        document.getElementById('customSoundFile')?.click();
    }

    function updateCustomSoundButtons() {
        const customBtn = document.getElementById('customSoundBtn');
        const resetBtn = document.getElementById('resetCustomSoundBtn');
        const hasCustom = Boolean(customNotificationSoundUrl);
        if (customBtn) {
            customBtn.className = hasCustom ? 'btn-success' : 'btn-primary';
            customBtn.innerText = hasCustom
                ? `🎵 ${String(customNotificationSoundName || 'Свой звук').slice(0, 24)}`
                : '🎵 Свой звук';
            customBtn.title = hasCustom ? `Выбран: ${customNotificationSoundName}` : 'Выбрать свой аудиофайл';
        }
        if (resetBtn) {
            resetBtn.disabled = !hasCustom;
            resetBtn.style.opacity = hasCustom ? '1' : '0.65';
            resetBtn.title = hasCustom ? 'Сбросить на встроенный звук' : 'Свой звук не выбран';
        }
    }

    function onCustomSoundFileSelected(inputEl) {
        const file = inputEl?.files?.[0];
        if (!file) return;
        if (!String(file.type || '').startsWith('audio/')) {
            alert('Выберите аудиофайл (mp3/wav/ogg и т.п.)');
            inputEl.value = '';
            return;
        }
        if (customNotificationSoundUrl) {
            try { URL.revokeObjectURL(customNotificationSoundUrl); } catch(e) {}
        }
        customNotificationSoundUrl = URL.createObjectURL(file);
        customNotificationSoundName = String(file.name || 'Свой звук');
        updateCustomSoundButtons();
        inputEl.value = '';
        if (soundEnabled) playNotification();
    }

    function resetCustomSound() {
        if (customNotificationSoundUrl) {
            try { URL.revokeObjectURL(customNotificationSoundUrl); } catch(e) {}
        }
        customNotificationSoundUrl = '';
        customNotificationSoundName = '';
        updateCustomSoundButtons();
    }

    async function playNotification() {
        try {
            if (customNotificationSoundUrl) {
                const audio = new Audio(customNotificationSoundUrl);
                audio.volume = 1;
                await audio.play();
                return;
            }
            const ctx = notificationAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.55);
        } catch(e){}
    }

    // --- EXPORT/IMPORT (WITH CONVERSION) ---




