import { FilterBar } from "@/components/workflow/filter-bar";
import { KYC_STATUSES, STATUS_META } from "@/modules/kyc/workflow";

type Reviewer = { id: string; name: string };

export function QueueFilters({ reviewers, showMine }: { reviewers: Reviewer[]; showMine: boolean }) {
  return (
    <FilterBar
      searchLabel="Search applications"
      searchPlaceholder="Search by customer name, email, or reference (e.g. KYC-10425)"
      filters={[
        {
          param: "status",
          label: "Filter by status",
          defaultValue: "OPEN",
          options: [{ value: "OPEN", label: "All open" }, { value: "ALL", label: "All statuses" }, ...KYC_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))],
        },
        {
          param: "reviewer",
          label: "Filter by reviewer",
          defaultValue: "",
          options: [
            { value: "", label: "Any reviewer" },
            ...(showMine ? [{ value: "me", label: "Assigned to me" }] : []),
            { value: "unassigned", label: "Unassigned" },
            ...reviewers.map((r) => ({ value: r.id, label: r.name })),
          ],
        },
        {
          param: "sort",
          label: "Sort",
          defaultValue: "newest",
          className: "col-span-2 sm:col-span-1 lg:w-36",
          options: [{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }],
        },
      ]}
    />
  );
}
