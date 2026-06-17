(function (window, document) {
    "use strict";

    function redirectToLogin() {
        window.location.replace("page-login.html");
    }

    function setFeedback(element, type, message) {
        element.className = "alert alert-" + type;
        element.textContent = message;
    }

    function normalizeSku(value) {
        return String(value || "").trim().toUpperCase();
    }

    function parseOptionalInt(value) {
        var trimmed = String(value || "").trim();
        if (!trimmed) {
            return null;
        }
        var parsed = Number(trimmed);
        return isFinite(parsed) && Math.floor(parsed) === parsed && parsed > 0 ? parsed : null;
    }

    function renderProducts(tbody, products) {
        tbody.innerHTML = "";

        if (!products.length) {
            var emptyRow = document.createElement("tr");
            var emptyCell = document.createElement("td");
            emptyCell.colSpan = 6;
            emptyCell.className = "text-muted";
            emptyCell.textContent = "No hay productos registrados.";
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
            return;
        }

        products.forEach(function (p, index) {
            var row = document.createElement("tr");

            function td(text) {
                var cell = document.createElement("td");
                cell.textContent = text;
                return cell;
            }

            row.appendChild(td(String(index + 1)));
            row.appendChild(td(String(p.sku || "")));
            row.appendChild(td(String(p.name || "")));
            row.appendChild(td(p.category_id == null ? "-" : String(p.category_id)));
            row.appendChild(td(p.is_active ? "Activo" : "Inactivo"));
            row.appendChild(td(p.description ? String(p.description) : "-"));

            tbody.appendChild(row);
        });
    }

    function buildSkuSet(products) {
        var set = {};
        products.forEach(function (p) {
            var sku = normalizeSku(p && p.sku);
            if (sku) {
                set[sku] = true;
            }
        });
        return set;
    }

    if (!window.authService || !window.authService.getAccessToken()) {
        redirectToLogin();
        return;
    }

    document.addEventListener("DOMContentLoaded", function () {
        var tableBody = document.getElementById("products-table-body");
        var form = document.getElementById("product-form");
        var feedback = document.getElementById("product-feedback");
        var submitButton = document.getElementById("product-submit");
        var skuInput = document.getElementById("product-sku");
        var nameInput = document.getElementById("product-name");
        var descriptionInput = document.getElementById("product-description");
        var categoryIdInput = document.getElementById("product-category-id");

        if (!tableBody || !form || !feedback || !submitButton) {
            return;
        }

        var products = [];
        var skuSet = {};

        feedback.classList.add("d-none");

        window.authService.fetchProfile().catch(function () {
            window.authService.clearSession();
            redirectToLogin();
        });

        function loadProducts() {
            setFeedback(feedback, "info", "Cargando productos...");
            feedback.classList.remove("d-none");

            return window.productsService.listProducts().then(function (items) {
                products = items || [];
                skuSet = buildSkuSet(products);
                renderProducts(tableBody, products);
                feedback.classList.add("d-none");
            }).catch(function (error) {
                if (error && (error.status === 401 || error.status === 403)) {
                    window.authService.clearSession();
                    redirectToLogin();
                    return;
                }
                setFeedback(feedback, "danger", "No fue posible cargar los productos.");
                feedback.classList.remove("d-none");
            });
        }

        function setSubmitting(isSubmitting) {
            submitButton.disabled = isSubmitting;
            submitButton.textContent = isSubmitting ? "Guardando..." : "Guardar producto";
        }

        loadProducts();

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            var sku = normalizeSku(skuInput.value);
            var name = String(nameInput.value || "").trim();
            var description = String(descriptionInput.value || "").trim();
            var categoryId = parseOptionalInt(categoryIdInput.value);

            feedback.classList.add("d-none");

            if (!sku) {
                setFeedback(feedback, "danger", "El SKU es obligatorio.");
                feedback.classList.remove("d-none");
                return;
            }

            if (skuSet[sku]) {
                setFeedback(feedback, "danger", "El SKU ya existe en la lista. Usa uno diferente.");
                feedback.classList.remove("d-none");
                return;
            }

            if (!name) {
                setFeedback(feedback, "danger", "El nombre del producto es obligatorio.");
                feedback.classList.remove("d-none");
                return;
            }

            if (String(categoryIdInput.value || "").trim() && !categoryId) {
                setFeedback(feedback, "danger", "El Category ID debe ser un entero mayor a 0.");
                feedback.classList.remove("d-none");
                return;
            }

            setSubmitting(true);
            setFeedback(feedback, "info", "Creando producto...");
            feedback.classList.remove("d-none");

            window.productsService.createProduct({
                sku: sku,
                name: name,
                description: description || null,
                category_id: categoryId
            }).then(function (created) {
                skuSet[sku] = true;
                products.unshift(created);
                renderProducts(tableBody, products);

                form.reset();
                categoryIdInput.value = "";
                setFeedback(feedback, "success", "Producto creado correctamente.");
                feedback.classList.remove("d-none");
                setSubmitting(false);
            }).catch(function (error) {
                var apiError = error && error.data && error.data.error;
                var message = "No fue posible crear el producto.";

                if (apiError === "sku_already_exists") {
                    message = "El SKU ya existe en esta empresa.";
                    skuSet[sku] = true;
                    loadProducts();
                } else if (apiError === "invalid_payload") {
                    message = "El backend rechazó el payload del producto.";
                } else if (apiError === "validation_error" && error.data && error.data.message) {
                    message = error.data.message;
                } else if (error && error.message) {
                    message = error.message;
                }

                setFeedback(feedback, "danger", message);
                feedback.classList.remove("d-none");
                setSubmitting(false);
            });
        });
    });
})(window, document);
