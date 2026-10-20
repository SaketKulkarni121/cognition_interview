import { FilterBar } from "@/components/workflow/filter-bar";

export function FlagFilters({ environmentLabel }: { environmentLabel: string }) {
  return (
    <FilterBar
      searchLabel="Search feature flags"
      searchPlaceholder="Search by name, flag key, description, or team"
      preserve={["env"]}
      filters={[
        {
          param: "state",
          label: "Filter by state",
          defaultValue: "",
          options: [
            { value: "", label: "On and off" },
            { value: "on", label: `On in ${environmentLabel}` },
            { value: "off", label: `Off in ${environmentLabel}` },
          ],
        },
      ]}
    />
  );
}
