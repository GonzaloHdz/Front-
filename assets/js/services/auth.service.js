(function (window) {
    "use strict";

    function getStorageKey() {
        return window.APP_CONFIG.STORAGE_KEYS.AUTH_SESSION;
    }

    function getStorage(rememberSession) {
        return rememberSession ? window.localStorage : window.sessionStorage;
    }

    function getStoredSessionData() {
        var storageKey = getStorageKey();
        var localValue = window.localStorage.getItem(storageKey);
        var sessionValue = window.sessionStorage.getItem(storageKey);

        if (localValue) {
            return { storage: window.localStorage, raw: localValue };
        }

        if (sessionValue) {
            return { storage: window.sessionStorage, raw: sessionValue };
        }

        return null;
    }

    function clearStoredSession() {
        var storageKey = getStorageKey();
        window.localStorage.removeItem(storageKey);
        window.sessionStorage.removeItem(storageKey);
    }

    function saveSession(session, rememberSession) {
        var storageKey = getStorageKey();
        var storage = getStorage(rememberSession);

        clearStoredSession();
        storage.setItem(storageKey, JSON.stringify(session));
        return session;
    }

    function updateStoredSession(updater) {
        var storedSessionData = getStoredSessionData();
        var session;

        if (!storedSessionData) {
            return null;
        }

        try {
            session = JSON.parse(storedSessionData.raw);
        } catch (error) {
            clearStoredSession();
            return null;
        }

        session = updater(session) || session;
        storedSessionData.storage.setItem(getStorageKey(), JSON.stringify(session));
        return session;
    }

    function getSession() {
        var storedSessionData = getStoredSessionData();
        var raw = storedSessionData ? storedSessionData.raw : null;

        if (!raw) {
            return null;
        }

        try {
            return JSON.parse(raw);
        } catch (error) {
            clearStoredSession();
            return null;
        }
    }

    function getAccessToken() {
        var session = getSession();
        return session ? session.access_token : null;
    }

    function getAuthorizationHeaders() {
        var accessToken = getAccessToken();
        return accessToken ? { Authorization: "Bearer " + accessToken } : {};
    }

    function fetchProfile() {
        return window.httpClient.request(window.APP_CONFIG.AUTH_ENDPOINTS.ME, {
            method: "GET",
            headers: getAuthorizationHeaders()
        }).then(function (profile) {
            updateStoredSession(function (session) {
                session.profile = profile;
                session.profile_loaded_at = new Date().toISOString();
                return session;
            });

            return profile;
        });
    }

    function login(credentials, rememberSession) {
        return window.httpClient.request(window.APP_CONFIG.AUTH_ENDPOINTS.LOGIN, {
            method: "POST",
            body: {
                company_id: credentials.company_id,
                email: credentials.email,
                password: credentials.password
            }
        }).then(function (data) {
            return saveSession({
                access_token: data.access_token,
                token_type: data.token_type,
                company_id: credentials.company_id,
                email: String(credentials.email || "").trim().toLowerCase(),
                saved_at: new Date().toISOString()
            }, rememberSession);
        });
    }

    window.authService = {
        login: login,
        fetchProfile: fetchProfile,
        getSession: getSession,
        getAccessToken: getAccessToken,
        getAuthorizationHeaders: getAuthorizationHeaders,
        clearSession: clearStoredSession
    };
})(window);
