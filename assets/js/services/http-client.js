(function (window) {
    "use strict";

    function joinUrl(baseUrl, path) {
        var normalizedBase = String(baseUrl || "").replace(/\/+$/, "");
        var normalizedPath = String(path || "").replace(/^\/+/, "");
        return normalizedBase + "/" + normalizedPath;
    }

    function normalizeHeaders(headers) {
        var normalized = {};
        var key;

        for (key in headers) {
            if (Object.prototype.hasOwnProperty.call(headers, key) && typeof headers[key] !== "undefined") {
                normalized[key] = headers[key];
            }
        }

        return normalized;
    }

    function parseResponse(response) {
        var contentType = response.headers.get("content-type") || "";

        if (contentType.indexOf("application/json") !== -1) {
            return response.json();
        }

        return response.text().then(function (text) {
            return text ? { message: text } : null;
        });
    }

    function request(path, options) {
        var config = window.APP_CONFIG || {};
        var requestOptions = options || {};
        var headers = normalizeHeaders(requestOptions.headers || {});
        var method = requestOptions.method || "GET";
        var body = requestOptions.body;

        if (!headers.Accept) {
            headers.Accept = "application/json";
        }

        if (typeof body !== "undefined" && !headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }

        return fetch(joinUrl(config.API_BASE_URL, path), {
            method: method,
            headers: headers,
            body: typeof body === "undefined" ? undefined : JSON.stringify(body)
        }).then(function (response) {
            return parseResponse(response).then(function (data) {
                if (!response.ok) {
                    var message = data && data.message ? data.message : "Request failed";
                    var error = new Error(message);
                    error.status = response.status;
                    error.data = data;
                    throw error;
                }

                return data;
            });
        });
    }

    window.httpClient = {
        request: request
    };
})(window);
