"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
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
import { PhoneHappyRobotMorph } from "@/components/ui/PhoneHappyRobotMorph";
import { LogoAnimationLoop } from "@/components/logo-animation-loop";
import { useToast } from "@/components/ui/toaster";

// Zod schema for rider onboarding trigger form
const triggerFormSchema = z.object({
  externalId: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v.trim()), {
      message: "External ID debe ser un número entero",
    }),
  driverName: z.string().min(1, "Nombre del conductor es requerido"),
  phoneNumber: z
    .string()
    .min(1, "Teléfono es requerido")
    .regex(/^\+\d/, "El teléfono debe incluir el prefijo del país (ej: +34)"),
  signUpDate: z.string().optional(),
  flowType: z.string().optional(),
  documentsUploaded: z.enum(["", "NO", "PARTIAL", "YES"]).optional(),
  licenseCountry: z.string().optional(),
  residentPermitStatus: z.string().optional(),
});

type TriggerFormData = z.infer<typeof triggerFormSchema>;

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
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [formData, setFormData] = useState<TriggerFormData>({
    externalId: undefined,
    driverName: "",
    phoneNumber: "",
    signUpDate: "",
    flowType: "",
    documentsUploaded: "",
    licenseCountry: "",
    residentPermitStatus: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedCall, setSelectedCall] = useState<RiderCall | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "calls">("form");
  const { success: showSuccess } = useToast();

  // ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCall(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Query for active calls
  const { data: activeCalls = [], isLoading: isLoadingCalls } = useQuery<
    RiderCall[]
  >({
    queryKey: ["activeCalls"],
    queryFn: async () => {
      const res = await fetch("/api/calls/status");
      if (!res.ok) throw new Error("Error al obtener las llamadas");
      return res.json();
    },
    refetchInterval: 3000, // Auto-refresh every 3 seconds
  });

  // Mutation for triggering a call
  const triggerMutation = useMutation({
    mutationFn: async (data: TriggerFormData) => {
      const payload = {
        externalId: data.externalId?.trim()
          ? Number(data.externalId.trim())
          : undefined,
        driverName: data.driverName.trim(),
        phoneNumber: data.phoneNumber.trim(),
        signUpDate: data.signUpDate?.trim() ? data.signUpDate.trim() : undefined,
        flowType: data.flowType?.trim() ? data.flowType.trim() : undefined,
        documentsUploaded:
          data.documentsUploaded && data.documentsUploaded !== ""
            ? data.documentsUploaded
            : undefined,
        licenseCountry: data.licenseCountry?.trim()
          ? data.licenseCountry.trim()
          : undefined,
        residentPermitStatus: data.residentPermitStatus?.trim()
          ? data.residentPermitStatus.trim()
          : undefined,
      };

      const res = await fetch("/api/calls/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al iniciar la llamada");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeCalls"] });
      setErrors({});
      showSuccess("Llamada iniciada correctamente");
      // Switch to calls tab on mobile after triggering
      setActiveTab("calls");
    },
  });

  const handleInputChange = (field: keyof TriggerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = triggerFormSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    triggerMutation.mutate(formData);
  };

  const isFormValid =
    formData.driverName.trim() !== "" && formData.phoneNumber.trim() !== "";

  // Count active/running calls for badge
  const activeCallsCount = activeCalls.filter(
    (c) => c.status === "PENDING" || c.status === "RUNNING",
  ).length;

  return (
    <div className="flex h-full flex-col">
      {/* Mobile Tab Bar */}
      <div className="flex border-b border-border-subtle md:hidden">
        <button
          onClick={() => setActiveTab("form")}
          className={cn(
            "flex-1 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "form"
              ? "border-b-2 border-accent-primary text-fg-primary"
              : "text-fg-muted hover:text-fg-secondary",
          )}
        >
          Iniciar Llamada
        </button>
        <button
          onClick={() => setActiveTab("calls")}
          className={cn(
            "flex-1 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "calls"
              ? "border-b-2 border-accent-primary text-fg-primary"
              : "text-fg-muted hover:text-fg-secondary",
          )}
        >
          Llamadas Activas
          {activeCallsCount > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-primary px-1.5 text-xs font-medium text-white">
              {activeCallsCount}
            </span>
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Form */}
        <div
          className={cn(
            "flex-1 overflow-auto border-r border-border-subtle p-4 md:p-6",
            activeTab !== "form" && "hidden md:block",
          )}
        >
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 hidden md:block">
              <h1 className="text-xl font-semibold text-fg-primary">
                  Iniciar llamada (Onboarding Rider)
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="linear-card p-5">
                  <h2 className="mb-4 text-sm font-medium text-fg-secondary">
                    Datos del Rider
                  </h2>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                        External ID (opcional)
                      </label>
                      <input
                        type="text"
                        value={formData.externalId || ""}
                        onChange={(e) =>
                          handleInputChange("externalId", e.target.value)
                        }
                        placeholder="1"
                        className={cn(
                          "linear-input",
                          errors.externalId && "border-red-500/50",
                        )}
                      />
                      {errors.externalId && (
                        <p className="mt-1 text-xs text-red-400">
                          {errors.externalId}
                        </p>
                      )}
                    </div>

                    <div />

                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                        Nombre del conductor *
                      </label>
                      <input
                        type="text"
                        value={formData.driverName}
                        onChange={(e) =>
                          handleInputChange("driverName", e.target.value)
                        }
                        placeholder="João Silva"
                        className={cn(
                          "linear-input",
                          errors.driverName && "border-red-500/50",
                        )}
                      />
                      {errors.driverName && (
                        <p className="mt-1 text-xs text-red-400">
                          {errors.driverName}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                        Teléfono *
                      </label>
                      <input
                        type="text"
                        value={formData.phoneNumber}
                        onChange={(e) =>
                          handleInputChange("phoneNumber", e.target.value)
                        }
                        placeholder="+34 612 345 678"
                        className={cn(
                          "linear-input",
                          errors.phoneNumber && "border-red-500/50",
                        )}
                      />
                      {errors.phoneNumber && (
                        <p className="mt-1 text-xs text-red-400">
                          {errors.phoneNumber}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                        Sign-up date (YYYY-MM-DD)
                      </label>
                      <input
                        type="text"
                        value={formData.signUpDate || ""}
                        onChange={(e) =>
                          handleInputChange("signUpDate", e.target.value)
                        }
                        placeholder="2026-01-10"
                        className="linear-input"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                        Flow type
                      </label>
                      <input
                        type="text"
                        value={formData.flowType || ""}
                        onChange={(e) =>
                          handleInputChange("flowType", e.target.value)
                        }
                        placeholder="Uber X / Uber Black / Courier"
                        className="linear-input"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                        Documents uploaded
                      </label>
                      <select
                        value={formData.documentsUploaded || ""}
                        onChange={(e) =>
                          handleInputChange("documentsUploaded", e.target.value)
                        }
                        className="linear-input"
                      >
                        <option value="">—</option>
                        <option value="NO">No</option>
                        <option value="PARTIAL">Partial</option>
                        <option value="YES">Yes</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                        License country
                      </label>
                      <input
                        type="text"
                        value={formData.licenseCountry || ""}
                        onChange={(e) =>
                          handleInputChange("licenseCountry", e.target.value)
                        }
                        placeholder="Portugal"
                        className="linear-input"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                        Resident permit status
                      </label>
                      <input
                        type="text"
                        value={formData.residentPermitStatus || ""}
                        onChange={(e) =>
                          handleInputChange(
                            "residentPermitStatus",
                            e.target.value,
                          )
                        }
                        placeholder="Active / Processing / N/A"
                        className="linear-input"
                      />
                    </div>
                  </div>
                </div>

              {/* Submit button with PhoneHappyRobotMorph animation */}
              <button
                type="submit"
                disabled={!isFormValid || triggerMutation.isPending}
                className="linear-btn-primary flex w-full items-center justify-center gap-2 py-3"
              >
                <PhoneHappyRobotMorph
                  size={18}
                  logoColor="white"
                  variant="flip"
                  isActive={isFormValid}
                />
                <span>
                  {triggerMutation.isPending
                    ? "Iniciando llamada..."
                    : "Iniciar Llamada"}
                </span>
              </button>

              {triggerMutation.isError && (
                <div className="rounded-lg border border-status-danger/20 bg-status-danger/10 p-3">
                  <p className="text-sm text-status-danger">
                    {triggerMutation.error.message}
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right: Active calls */}
        <div
          className={cn(
            "w-full overflow-auto bg-bg-surface p-4 md:w-[400px] md:p-6",
            activeTab !== "calls" && "hidden md:block",
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
          ) : activeCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <LogoAnimationLoop size={40} pauseDuration={5} />
              <p className="mt-4 text-sm text-fg-muted">
                No hay llamadas aún
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCalls.map((call) => {
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
