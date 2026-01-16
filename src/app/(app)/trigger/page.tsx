"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { cn, formatRelativeTime } from "@/lib/utils";
import { LogoAnimationLoop } from "@/components/logo-animation-loop";

interface InitiatorUser {
  id: string;
  email: string;
  name: string | null;
}

interface Rider {
  id: string;
  externalId: number | null;
  phoneNumber: string;
  driverName: string;
  signUpDate: string | null;
  flowType: string | null;
  documentsUploaded: "NO" | "PARTIAL" | "YES" | null;
  licenseCountry: string | null;
  residentPermitStatus: string | null;
  lastContactAt: string | null;
  lastContactStatus: "PENDING" | "NO_ANSWER" | "VOICEMAIL" | "COMPLETED" | null;
  urgentFlag: boolean;
  legalIssueFlag: boolean;
  humanRequested: boolean;
}

interface RiderCall {
  id: string;
  runId: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";
  contactStatus: "PENDING" | "NO_ANSWER" | "VOICEMAIL" | "COMPLETED" | null;
  contactedAt: string | null;
  transcript: string | null;
  summary: string | null;
  urgentFlag: boolean;
  legalIssueFlag: boolean;
  humanRequested: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  errorMsg: string | null;
  metadata: Record<string, unknown> | null;
  rider: Rider;
  initiatedByUser: InitiatorUser | null;
}

// HappyRobot Platform URL configuration
const HAPPYROBOT_ORG_SLUG = process.env.NEXT_PUBLIC_HAPPYROBOT_ORG_SLUG;
const HAPPYROBOT_WORKFLOW_ID = process.env.NEXT_PUBLIC_HAPPYROBOT_WORKFLOW_ID;

function getHappyRobotRunUrl(runId: string): string {
  return `https://v2.platform.happyrobot.ai/${HAPPYROBOT_ORG_SLUG}/workflow/${HAPPYROBOT_WORKFLOW_ID}/runs?run_id=${runId}`;
}

const statusConfig = {
  PENDING: { icon: Clock, class: "pill-pending", label: "Pendiente" },
  RUNNING: { icon: Loader2, class: "pill-running", label: "En Curso" },
  COMPLETED: {
    icon: CheckCircle,
    class: "pill-completed",
    label: "Completada",
  },
  FAILED: { icon: XCircle, class: "pill-failed", label: "Fallida" },
  CANCELED: { icon: AlertCircle, class: "pill-canceled", label: "Cancelada" },
};

