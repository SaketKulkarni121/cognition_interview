import Link from "next/link";
import { ChevronRight, ToggleRight } from "lucide-react";
import { Alert, Avatar, Badge, Card, EmptyState, PageHeader, SegmentedLinks, StatCard, TBody, TD, TH, THead, TR, Table, buttonClasses } from "@/components/ui";
import { FlagFilters } from "@/components/flags/flag-filters";
import { FlagToggle } from "@/components/flags/flag-toggle";
import { requireUser } from "@/lib/auth/session";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { listQuerySchema } from "@/modules/flags/schemas";
import { getFlagStats, listFlags } from "@/modules/flags/service";
import { ENVIRONMENTS, ENVIRONMENT_META, requiresConfirmation } from "@/modules/flags/workflow";

export const metadata = { title: "Feature Flags" };

export default async function FlagsPage(props: PageProps<"/flags">) {
  const user = await requireUser();
  const raw = await props.searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v)) as Record<string, string>;
  const parsed = listQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : {};
  const { environment: env, flags, permissions } = await listFlags(user, query);
  const stats = await getFlagStats(user, env);
  const meta = ENVIRONMENT_META[env];
  const envHref = (e: string) => {
    const sp = new URLSearchParams(flat);
    sp.set("env", e);
    return `/flags?${sp.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Feature Flags"
        description="Turn features on or off in each environment without redeploying. Pick an environment, then use the switch next to a feature. Production changes ask you to confirm."
        actions={<SegmentedLinks label="Environment" items={ENVIRONMENTS.map((e) => ({ label: ENVIRONMENT_META[e].label, href: envHref(e), active: e === env }))} />}
      />
      {env === "PRODUCTION" && (
        <Alert tone="danger" title="You are viewing Production" className="mb-6">
          Changes here affect live customers immediately. You&apos;ll be asked to type the flag key and give a reason before anything changes.
        </Alert>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Flags" value={stats.total} href={`/flags?env=${env}`} hint="Defined across all environments" />
        <StatCard label={`On in ${meta.label}`} value={stats.enabled} href={`/flags?env=${env}&state=on`} active={query.state === "on"} hint="Feature is live here" />
        <StatCard label={`Off in ${meta.label}`} value={stats.disabled} href={`/flags?env=${env}&state=off`} active={query.state === "off"} hint="Feature is hidden here" />
        <StatCard label="Changes this week" value={stats.changedThisWeek} href="/audit?module=flags" hint="See them in the audit log" />
      </div>
      <Card>
        <FlagFilters environmentLabel={meta.label} />
        {flags.length === 0 ? (
          <EmptyState icon={ToggleRight} title="No flags match" description="Try clearing the search or filter." action={<Link href={`/flags?env=${env}`} className={buttonClasses("secondary", "sm")}>Clear filters</Link>} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Feature</TH>
                <TH className="hidden md:table-cell">Flag key</TH>
                <TH>{meta.label}</TH>
                <TH className="hidden lg:table-cell">All environments</TH>
                <TH className="hidden sm:table-cell">Last modified</TH>
                <TH className="w-8" />
              </TR>
            </THead>
            <TBody>
              {flags.map((f) => {
                const cfg = f.environments.find((e) => e.environment === env);
                const staging = f.environments.find((e) => e.environment === "STAGING");
                return (
                  <TR key={f.id} className="group hover:bg-slate-50">
                    <TD className="max-w-md">
                      <Link href={`/flags/${f.key}`} className="font-medium text-slate-900 hover:underline">
                        {f.name}
                      </Link>
                      <p className="line-clamp-2 text-xs text-slate-500">{f.description}</p>
                      <p className="mt-1 font-mono text-[11px] text-slate-500 md:hidden">{f.key}</p>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">{f.key}</code>
                    </TD>
                    <TD>
                      {cfg && (
                        <FlagToggle
                          flagKey={f.key}
                          flagName={f.name}
                          environment={env}
                          environmentLabel={meta.label}
                          enabled={cfg.enabled}
                          version={cfg.version}
                          allowed={permissions[env].allowed}
                          blockedReason={permissions[env].reason}
                          needsConfirmation={requiresConfirmation(env)}
                          stagingEnabled={!!staging?.enabled}
                          showLabel
                        />
                      )}
                    </TD>
                    <TD className="hidden lg:table-cell">
                      <div className="flex gap-1.5">
                        {ENVIRONMENTS.map((e) => {
                          const on = f.environments.find((x) => x.environment === e)?.enabled;
                          return (
                            <Badge key={e} tone={on ? "success" : "neutral"} dot title={`${ENVIRONMENT_META[e].label}: ${on ? "on" : "off"}`} className={cn(e === env && "ring-2")}>
                              {ENVIRONMENT_META[e].short}
                            </Badge>
                          );
                        })}
                      </div>
                    </TD>
                    <TD className="hidden sm:table-cell">
                      {cfg?.updatedBy ? (
                        <span className="flex items-center gap-2">
                          <Avatar name={cfg.updatedBy.name} size="xs" />
                          <span>
                            <span className="block whitespace-nowrap text-sm">{cfg.updatedBy.name}</span>
                            <span className="block whitespace-nowrap text-xs text-slate-500" title={formatDateTime(cfg.updatedAt)}>
                              {formatDateTime(cfg.updatedAt)} · {timeAgo(cfg.updatedAt)}
                            </span>
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TD>
                    <TD>
                      <Link href={`/flags/${f.key}`} aria-label={`Open ${f.name}`}>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500" />
                      </Link>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          {flags.length} flag{flags.length === 1 ? "" : "s"} · showing {meta.label}
        </div>
      </Card>
    </>
  );
}
