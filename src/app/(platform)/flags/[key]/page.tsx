import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Avatar, Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { HistoryTimeline } from "@/components/audit/history-timeline";
import { FlagToggle } from "@/components/flags/flag-toggle";
import { requireUser } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getFlag } from "@/modules/flags/service";
import { ENVIRONMENTS, ENVIRONMENT_META, requiresConfirmation } from "@/modules/flags/workflow";

export const metadata = { title: "Feature flag" };

export default async function FlagPage(props: PageProps<"/flags/[key]">) {
  const user = await requireUser();
  const { key } = await props.params;
  let data;
  try {
    data = await getFlag(user, key);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { flag, history, permissions } = data;
  const staging = flag.environments.find((e) => e.environment === "STAGING");

  return (
    <>
      <Link href="/flags" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to feature flags
      </Link>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{flag.name}</h1>
          <Badge>{flag.ownerTeam}</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">{flag.key}</code> · Created {formatDate(flag.createdAt)}
        </p>
        <p className="mt-3 max-w-3xl text-sm text-slate-700">{flag.description}</p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {ENVIRONMENTS.map((env) => {
          const cfg = flag.environments.find((e) => e.environment === env);
          const meta = ENVIRONMENT_META[env];
          if (!cfg) return null;
          return (
            <Card key={env} className={env === "PRODUCTION" ? "border-red-200" : undefined}>
              <CardHeader title={meta.label} description={meta.description} action={<Badge tone={cfg.enabled ? "success" : "neutral"} dot>{cfg.enabled ? "On" : "Off"}</Badge>} />
              <CardBody className="space-y-4">
                <FlagToggle
                  flagKey={flag.key}
                  flagName={flag.name}
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
                {!permissions[env].allowed && <p className="text-xs text-slate-500">{permissions[env].reason}</p>}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {cfg.updatedBy && <Avatar name={cfg.updatedBy.name} size="xs" />}
                  <span>
                    Last changed by <span className="font-medium text-slate-700">{cfg.updatedBy?.name ?? "—"}</span>
                    <br />
                    {formatDateTime(cfg.updatedAt)} · version {cfg.version}
                  </span>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader title="Change history" description="Every change to this flag, newest first. This is read from the audit log." />
          <CardBody>
            <HistoryTimeline entries={history} />
          </CardBody>
        </Card>
        <Card className="self-start">
          <CardHeader title="Using this flag in code" description="Server code checks the flag at request time. Unknown flags are treated as off." />
          <CardBody className="space-y-3 text-sm">
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">{`import { isFeatureEnabled } from "@/lib/feature-flags";

if (await isFeatureEnabled("${flag.key}")) {
  // new behaviour
}`}</pre>
            <p className="text-slate-600">Or over HTTP:</p>
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">{`GET /api/flags/evaluate?env=PRODUCTION&keys=${flag.key}`}</pre>
            <p className="text-xs text-slate-500">
              Example in action: <a className="text-indigo-600 hover:underline" href="/api/examples/checkout?env=STAGING">/api/examples/checkout</a> chooses the checkout flow from <code className="font-mono">new_checkout_experience</code>.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
