import { expect, test } from "@playwright/test";
import { apiFor, escapeRegExp, loginViaUi, readAccessToken, runId, type Api } from "./helpers";

/**
 * Product + stock → POS checkout → stock drops.
 *
 * A freshly created product has no `Stock` row, so it cannot be reached from
 * the Stock Levels page (which lists stock rows, not products). The initial
 * quantity therefore comes in through the Movements Ledger, whose `POST
 * /inventory/movements` upserts the `Stock` row.
 */
test.describe("POS + inventory flow", () => {
  const suffix = runId();
  const productName = `E2E Product ${suffix}`;
  const productOption = new RegExp(`^${escapeRegExp(productName)} \\(`);
  const openingStock = 10;
  const soldQuantity = 1;
  const closingStock = openingStock - soldQuantity;

  let api: Api | undefined;
  let orderId: string | undefined;

  test.afterAll(async () => {
    if (!api) return;
    try {
      if (orderId) {
        // A checkout creates the order as CONFIRMED, and DELETE only accepts
        // PENDING or CANCELLED — cancel first, which also restocks.
        const cancelled = await api.patch(`/sales/orders/${orderId}/status`, {
          status: "CANCELLED",
        });
        if (cancelled.status >= 400) {
          console.warn(`[e2e] order cancel returned HTTP ${cancelled.status}`);
        }
        await api.del(`/sales/orders/${orderId}`);
      }

      // The product must go last: `OrderItem.product` is `onDelete: Restrict`.
      const found = await api.get("/inventory/products", { search: productName, pageSize: "5" });
      const productId: string | undefined = found.body?.data?.items?.[0]?.id;
      if (productId) {
        await api.del(`/inventory/products/${productId}`);
      }
    } catch (err) {
      console.warn("[e2e] inventory cleanup failed:", err);
    } finally {
      await api.dispose();
    }
  });

  test("creates a product, stocks it in, sells it and the stock drops", async ({ page }) => {
    await loginViaUi(page);
    api = await apiFor(await readAccessToken(page));

    // 1. Create the product -------------------------------------------------
    await page.goto("/inventory/products");
    await page.getByRole("button", { name: "New product" }).first().click();
    let dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Create new product" })).toBeVisible();

    // The SKU field is read-only and the API generates the code itself.
    await page.getByLabel(/^Name\*?$/).fill(productName);
    await page.getByLabel("Unit price (sell)").fill("25");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(dialog).toBeHidden();

    // 2. Stock it in through the ledger -------------------------------------
    await page.goto("/inventory/movements");
    await page.getByRole("button", { name: "Create Movement" }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Create movement" })).toBeVisible();

    // Movement type already defaults to "IN", which is the case we want.
    await page.getByLabel("Movement type").click();
    await page.getByRole("option", { name: "Stock In" }).click();
    await page.getByLabel("Warehouse").click();
    await page.getByRole("option", { name: "Main Warehouse" }).click();
    await page.getByLabel("Product").click();
    await page.getByRole("option", { name: productOption }).click();
    await page.getByLabel("Quantity").fill(String(openingStock));
    await page.getByRole("button", { name: "Create movement" }).click();
    await expect(dialog).toBeHidden();

    // 3. Sell it at the POS --------------------------------------------------
    await page.goto("/sales/pos");
    await page.getByPlaceholder("Search products by name, SKU, or barcode…").fill(productName);
    const productRow = page.getByRole("row", { name: new RegExp(escapeRegExp(productName)) });
    await expect(productRow).toBeVisible();
    await productRow.getByRole("button", { name: "Add" }).click();

    await page.getByRole("button", { name: /^Pay \$/ }).click();
    const payDialog = page.getByRole("dialog");
    await expect(payDialog.getByRole("heading", { name: "Payment" })).toBeVisible();

    // Payment method defaults to Cash; its label is not tied to the input, so
    // the tender field is reached by its placeholder.
    await payDialog.getByPlaceholder("0.00").fill("100");
    await payDialog.getByRole("button", { name: "Complete sale" }).click();

    // The toast also renders an aria-live mirror and a longer description, so
    // the substring match is ambiguous — anchor it.
    await expect(
      page.getByText("Order completed successfully", { exact: true })
    ).toBeVisible();
    await page.waitForURL(/\/sales\/orders\//);
    orderId = page.url().split("/sales/orders/")[1]?.split(/[?#]/)[0];

    // 4. The stock dropped ---------------------------------------------------
    await page.goto("/inventory/stock");
    await page.getByPlaceholder("Search by product name, SKU, or warehouse…").fill(productName);
    const stockRow = page.getByRole("row", { name: new RegExp(escapeRegExp(productName)) });
    await expect(stockRow).toBeVisible();
    // Columns: Product, Warehouse, Quantity, Minimum Level, Status, Updated.
    await expect(stockRow.getByRole("cell").nth(2)).toHaveText(String(closingStock));
  });
});
