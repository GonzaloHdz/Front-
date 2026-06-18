(function (window, document) {
    "use strict";

    function redirectToLogin() {
        window.location.replace("page-login.html");
    }

    function setFeedback(element, type, message) {
        element.className = "alert alert-" + type;
        element.textContent = message;
    }

    function parsePositiveInt(value) {
        var trimmed = String(value || "").trim();
        if (!trimmed) {
            return null;
        }

        var parsed = Number(trimmed);
        return isFinite(parsed) && Math.floor(parsed) === parsed && parsed > 0 ? parsed : null;
    }

    function formatTimestamp(unixTimestamp) {
        if (!unixTimestamp) {
            return "-";
        }

        try {
            return new Date(Number(unixTimestamp) * 1000).toLocaleString();
        } catch (error) {
            return String(unixTimestamp);
        }
    }

    function indexProductsById(products) {
        var map = {};
        products.forEach(function (product) {
            map[String(product.id)] = product;
        });
        return map;
    }

    function mergeInventory(products, items) {
        var itemMap = {};
        var rows = [];

        items.forEach(function (item) {
            itemMap[String(item.product_id)] = item;
        });

        products.forEach(function (product) {
            var item = itemMap[String(product.id)] || null;
            rows.push({
                product_id: product.id,
                sku: product.sku,
                name: product.name,
                quantity: item ? item.quantity : 0,
                min_quantity: item ? item.min_quantity : 0,
                updated_at: item ? item.updated_at : null
            });
        });

        items.forEach(function (item) {
            if (!indexProductsById(products)[String(item.product_id)]) {
                rows.push({
                    product_id: item.product_id,
                    sku: "N/A",
                    name: "Producto #" + item.product_id,
                    quantity: item.quantity,
                    min_quantity: item.min_quantity,
                    updated_at: item.updated_at
                });
            }
        });

        return rows;
    }

    function renderInventory(tableBody, rows) {
        tableBody.innerHTML = "";

        if (!rows.length) {
            var emptyRow = document.createElement("tr");
            var emptyCell = document.createElement("td");
            emptyCell.colSpan = 6;
            emptyCell.className = "text-muted";
            emptyCell.textContent = "No hay productos o stock registrado para esta sucursal.";
            emptyRow.appendChild(emptyCell);
            tableBody.appendChild(emptyRow);
            return;
        }

        rows.forEach(function (row, index) {
            var tr = document.createElement("tr");
            var stockClass = row.quantity <= row.min_quantity ? "text-danger font-weight-bold" : "";

            function td(text, className) {
                var cell = document.createElement("td");
                cell.textContent = text;
                if (className) {
                    cell.className = className;
                }
                return cell;
            }

            tr.appendChild(td(String(index + 1)));
            tr.appendChild(td(String(row.sku || "")));
            tr.appendChild(td(String(row.name || "")));
            tr.appendChild(td(String(row.quantity), stockClass));
            tr.appendChild(td(String(row.min_quantity)));
            tr.appendChild(td(formatTimestamp(row.updated_at)));
            tableBody.appendChild(tr);
        });
    }

    function filterInventoryRows(tableBody, searchTerm) {
        var normalizedSearch = String(searchTerm || "").trim().toLowerCase();
        var rows = tableBody ? tableBody.querySelectorAll("tr") : [];

        Array.prototype.forEach.call(rows, function (row) {
            var cells = row.getElementsByTagName("td");
            if (cells.length < 3) {
                row.style.display = "";
                return;
            }

            var skuText = String(cells[1].textContent || "").toLowerCase();
            var nameText = String(cells[2].textContent || "").toLowerCase();
            var matches = !normalizedSearch || skuText.indexOf(normalizedSearch) !== -1 || nameText.indexOf(normalizedSearch) !== -1;

            row.style.display = matches ? "" : "none";
        });
    }

    function calculateDashboardMetrics(rows, movements) {
        var totalStock = 0;
        var alertProducts = 0;
        var lastActivity = null;

        rows.forEach(function (row) {
            var quantity = Number(row.quantity || 0);
            var minQuantity = Number(row.min_quantity || 0);
            var updatedAt = Number(row.updated_at || 0);

            totalStock += quantity;

            if (quantity <= minQuantity) {
                alertProducts += 1;
            }

            if (updatedAt && (!lastActivity || updatedAt > lastActivity)) {
                lastActivity = updatedAt;
            }
        });

        movements.forEach(function (movement) {
            var createdAt = Number(movement.created_at || 0);
            if (createdAt && (!lastActivity || createdAt > lastActivity)) {
                lastActivity = createdAt;
            }
        });

        return {
            totalStock: totalStock,
            alertProducts: alertProducts,
            lastActivity: lastActivity
        };
    }

    function renderDashboardCards(totalStockElement, alertProductsElement, lastActivityElement, alertsContainerElement, rows, movements) {
        var metrics = calculateDashboardMetrics(rows, movements);

        if (totalStockElement) {
            totalStockElement.textContent = String(metrics.totalStock);
        }

        if (alertProductsElement) {
            alertProductsElement.textContent = String(metrics.alertProducts);
        }

        if (lastActivityElement) {
            lastActivityElement.textContent = metrics.lastActivity ? formatTimestamp(metrics.lastActivity) : "-";
        }

        if (alertsContainerElement) {
            if (metrics.alertProducts > 0) {
                alertsContainerElement.innerHTML = [
                    '<div class="alert alert-danger" role="alert">',
                    "Atencion: Tienes ",
                    String(metrics.alertProducts),
                    " productos con stock criticamente bajo. Por favor, verifica los niveles en la tabla inferior.",
                    "</div>"
                ].join("");
            } else {
                alertsContainerElement.innerHTML = "";
            }
        }
    }

    function renderMovements(tableBody, movements, productMap) {
        tableBody.innerHTML = "";

        if (!movements.length) {
            var emptyRow = document.createElement("tr");
            var emptyCell = document.createElement("td");
            emptyCell.colSpan = 6;
            emptyCell.className = "text-muted";
            emptyCell.textContent = "No hay movimientos registrados.";
            emptyRow.appendChild(emptyCell);
            tableBody.appendChild(emptyRow);
            return;
        }

        movements.forEach(function (movement) {
            var product = productMap[String(movement.product_id)] || null;
            var tr = document.createElement("tr");

            function td(text) {
                var cell = document.createElement("td");
                cell.textContent = text;
                return cell;
            }

            tr.appendChild(td(String(movement.id)));
            tr.appendChild(td(product ? product.sku : "Producto #" + movement.product_id));
            tr.appendChild(td(product ? product.name : "Producto #" + movement.product_id));
            tr.appendChild(td(String(movement.movement_type || "")));
            tr.appendChild(td(String(movement.quantity || 0)));
            tr.appendChild(td(formatTimestamp(movement.created_at)));
            tableBody.appendChild(tr);
        });
    }

    function renderProductOptions(select, products) {
        select.innerHTML = "";

        var placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = products.length ? "Selecciona un producto" : "No hay productos";
        select.appendChild(placeholder);

        products.forEach(function (product) {
            var option = document.createElement("option");
            option.value = String(product.id);
            option.textContent = product.sku + " - " + product.name;
            select.appendChild(option);
        });
    }

    if (!window.authService || !window.authService.getAccessToken()) {
        redirectToLogin();
        return;
    }

    document.addEventListener("DOMContentLoaded", function () {
        var pageFeedback = document.getElementById("inventory-feedback");
        var branchIdInput = document.getElementById("inventory-branch-id");
        var reloadButton = document.getElementById("inventory-reload");
        var inventoryBody = document.getElementById("inventory-table-body");
        var movementsBody = document.getElementById("movements-table-body");
        var movementForm = document.getElementById("movement-form");
        var movementFeedback = document.getElementById("movement-feedback");
        var movementWarning = document.getElementById("movement-warning");
        var productSelect = document.getElementById("movement-product");
        var typeSelect = document.getElementById("movement-type");
        var quantityInput = document.getElementById("movement-quantity");
        var referenceInput = document.getElementById("movement-reference");
        var submitButton = document.getElementById("movement-submit");
        var totalStockCard = document.getElementById("total-stock-card");
        var alertProductsCard = document.getElementById("alert-products-card");
        var lastActivityCard = document.getElementById("last-activity-card");
        var liveAlertsContainer = document.getElementById("live-alerts-container");
        var searchProductInput = document.getElementById("search-product-input");

        if (!pageFeedback || !branchIdInput || !reloadButton || !inventoryBody || !movementsBody || !movementForm || !movementFeedback || !movementWarning || !productSelect || !typeSelect || !quantityInput || !referenceInput || !submitButton) {
            return;
        }

        var state = {
            products: [],
            productMap: {},
            inventoryRows: [],
            movements: [],
            submitting: false
        };

        pageFeedback.classList.add("d-none");
        movementFeedback.classList.add("d-none");
        movementWarning.classList.add("d-none");

        function getCurrentBranchId() {
            return parsePositiveInt(branchIdInput.value);
        }

        function getCurrentStock(productId) {
            var stock = 0;

            state.inventoryRows.forEach(function (row) {
                if (Number(row.product_id) === Number(productId)) {
                    stock = Number(row.quantity || 0);
                }
            });

            return stock;
        }

        function setSubmitting(isSubmitting) {
            state.submitting = isSubmitting;
            submitButton.textContent = isSubmitting ? "Registrando..." : "Registrar movimiento";
            validateMovementForm();
        }

        function validateMovementForm() {
            var productId = parsePositiveInt(productSelect.value);
            var quantity = parsePositiveInt(quantityInput.value);
            var branchId = getCurrentBranchId();
            var movementType = String(typeSelect.value || "").trim().toLowerCase();
            var canSubmit = !state.submitting && !!productId && !!quantity && !!branchId && state.products.length > 0;
            var warningMessage = "";

            if (movementType === "salida" && productId && quantity) {
                var currentStock = getCurrentStock(productId);
                if (quantity > currentStock) {
                    canSubmit = false;
                    warningMessage = "No hay suficiente stock disponible. Operacion rechazada.";
                }
            }

            submitButton.disabled = !canSubmit;

            if (warningMessage) {
                setFeedback(movementWarning, "warning", warningMessage);
                movementWarning.classList.remove("d-none");
            } else {
                movementWarning.classList.add("d-none");
            }
        }

        function handleLoadError(error) {
            if (error && (error.status === 401 || error.status === 403)) {
                window.authService.clearSession();
                redirectToLogin();
                return;
            }

            renderProductOptions(productSelect, state.products);
            renderInventory(inventoryBody, []);
            renderMovements(movementsBody, [], state.productMap);
            state.inventoryRows = [];
            state.movements = [];
            renderDashboardCards(totalStockCard, alertProductsCard, lastActivityCard, liveAlertsContainer, state.inventoryRows, state.movements);

            if (error && error.status === 404) {
                setFeedback(pageFeedback, "danger", "La sucursal indicada no existe en el backend.");
            } else if (state.products.length) {
                setFeedback(pageFeedback, "warning", "Se cargaron los productos, pero no fue posible cargar inventario o movimientos.");
            } else {
                setFeedback(pageFeedback, "danger", "No fue posible cargar productos, inventario o movimientos.");
            }

            pageFeedback.classList.remove("d-none");
            validateMovementForm();
        }

        function loadPageData() {
            var branchId = getCurrentBranchId();

            if (!branchId) {
                setFeedback(pageFeedback, "danger", "Ingresa un Branch ID valido para consultar inventario.");
                pageFeedback.classList.remove("d-none");
                renderProductOptions(productSelect, state.products);
                renderInventory(inventoryBody, []);
                renderMovements(movementsBody, [], {});
                renderDashboardCards(totalStockCard, alertProductsCard, lastActivityCard, liveAlertsContainer, [], []);
                submitButton.disabled = true;
                return Promise.resolve();
            }

            setFeedback(pageFeedback, "info", "Cargando inventario y movimientos...");
            pageFeedback.classList.remove("d-none");

            return window.productsService.listProducts().then(function (products) {
                state.products = products || [];
                state.productMap = indexProductsById(state.products);
                renderProductOptions(productSelect, state.products);

                return Promise.all([
                    window.inventoryService.listInventory(branchId),
                    window.inventoryService.listMovements(branchId, 20)
                ]).then(function (results) {
                    state.inventoryRows = mergeInventory(state.products, results[0] || []);
                    state.movements = results[1] || [];

                    renderInventory(inventoryBody, state.inventoryRows);
                    filterInventoryRows(inventoryBody, searchProductInput ? searchProductInput.value : "");
                    renderMovements(movementsBody, state.movements, state.productMap);
                    renderDashboardCards(totalStockCard, alertProductsCard, lastActivityCard, liveAlertsContainer, state.inventoryRows, state.movements);

                    if (!state.products.length) {
                        setFeedback(pageFeedback, "warning", "No hay productos creados. Crea productos antes de registrar movimientos.");
                        pageFeedback.classList.remove("d-none");
                    } else {
                        pageFeedback.classList.add("d-none");
                    }

                    validateMovementForm();
                });
            }).catch(function (error) {
                handleLoadError(error);
            });
        }

        window.authService.fetchProfile().then(function () {
            return loadPageData();
        }).catch(function () {
            window.authService.clearSession();
            redirectToLogin();
        });

        reloadButton.addEventListener("click", function () {
            loadPageData();
        });

        if (searchProductInput) {
            searchProductInput.addEventListener("input", function () {
                filterInventoryRows(inventoryBody, searchProductInput.value);
            });
        }

        branchIdInput.addEventListener("input", validateMovementForm);
        productSelect.addEventListener("change", validateMovementForm);
        typeSelect.addEventListener("change", validateMovementForm);
        quantityInput.addEventListener("input", validateMovementForm);

        movementForm.addEventListener("submit", function (event) {
            var branchId = getCurrentBranchId();
            var productId = parsePositiveInt(productSelect.value);
            var quantity = parsePositiveInt(quantityInput.value);
            var movementType = String(typeSelect.value || "").trim().toLowerCase();
            var reference = String(referenceInput.value || "").trim();

            event.preventDefault();
            movementFeedback.classList.add("d-none");
            validateMovementForm();

            if (submitButton.disabled) {
                return;
            }

            if (!branchId || !productId || !quantity) {
                setFeedback(movementFeedback, "danger", "Completa branch, producto y cantidad.");
                movementFeedback.classList.remove("d-none");
                return;
            }

            setSubmitting(true);
            setFeedback(movementFeedback, "info", "Registrando movimiento...");
            movementFeedback.classList.remove("d-none");

            window.inventoryService.createMovement({
                branch_id: branchId,
                product_id: productId,
                movement_type: movementType,
                quantity: quantity,
                reference: reference || null
            }).then(function () {
                setFeedback(movementFeedback, "success", "Movimiento registrado correctamente.");
                movementFeedback.classList.remove("d-none");
                quantityInput.value = "";
                referenceInput.value = "";
                typeSelect.value = "entrada";
                setSubmitting(false);
                loadPageData();
            }).catch(function (error) {
                var apiError = error && error.data && error.data.error;
                var message = "No fue posible registrar el movimiento.";

                if (apiError === "negative_stock_rejected") {
                    message = "No hay suficiente stock disponible. Operacion rechazada.";
                } else if (apiError === "not_found") {
                    message = error.data && error.data.message ? error.data.message : "Sucursal o producto no encontrado.";
                } else if (apiError === "validation_error" && error.data && error.data.message) {
                    message = error.data.message;
                } else if (error && error.message) {
                    message = error.message;
                }

                setFeedback(movementFeedback, "danger", message);
                movementFeedback.classList.remove("d-none");
                setSubmitting(false);
                validateMovementForm();
            });
        });
    });
})(window, document);
