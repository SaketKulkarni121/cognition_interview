import { FilterBar } from "@/components/workflow/filter-bar";
import { REASON_CATEGORIES, REFUND_STATUSES, STATUS_META } from "@/modules/refunds/workflow";

export function RefundFilters() {
  return (
    <FilterBar
      searchLabel="Search refund cases"
      searchPlaceholder="Search by customer, email, case (RFD-…), transaction (TXN-…), or merchant"
      filters={[
        {
          param: "status",
          label: "Filter by status",
          defaultValue: "ALL",
          options: [
            { value: "ALL", label: "All statuses" },
            { value: "OPEN", label: "Open (pending or escalated)" },
            ...REFUND_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label })),
          ],
        },
        {
          param: "reason",
          label: "Filter by reason",
          defaultValue: "",
          options: [{ value: "", label: "Any reason" }, ...Object.entries(REASON_CATEGORIES).map(([value, label]) => ({ value, label }))],
        },
        {
          param: "sort",
          label: "Sort",
          defaultValue: "newest",
          className: "col-span-2 sm:col-span-1 lg:w-40",
          options: [
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "amount", label: "Largest amount" },
          ],
        },
      ]}
    />
  );
}
