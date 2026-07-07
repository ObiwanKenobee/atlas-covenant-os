import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { listNotifications, markNotificationsRead } from "@/lib/sanctum.functions";

export function NotificationsBell() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchList(),
    refetchInterval: 30_000,
  });

  const unread = (notifications ?? []).filter((n) => !n.read_at);

  const mark = useMutation({
    mutationFn: (ids?: string[]) => markRead({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative text-ink/60 hover:text-copper transition-colors text-[11px] uppercase tracking-widest"
        aria-label="Notifications"
      >
        Bell
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-3 size-4 rounded-full bg-copper text-parchment text-[9px] flex items-center justify-center">
            {unread.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-3 w-96 bg-parchment border border-ink/10 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-ink/5 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-copper">Notifications</span>
            {unread.length > 0 && (
              <button
                onClick={() => mark.mutate(undefined)}
                className="text-[10px] uppercase tracking-widest text-ink/50 hover:text-ink"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-ink/5">
            {(notifications ?? []).length === 0 && (
              <div className="p-6 text-center text-xs text-ink/50">No notifications yet.</div>
            )}
            {(notifications ?? []).map((n) => {
              const content = (
                <div className={"p-4 " + (n.read_at ? "" : "bg-copper/5")}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-serif text-sm text-ink flex-1">{n.title}</div>
                    <div className="text-[9px] uppercase tracking-widest text-ink/40 shrink-0">
                      {new Date(n.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {n.body && <div className="text-xs text-ink/60 mt-1 leading-relaxed">{n.body}</div>}
                </div>
              );
              return n.link ? (
                <a
                  key={n.id}
                  href={n.link}
                  onClick={() => {
                    setOpen(false);
                    if (!n.read_at) mark.mutate([n.id]);
                  }}
                  className="block hover:bg-stone-base/40"
                >
                  {content}
                </a>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
