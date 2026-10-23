import { expect, test, type Page } from "@playwright/test";
import {
  apiFor,
  escapeRegExp,
  loginViaUi,
  readAccessToken,
  runId,
  type Api,
} from "./helpers";

/**
 * The documented HRM flow: employee files a leave request, a reviewer approves
 * it, and the row's status follows.
 *
 * Two API rules shape this spec:
 *
 * 1. `POST /hrm/leaves` answers 409 when the request overlaps an existing
 *    PENDING or APPROVED leave for the same employee.
 * 2. `DELETE /hrm/leaves/:id` only accepts PENDING, CANCELLED or REJECTED rows,
 *    so an approved request can never be cleaned up again.
 *
 * Together they mean a repeated run on the same day cannot reuse the same
 * date — so the spec walks forward to the first weekday the employee has no
 * pending or approved leave on, and the leftover approved row stays harmless.
 */

/** Local-time yyyy-MM-dd. `toISOString()` would shift the day in +06:00. */
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

async function pickFreeWeekday(api: Api, employeeId: string): Promise<string> {
  const existing = await api.get("/hrm/leaves", { employeeId, pageSize: "100" });
  const rows: Array<{ status: string; startDate: string; endDate: string }> =
    existing.body?.data?.items ?? [];

  // Mirrors `checkOverlap` in the leave service: two requests collide when
  // their day ranges intersect. ISO date strings compare correctly as text.
  const isBlocked = (iso: string): boolean =>
    rows.some(
      (l) =>
        (l.status === "PENDING" || l.status === "APPROVED") &&
        l.startDate.slice(0, 10) <= iso &&
        l.endDate.slice(0, 10) >= iso
    );

  const start = new Date();
  start.setDate(start.getDate() + 30);
  for (let offset = 0; offset < 60; offset += 1) {
    const candidate = new Date(start);
    candidate.setDate(candidate.getDate() + offset);
    if (isWeekend(candidate)) continue;
    const iso = toIsoDate(candidate);
    if (!isBlocked(iso)) return iso;
  }
  throw new Error("No free weekday found for the E2E leave request.");
}

/**
 * Clicks a day in the calendar that is currently open. The popover always
 * opens on the month of the picker's value — today, while nothing is selected
 * yet — so advance to the target month first, then click the cell react-day-
 * picker tags with `data-day="yyyy-MM-dd"`.
 */
async function pickDate(page: Page, iso: string): Promise<void> {
  const target = new Date(`${iso}T00:00:00`);
  const today = new Date();
  const monthsAhead =
    (target.getFullYear() - today.getFullYear()) * 12 +
    (target.getMonth() - today.getMonth());

  for (let i = 0; i < monthsAhead; i += 1) {
    await page.getByRole("button", { name: "Go to the Next Month" }).click();
  }
  await page.locator(`[data-day="${iso}"] button`).click();
}

test.describe("HRM leave flow", () => {
  const suffix = runId();
  const reason = `E2E ${suffix} — annual leave requested by the automated suite.`;
  let api: Api | undefined;
  let leaveId: string | undefined;

  test.afterAll(async () => {
    if (!api) return;
    try {
      if (!leaveId) {
        const found = await api.get("/hrm/leaves", { search: suffix, pageSize: "5" });
        leaveId = found.body?.data?.items?.[0]?.id;
      }
      if (!leaveId) return;
      const removed = await api.del(`/hrm/leaves/${leaveId}`);
      if (removed.status >= 400) {
        // Expected once the run got as far as approving: the API refuses to
        // delete an approved request. Harmless, because `pickFreeWeekday`
        // gives every run its own date.
        console.warn(
          `[e2e] leave cleanup returned HTTP ${removed.status} — the approved row stays behind`
        );
      }
    } catch (err) {
      console.warn("[e2e] leave cleanup failed:", err);
    } finally {
      await api.dispose();
    }
  });

  test("files a leave request, approves it and shows the new status", async ({ page }) => {
    await loginViaUi(page);
    api = await apiFor(await readAccessToken(page));

    // Same query the page uses to resolve the default employee, so the date
    // we clear is checked against the record the form will actually submit.
    const employees = await api.get("/hrm/employees", { pageSize: "100", isActive: "true" });
    const employeeId: string | undefined = employees.body?.data?.items?.[0]?.id;
    expect(employeeId, "the seeded employee must be readable").toBeTruthy();
    const leaveDate = await pickFreeWeekday(api, employeeId as string);

    await page.goto("/hrm/leaves");
    // `name` is a case-insensitive SUBSTRING match, so the empty state's
    // "No leave requests" also matches — anchor with `exact`.
    await expect(page.getByRole("heading", { name: "Leave Requests", exact: true })).toBeVisible();

    // The page header, the toolbar and the empty state can each offer a create
    // button, so take the first.
    await page.getByRole("button", { name: "New request" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Submit Leave Request" })).toBeVisible();

    // The account is linked to the only seeded employee, so this picker is
    // both pre-filled and disabled (`employeeOptions.length <= 1`). Assert the
    // pre-fill rather than opening a disabled control.
    const employeePicker = dialog.getByLabel("Employee");
    await expect(employeePicker).toBeDisabled();
    await expect(employeePicker).not.toContainText("Select employee…");

    // The form resets whenever the leave-type/employee lookups resolve, so wait
    // for both pre-fills to settle before touching the dates.
    await expect(dialog.getByLabel("Leave Type")).not.toContainText("Select leave type…");

    await dialog.getByLabel("From Date").click();
    await pickDate(page, leaveDate);
    await dialog.getByLabel("To Date").click();
    await pickDate(page, leaveDate);

    await dialog
      .getByPlaceholder("Please provide a detailed reason (minimum 20 characters)…")
      .fill(reason);
    await dialog.getByRole("button", { name: "Submit request" }).click();
    await expect(dialog).toBeHidden();

    // Narrow the list down to this run's row before asserting on it.
    await page.getByPlaceholder("Search by reason or employee…").fill(suffix);
    const row = page.getByRole("row", { name: new RegExp(escapeRegExp(suffix)) });
    await expect(row).toBeVisible();

    // Columns: Employee, Leave Type, Date Range, Total Days, Status, Reason,
    // Approver, actions.
    const statusCell = row.getByRole("cell").nth(4);
    await expect(statusCell).toHaveText("Pending");

    await row.getByRole("button", { name: "Approve" }).click();
    // The confirm dialog renders its title twice, so click the button rather
    // than anything matched by text.
    await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();

    await expect(statusCell).toHaveText("Approved");

    const found = await api.get("/hrm/leaves", { search: suffix, pageSize: "5" });
    const created = found.body?.data?.items?.[0];
    leaveId = created?.id;
    expect(created?.status).toBe("APPROVED");
  });
});
