"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  Search,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  X,
  Loader2,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { FilterDropdown } from "@/components/ui/filter-dropdown";

// HappyRobot Platform URL config
const HAPPYROBOT_ORG_SLUG = process.env.NEXT_PUBLIC_HAPPYROBOT_ORG_SLUG;
const HAPPYROBOT_WORKFLOW_ID = process.env.NEXT_PUBLIC_HAPPYROBOT_WORKFLOW_ID;

function getHappyRobotRunUrl(runId: string): string {
  return `https://v2.platform.happyrobot.ai/${HAPPYROBOT_ORG_SLUG}/workflow/${HAPPYROBOT_WORKFLOW_ID}/runs?run_id=${runId}`;
}

interface Rider {
  id: string;
  externalId: number | null;
  phoneNumber: string;
  driverName: string;
  city: string | null;
  signUpDate: string | null;
  flowType: string | null;
  documentsUploaded: "NO" | "PARTIAL" | "YES" | null;
  documents: Record<string, unknown> | null;
  licenseCountry: string | null;
  residentPermitStatus: string | null;
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
  sentiment: string | null;
  attempt: number | null;
  urgentFlag: boolean;
  legalIssueFlag: boolean;
  humanRequested: boolean;
  rider: Rider;
  metadata: Record<string, unknown> | null;
  errorMsg: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface CallsResponse {
  calls: RiderCall[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const statusConfig = {
  PENDING: { icon: Clock, class: "pill-pending", label: "Pendiente" },
  RUNNING: { icon: RefreshCw, class: "pill-running", label: "En Curso" },
  COMPLETED: {
    icon: CheckCircle,
    class: "pill-completed",
    label: "Completada",
  },
  FAILED: { icon: XCircle, class: "pill-failed", label: "Fallida" },
  CANCELED: { icon: AlertCircle, class: "pill-canceled", label: "Cancelada" },
};

const statusOptions = [
  { value: "", label: "Todos los estados" },
  { value: "PENDING", label: "Pendiente" },
  { value: "RUNNING", label: "En Curso" },
  { value: "COMPLETED", label: "Completada" },
  { value: "FAILED", label: "Fallida" },
  { value: "CANCELED", label: "Cancelada" },
];

const contactStatusOptions = [
  { value: "", label: "Todos los resultados" },
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "VOICEMAIL", label: "Voicemail" },
  { value: "NO_ANSWER", label: "No Answer" },
];

// Page size selector component (opens upward)
function PageSizeSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const options = [10, 25, 50, 100];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-fg-primary transition-colors hover:bg-interactive-hover"
      >
        {value} por pagina
        <ChevronUp
          className={cn(
            "h-3 w-3 text-fg-muted transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg border border-border-subtle bg-bg-elevated py-1 shadow-xl shadow-overlay-backdrop">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={cn(
                  "block w-full whitespace-nowrap px-4 py-2 text-left text-[13px] transition-colors",
                  option === value
                    ? "bg-accent-primary/10 font-medium text-accent-primary"
                    : "text-fg-secondary hover:bg-interactive-hover hover:text-fg-primary",
                )}
              >
                {option} por pagina
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function LlamadasPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [contactStatusFilter, setContactStatusFilter] = useState("");
  const [selectedCall, setSelectedCall] = useState<RiderCall | null>(null);
  const [pageSize, setPageSize] = useState(25);

  // Query for calls list
  const { data, isLoading } = useQuery<CallsResponse>({
    queryKey: ["calls", page, pageSize, search, statusFilter, contactStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (contactStatusFilter) params.set("contactStatus", contactStatusFilter);

      const res = await fetch("/api/calls/list?" + params.toString());
      if (!res.ok) throw new Error("Error al obtener las llamadas");
      return res.json();
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <h1 className="text-xl font-semibold text-fg-primary">Onboarding calls</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Historial de llamadas para onboarding de riders
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-4">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por driver, teléfono o runId..."
            className="linear-input w-full max-w-md pl-10"
          />
        </form>
        <FilterDropdown
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          options={statusOptions}
          label="Estado"
          allLabel="Todos los estados"
          className="w-48"
        />
        <FilterDropdown
          value={contactStatusFilter}
          onChange={(val) => {
            setContactStatusFilter(val);
            setPage(1);
          }}
          options={contactStatusOptions}
          label="Resultado"
          allLabel="Todos"
          className="w-48"
        />
      </div>

      {/* Table Container - Fixed height with scrollable body */}
      <div className="linear-card flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {/* Sticky header */}
        <div className="shrink-0 border-b border-border-subtle bg-bg-surface">
          <table className="linear-table">
            <thead>
              <tr>
                <th className="w-[25%]">Driver</th>
                <th className="w-[15%]">Telefono</th>
                <th className="w-[20%]">City</th>
                <th className="w-[15%]">Resultado</th>
                <th className="w-[15%]">Estado</th>
                <th className="w-[10%]">Fecha</th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-auto">
          <table className="linear-table">
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-fg-disabled" />
                  </td>
                </tr>
              ) : data?.calls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Phone className="mx-auto h-8 w-8 text-fg-disabled" />
                    <p className="mt-3 text-sm text-fg-muted">
                      No se encontraron llamadas
                    </p>
                  </td>
                </tr>
              ) : (
                data?.calls.map((call) => {
                  const config = statusConfig[call.status];
                  const StatusIcon = config.icon;
                  return (
                    <tr
                      key={call.id}
                      onClick={() => setSelectedCall(call)}
                      className="cursor-pointer"
                    >
                      <td className="w-[25%] font-medium text-fg-primary">
                        {call.rider.driverName}
                      </td>
                      <td className="w-[15%] font-mono text-sm text-fg-secondary">
                        {call.rider.phoneNumber}
                      </td>
                      <td className="w-[20%] max-w-[200px] truncate text-fg-secondary">
                        {call.rider.city || call.rider.flowType || "-"}
                      </td>
                      <td className="w-[15%] text-xs text-fg-secondary">
                        {call.contactStatus || "-"}
                      </td>
                      <td className="w-[15%]">
                        <span className={cn("pill", config.class)}>
                          <StatusIcon
                            className={cn(
                              "h-3 w-3",
                              call.status === "RUNNING" && "animate-spin",
                            )}
                          />
                          {config.label}
                        </span>
                      </td>
                      <td className="w-[10%] text-sm text-fg-muted">
                        {formatRelativeTime(new Date(call.createdAt))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination - Always visible when there's data */}
      {data && data.total > 0 && (
        <div className="mt-4 flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-1 text-[13px] text-fg-muted">
            <span>
              Mostrando {(page - 1) * pageSize + 1}-
              {Math.min(page * pageSize, data.total)} de {data.total} llamadas
            </span>
            <span className="mx-2 text-fg-disabled">|</span>
            <PageSizeSelector
              value={pageSize}
              onChange={handlePageSizeChange}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="linear-btn-secondary px-3 py-1.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-30"
            >
              &lt;
            </button>
            <span className="px-3 py-1.5 text-[13px] text-fg-secondary">
              {page} / {data.totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages || data.totalPages === 0}
              className="linear-btn-secondary px-3 py-1.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-30"
            >
              &gt;
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedCall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-backdrop backdrop-blur-sm"
          onClick={() => setSelectedCall(null)}
        >
          <div
            className="relative mx-4 max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl border border-border-medium bg-bg-elevated p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedCall(null)}
              className="absolute right-4 top-4 rounded-lg p-2 text-fg-muted transition-colors hover:bg-interactive-hover hover:text-fg-primary"
            >
              <X className="h-5 w-5" />
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
              <DetailField label="City" value={selectedCall.rider.city} />
              <DetailField label="Flow type" value={selectedCall.rider.flowType} />
              <DetailField
                label="Documents uploaded"
                value={selectedCall.rider.documentsUploaded || "-"}
              />
              <DetailField
                label="Attempt"
                value={
                  typeof selectedCall.attempt === "number"
                    ? String(selectedCall.attempt)
                    : "-"
                }
              />
              <DetailField label="Sentiment" value={selectedCall.sentiment} />
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
              <div className="sm:col-span-2">
                <div className="flex flex-wrap gap-1">
                  {selectedCall.urgentFlag && (
                    <span className="pill pill-failed">URGENT</span>
                  )}
                  {selectedCall.legalIssueFlag && (
                    <span className="pill pill-failed">LEGAL</span>
                  )}
                  {selectedCall.humanRequested && (
                    <span className="pill pill-pending">HUMAN</span>
                  )}
                </div>
              </div>
              {selectedCall.runId && (
                <div>
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
              <DetailField
                label="Creado"
                value={new Date(selectedCall.createdAt).toLocaleString("es-ES")}
              />
              {selectedCall.completedAt && (
                <DetailField
                  label="Completado"
                  value={new Date(selectedCall.completedAt).toLocaleString(
                    "es-ES",
                  )}
                />
              )}
            </div>

            {(selectedCall.summary || selectedCall.transcript) && (
              <div className="linear-card mt-6 p-4">
                <p className="mb-2 text-sm font-medium text-fg-secondary">
                  Resumen
                </p>
                <pre className="whitespace-pre-wrap break-words text-sm text-fg-primary">
                  {selectedCall.summary || "—"}
                </pre>
                <p className="mb-2 mt-4 text-sm font-medium text-fg-secondary">
                  Transcripción
                </p>
                <pre className="whitespace-pre-wrap break-words text-sm text-fg-primary">
                  {selectedCall.transcript || "—"}
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

            {selectedCall.metadata &&
              Object.keys(selectedCall.metadata).length > 0 && (
                <div className="mt-6">
                  <p className="mb-2 text-sm font-medium text-fg-secondary">
                    Metadata
                  </p>
                  <pre className="overflow-auto rounded-lg bg-bg-surface p-4 text-xs text-fg-secondary">
                    {JSON.stringify(selectedCall.metadata, null, 2)}
                  </pre>
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