export default function TriggerPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [selectedCall, setSelectedCall] = useState<RiderCall | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "feed">("pending");

  // ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCall(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Live calls feed (auto-refresh). Backend will poll HappyRobot to advance PENDING/RUNNING when configured.
  const { data: calls = [], isLoading: isLoadingCalls } = useQuery<
    RiderCall[]
  >({
    queryKey: ["liveCalls"],
    queryFn: async () => {
      const res = await fetch("/api/calls/status");
      if (!res.ok) throw new Error("Error al obtener las llamadas");
      return res.json();
    },
    refetchInterval: 3000, // Auto-refresh every 3 seconds
  });

  // Pending (domain) calls: Call Status = PENDING (or null)
  const pendingCalls = useMemo(() => {
    return calls
      .filter((c) => c.contactStatus === null || c.contactStatus === "PENDING")
      .sort((a, b) => {
        const aScore = (a.urgentFlag ? 4 : 0) + (a.legalIssueFlag ? 2 : 0) + (a.humanRequested ? 1 : 0);
        const bScore = (b.urgentFlag ? 4 : 0) + (b.legalIssueFlag ? 2 : 0) + (b.humanRequested ? 1 : 0);
        if (aScore !== bScore) return bScore - aScore;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [calls]);

  const activeRunsCount = useMemo(
    () => calls.filter((c) => c.status === "PENDING" || c.status === "RUNNING").length,
    [calls],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Mobile Tab Bar */}
      <div className="flex border-b border-border-subtle md:hidden">
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "flex-1 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "pending"
              ? "border-b-2 border-accent-primary text-fg-primary"
              : "text-fg-muted hover:text-fg-secondary",
          )}
        >
          Pendientes
        </button>
        <button
          onClick={() => setActiveTab("feed")}
          className={cn(
            "flex-1 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "feed"
              ? "border-b-2 border-accent-primary text-fg-primary"
              : "text-fg-muted hover:text-fg-secondary",
          )}
        >
          En directo
          {activeRunsCount > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-primary px-1.5 text-xs font-medium text-white">
              {activeRunsCount}
            </span>
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Pending */}
        <div
          className={cn(
            "flex-1 overflow-auto border-r border-border-subtle p-4 md:p-6",
            activeTab !== "pending" && "hidden md:block",
          )}
        >
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 hidden md:block">
              <h1 className="text-xl font-semibold text-fg-primary">
                Monitor en directo
              </h1>
              <p className="mt-1 text-sm text-fg-muted">
                Auto-refresh cada 3s. La app no dispara llamadas (las crea tu flujo cada 5 min).
              </p>
            </div>

            <div className="linear-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium text-fg-secondary">
                  Pendientes (Call Status)
                </h2>
                <div className="text-xs text-fg-muted">
                  {pendingCalls.length} pending · {activeRunsCount} activos
                </div>
              </div>

              {isLoadingCalls ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-fg-muted" />
                </div>
              ) : pendingCalls.length === 0 ? (
                <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4 text-sm text-fg-muted">
                  No hay llamadas pending.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingCalls.map((call) => {
                    const config = statusConfig[call.status];
                    const StatusIcon = config.icon;
                    return (
                      <div
                        key={call.id}
                        className="linear-card cursor-pointer p-4 transition-all hover:border-accent-primary/50"
                        onClick={() => setSelectedCall(call)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-fg-primary">
                              {call.rider.driverName}
                            </p>
                            <p className="mt-0.5 text-sm text-fg-muted">
                              {call.rider.phoneNumber}
                            </p>
                            {(call.rider.flowType || call.rider.documentsUploaded) && (
                              <p className="mt-1 text-xs text-fg-muted">
                                {call.rider.flowType || "—"}{" "}
                                {call.rider.documentsUploaded
                                  ? `· Docs: ${call.rider.documentsUploaded}`
                                  : ""}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="pill pill-pending">
                                {call.contactStatus || "PENDING"}
                              </span>
                              {call.urgentFlag && (
                                <span className="pill pill-failed">URGENT</span>
                              )}
                              {call.legalIssueFlag && (
                                <span className="pill pill-failed">LEGAL</span>
                              )}
                              {call.humanRequested && (
                                <span className="pill pill-pending">HUMAN</span>
                              )}
                            </div>
                          </div>
                          <div className={cn("pill", config.class)}>
                            <StatusIcon
                              className={cn(
                                "h-3 w-3",
                                call.status === "RUNNING" && "animate-spin",
                              )}
                            />
                            {config.label}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
                          <span>
                            {formatRelativeTime(new Date(call.updatedAt))}
                          </span>
                          {call.runId && (
                            <span className="font-mono text-[10px]">
                              {call.runId.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                        {call.errorMsg && (
                          <div className="mt-2 rounded bg-status-danger/10 px-2 py-1 text-xs text-status-danger">
                            {call.errorMsg}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Feed */}
        <div
          className={cn(
            "w-full overflow-auto bg-bg-surface p-4 md:w-[400px] md:p-6",
            activeTab !== "feed" && "hidden md:block",
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image
                src="/happyrobot/Footer-logo-white.svg"
                alt="HappyRobot"
                width={20}
                height={16}
                className="opacity-60"
              />
              <h2 className="text-sm font-semibold text-fg-primary">
                Últimas llamadas
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-fg-muted">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Auto-refresh
            </div>
          </div>

          {isLoadingCalls ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-fg-muted" />
            </div>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <LogoAnimationLoop size={40} pauseDuration={5} />
              <p className="mt-4 text-sm text-fg-muted">
                No hay llamadas aún
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {calls.map((call) => {
                const config = statusConfig[call.status];
                const StatusIcon = config.icon;
                return (
                  <div
                    key={call.id}
                    className="linear-card cursor-pointer p-4 transition-all hover:border-accent-primary/50"
                    onClick={() => setSelectedCall(call)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-fg-primary">
                          {call.rider.driverName}
                        </p>
                        <p className="mt-0.5 text-sm text-fg-muted">
                          {call.rider.phoneNumber}
                        </p>
                        {(call.rider.flowType || call.rider.documentsUploaded) && (
                          <p className="mt-1 text-xs text-fg-muted">
                            {call.rider.flowType || "—"}{" "}
                            {call.rider.documentsUploaded
                              ? `· Docs: ${call.rider.documentsUploaded}`
                              : ""}
                          </p>
                        )}
                      </div>
                      <div className={cn("pill", config.class)}>
                        <StatusIcon
                          className={cn(
                            "h-3 w-3",
                            call.status === "RUNNING" && "animate-spin",
                          )}
                        />
                        {config.label}
                      </div>
                    </div>
                    {call.initiatedByUser && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
                        <span className="font-medium text-fg-secondary">
                          {call.initiatedByUser.name}
                        </span>
                        <span className="text-fg-disabled">
                          ({call.initiatedByUser.email})
                        </span>
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
                      <span>
                        {formatRelativeTime(new Date(call.createdAt))}
                      </span>
                      {call.runId && (
                        <span className="font-mono text-[10px]">
                          {call.runId.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {call.contactStatus && (
                        <span className="pill pill-canceled">
                          {call.contactStatus}
                        </span>
                      )}
                      {call.urgentFlag && <span className="pill pill-failed">URGENT</span>}
                      {call.legalIssueFlag && (
                        <span className="pill pill-failed">LEGAL</span>
                      )}
                      {call.humanRequested && (
                        <span className="pill pill-pending">HUMAN</span>
                      )}
                    </div>
                    {call.errorMsg && (
                      <div className="mt-2 rounded bg-status-danger/10 px-2 py-1 text-xs text-status-danger">
                        {call.errorMsg}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Call Detail Modal */}
      {selectedCall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-backdrop backdrop-blur-sm"
          onClick={() => setSelectedCall(null)}
        >
          <div
            className="relative mx-4 max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedCall(null)}
              className="absolute right-4 top-4 rounded-lg p-2 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
            >
              <XCircle className="h-5 w-5" />
            </button>

            <h2 className="mb-1 text-lg font-semibold text-fg-primary">
              {selectedCall.rider.driverName}
            </h2>
            <p className="mb-6 font-mono text-sm text-fg-muted">
              {selectedCall.rider.phoneNumber}
            </p>

            <div className="mb-6">
              {(() => {
                const config = statusConfig[selectedCall.status];
                const StatusIcon = config.icon;
                return (
                  <span className={cn("pill", config.class)}>
                    <StatusIcon
                      className={cn(
                        "h-3 w-3",
                        selectedCall.status === "RUNNING" && "animate-spin",
                      )}
                    />
                    {config.label}
                  </span>
                );
              })()}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Flow type" value={selectedCall.rider.flowType} />
              <DetailField
                label="Documents uploaded"
                value={selectedCall.rider.documentsUploaded || "-"}
              />
              <DetailField
                label="License country"
                value={selectedCall.rider.licenseCountry}
              />
              <DetailField
                label="Resident permit status"
                value={selectedCall.rider.residentPermitStatus}
              />
              <DetailField label="Contact status" value={selectedCall.contactStatus} />
              <DetailField
                label="Contacted at"
                value={
                  selectedCall.contactedAt
                    ? new Date(selectedCall.contactedAt).toLocaleString("es-ES")
                    : "-"
                }
              />
              {selectedCall.runId && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-fg-muted">Run ID</p>
                  <p className="mt-1 font-mono text-sm text-fg-primary">
                    {selectedCall.runId}
                  </p>
                  {isAdmin && HAPPYROBOT_ORG_SLUG && HAPPYROBOT_WORKFLOW_ID && (
                    <a
                      href={getHappyRobotRunUrl(selectedCall.runId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-accent-primary hover:underline"
                    >
                      Ver en HappyRobot
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {(selectedCall.summary ||
              selectedCall.transcript ||
              (selectedCall.metadata as any)?.workflowResult?.summary) && (
              <div className="linear-card mt-6 p-4">
                <p className="mb-2 text-sm font-medium text-fg-secondary">
                  Resumen
                </p>
                <pre className="whitespace-pre-wrap break-words text-sm text-fg-primary">
                  {selectedCall.summary ||
                    (selectedCall.metadata as any)?.workflowResult?.summary ||
                    "—"}
                </pre>

                <p className="mb-2 mt-4 text-sm font-medium text-fg-secondary">
                  Transcripción
                </p>
                <pre className="whitespace-pre-wrap break-words text-sm text-fg-primary">
                  {selectedCall.transcript ||
                    (selectedCall.metadata as any)?.workflowResult?.transcript ||
                    "—"}
                </pre>
                </div>
              )}

            {selectedCall.errorMsg && (
              <div className="mt-6 rounded-lg border border-status-danger/20 bg-status-danger/10 p-4">
                <p className="text-sm font-medium text-status-danger">Error</p>
                <p className="mt-1 text-sm text-status-danger/80">
                  {selectedCall.errorMsg}
                </p>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

function DetailField({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string | null | undefined;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : ""}>
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <p className="mt-1 text-sm text-fg-primary">{value || "-"}</p>
    </div>
  );
}
