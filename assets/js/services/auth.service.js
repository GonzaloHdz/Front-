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

    function normalizeCompanyDetails(companyDetails) {
        return companyDetails && companyDetails.company ? companyDetails.company : companyDetails;
    }

    function isMeaningfulValue(value) {
        if (value === null || typeof value === "undefined") {
            return false;
        }

        if (typeof value !== "string") {
            return true;
        }

        value = value.trim();
        if (!value) {
            return false;
        }

        return ["informacion no registrada", "no registrado", "n/a", "null", "undefined"].indexOf(value.toLowerCase()) === -1;
    }

    function isCompanyProfileComplete(companyDetails) {
        var company = normalizeCompanyDetails(companyDetails);
        return !!(company && isMeaningfulValue(company.rfc) && isMeaningfulValue(company.phone));
    }

    function saveCompanyDetails(companyDetails) {
        return updateStoredSession(function (session) {
            session.company_details = companyDetails || null;
            session.company_profile_completed = isCompanyProfileComplete(companyDetails);
            session.company_details_loaded_at = new Date().toISOString();
            return session;
        });
    }

    function getCompanyDetailsFromSession() {
        var session = getSession();
        return session ? session.company_details || null : null;
    }

    function fetchCompanyDetails(companyId) {
        var endpointBase = window.APP_CONFIG.COMPANY_ENDPOINTS.DETAILS;
        var resolvedCompanyId = companyId || (getSession() && getSession().company_id);
        var endpoint = endpointBase + "?company_id=" + encodeURIComponent(resolvedCompanyId);

        return window.httpClient.request(endpoint, {
            method: "GET",
            headers: getAuthorizationHeaders()
        }).then(function (companyDetails) {
            saveCompanyDetails(companyDetails);
            return companyDetails;
        });
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
            var companyId = data && data.company_id ? data.company_id : credentials.company_id;
            var role = data && data.role ? data.role : null;
            var userId = data && data.user_id ? data.user_id : null;
            var email = String(credentials.email || "").trim().toLowerCase();
            var session = {
                access_token: data.access_token,
                token_type: data.token_type,
                company_id: companyId,
                user_id: userId,
                role: role,
                email: email,
                saved_at: new Date().toISOString()
            };

            try {
                var storage = getStorage(rememberSession);
                storage.setItem("token", String(data.access_token || ""));
                storage.setItem("company_id", String(companyId || ""));
                storage.setItem("user_role", String(role || ""));
            } catch (error) {
            }

            return saveSession(session, rememberSession);
        });
    }

    window.authService = {
        login: login,
        fetchProfile: fetchProfile,
        fetchCompanyDetails: fetchCompanyDetails,
        getSession: getSession,
        getCompanyDetails: getCompanyDetailsFromSession,
        getAccessToken: getAccessToken,
        getAuthorizationHeaders: getAuthorizationHeaders,
        isCompanyProfileComplete: isCompanyProfileComplete,
        saveCompanyDetails: saveCompanyDetails,
        clearSession: clearStoredSession
    };
})(window);
