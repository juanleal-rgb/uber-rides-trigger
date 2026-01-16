"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, Loader2, ChevronUp } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

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

export default function UsuariosPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(25);

  // Query for users list
  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ["users", page, pageSize, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.set("search", search);

      const res = await fetch("/api/users/list?" + params.toString());
      if (!res.ok) throw new Error("Error al obtener los usuarios");
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
        <h1 className="text-xl font-semibold text-fg-primary">Usuarios</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Lista de usuarios registrados
        </p>
      </div>

      {/* Search */}
      <div className="mb-4 shrink-0">
        <form onSubmit={handleSearch} className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="linear-input w-full pl-10"
          />
        </form>
      </div>

      {/* Table Container - Fixed height with scrollable body */}
      <div className="linear-card flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {/* Sticky header */}
        <div className="shrink-0 border-b border-border-subtle bg-bg-surface">
          <table className="linear-table">
            <thead>
              <tr>
                <th className="w-[30%]">Nombre</th>
                <th className="w-[30%]">Email</th>
                <th className="w-[15%]">Rol</th>
                <th className="w-[25%]">Registrado</th>
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
                  <td colSpan={4} className="py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-fg-disabled" />
                  </td>
                </tr>
              ) : data?.users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <Users className="mx-auto h-8 w-8 text-fg-disabled" />
                    <p className="mt-3 text-sm text-fg-muted">
                      No se encontraron usuarios
                    </p>
                  </td>
                </tr>
              ) : (
                data?.users.map((user) => (
                  <tr key={user.id} className="cursor-default">
                    <td className="w-[30%] font-medium text-fg-primary">
                      {user.name || "-"}
                    </td>
                    <td className="w-[30%] text-fg-secondary">{user.email}</td>
                    <td className="w-[15%]">
                      <span
                        className={cn(
                          "pill",
                          user.role === "admin"
                            ? "pill-completed"
                            : "pill-pending",
                        )}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="w-[25%] text-sm text-fg-muted">
                      {formatRelativeTime(new Date(user.createdAt))}
                    </td>
                  </tr>
                ))
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
              {Math.min(page * pageSize, data.total)} de {data.total} usuarios
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
    </div>
  );
}
