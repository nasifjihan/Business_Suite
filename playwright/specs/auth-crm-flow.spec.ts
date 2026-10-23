import { expect, test } from "@playwright/test";
import { apiFor, escapeRegExp, loginViaUi, readAccessToken, runId, type Api } from "./helpers";

/**
 * Login → create a customer → the customer shows up in the list.
 *
 * The list is searched rather than read from page 1 so the assertion cannot
 * pass by accident on a row another run left behind.
 */
test.describe("Auth + CRM flow", () => {
  const suffix = runId();
  const customerName = `E2E Customer ${suffix}`;

  let api: Api | undefined;

  test.afterAll(async () => {
    if (!api) return;
    try {
      const found = await api.get("/crm/customers", { search: customerName, pageSize: "5" });
      const id: string | undefined = found.body?.data?.items?.[0]?.id;
      if (id) {
        const res = await api.del(`/crm/customers/${id}`);
        if (res.status >= 400) {
          console.warn(`[e2e] customer cleanup returned HTTP ${res.status}`);
        }
      }
    } catch (err) {
      console.warn("[e2e] customer cleanup failed:", err);
    } finally {
      await api.dispose();
    }
  });

  test("signs in and creates a customer that appears in the list", async ({ page }) => {
    await loginViaUi(page);
    api = await apiFor(await readAccessToken(page));

    await page.goto("/crm/customers");
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();

    await page.getByRole("button", { name: "New customer" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Create new customer" })).toBeVisible();

    // `getByLabel("Name")` would also match "Company name" — the required
    // asterisk is part of the label text, hence the anchored pattern.
    await page.getByLabel(/^Name\*?$/).fill(customerName);
    await page.getByLabel("Company name").fill(`E2E Ltd ${suffix}`);
    await page.getByRole("button", { name: "Create customer" }).click();
    await expect(dialog).toBeHidden();

    await page.getByPlaceholder("Search by name, email, or company…").fill(customerName);
    await expect(
      page.getByRole("row", { name: new RegExp(escapeRegExp(customerName)) })
    ).toBeVisible();
  });
});
