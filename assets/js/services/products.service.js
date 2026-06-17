(function (window) {
    "use strict";

    function getAuthorizationHeaders() {
        if (!window.authService) {
            return {};
        }

        return window.authService.getAuthorizationHeaders();
    }

    function getCompanyId() {
        if (!window.authService) {
            return null;
        }

        var session = window.authService.getSession && window.authService.getSession();
        return session && session.company_id ? session.company_id : null;
    }

    function listProducts() {
        return window.httpClient.request(window.APP_CONFIG.PRODUCTS_ENDPOINTS.LIST, {
            method: "GET",
            headers: getAuthorizationHeaders()
        }).then(function (data) {
            return data && data.products ? data.products : [];
        });
    }

    function createProduct(product) {
        var payload = {
            company_id: getCompanyId(),
            category_id: product.category_id,
            sku: product.sku,
            name: product.name,
            description: product.description
        };

        return window.httpClient.request(window.APP_CONFIG.PRODUCTS_ENDPOINTS.CREATE, {
            method: "POST",
            headers: getAuthorizationHeaders(),
            body: payload
        }).then(function (data) {
            return data && data.product ? data.product : data;
        });
    }

    window.productsService = {
        listProducts: listProducts,
        createProduct: createProduct
    };
})(window);
