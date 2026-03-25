(function (global) {
    const KEYS = Object.freeze({
        clients: 'crm_clients_v5',
        history: 'crm_history_v5',
        deals: 'crm_deals_v1',
        touches: 'crm_touches_v1',
        inactiveFilter: 'crm_inactive_filter_v1',
        clientTypeOptions: 'crm_client_type_options_v1',
        clientSort: 'crm_client_sort_v1',
        clientTaskTouched: 'crm_client_task_touched_v1',
        clientLastContact: 'crm_client_last_contact_v1',
        callSessionLog: 'crm_call_session_log_v1',
        classMigrationDone: 'crm_client_class_default_migration_v1',
        dbLastJsonSaveAt: 'crm_db_last_json_save_at_v1'
    });

    function resolveKey(keyOrAlias) {
        return KEYS[keyOrAlias] || keyOrAlias;
    }

    const CRMStore = {
        keys: KEYS,
        get(keyOrAlias) {
            return localStorage.getItem(resolveKey(keyOrAlias));
        },
        set(keyOrAlias, value) {
            localStorage.setItem(resolveKey(keyOrAlias), String(value));
        },
        remove(keyOrAlias) {
            localStorage.removeItem(resolveKey(keyOrAlias));
        },
        getJSON(keyOrAlias, fallback = null) {
            const raw = this.get(keyOrAlias);
            if (!raw) return fallback;
            try {
                return JSON.parse(raw);
            } catch (e) {
                return fallback;
            }
        },
        setJSON(keyOrAlias, value) {
            this.set(keyOrAlias, JSON.stringify(value));
        },
        clearAll() {
            Object.values(KEYS).forEach(key => localStorage.removeItem(key));
        }
    };

    global.CRMStore = CRMStore;
})(window);
