(function (window) {
    "use strict";

    function getAuthorizationHeaders() {
        if (!window.authService) {
            return {};
        }

        return window.authService.getAuthorizationHeaders();
    }

    function requestInventory(branchId) {
        var query = "?branch_id=" + encodeURIComponent(branchId);
        return window.httpClient.request(window.APP_CONFIG.INVENTORY_ENDPOINTS.LIST + query, {
            method: "GET",
            headers: getAuthorizationHeaders()
        }).then(function (data) {
            return data && data.items ? data.items : [];
        });
    }

    function requestMovements(branchId, limit) {
        var query = "?branch_id=" + encodeURIComponent(branchId) + "&limit=" + encodeURIComponent(limit || 20);
        return window.httpClient.request(window.APP_CONFIG.INVENTORY_ENDPOINTS.MOVEMENTS + query, {
            method: "GET",
            headers: getAuthorizationHeaders()
        }).then(function (data) {
            return data && data.movements ? data.movements : [];
        });
    }

    function createMovement(payload) {
        return window.httpClient.request(window.APP_CONFIG.INVENTORY_ENDPOINTS.MOVEMENTS, {
            method: "POST",
            headers: getAuthorizationHeaders(),
            body: {
                branch_id: payload.branch_id,
                product_id: payload.product_id,
                movement_type: payload.movement_type,
                quantity: payload.quantity,
                reference: payload.reference
            }
        });
    }

    window.inventoryService = {
        listInventory: requestInventory,
        listMovements: requestMovements,
        createMovement: createMovement
    };
})(window);
