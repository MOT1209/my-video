"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import type { ShortProps } from "../../types/shorts";
import { Button } from "./Button";
import { InputContainer } from "./Container";
import { ErrorComp } from "./Error";
import { Spacing } from "./Spacing";

/**
 * لوحة الحساب (المرحلة 4): رصيد الكريدت + المشاريع المحفوظة + سجل
 * التصييرات + شراء كريدت.
 *
 * التصميم: اللوحة لا تعرف Clerk ولا قاعدة البيانات — تقرأ الحالة من
 * مسارات API فقط، فتتبع ثلاث حالات حقيقية بدل الفشل الغامض:
 * - 401 ⇒ غير مسجّل (رابط لتسجيل الدخول).
 * - 503 ⇒ الحسابات غير مهيأة على الخادم (رسالة إرشادية بلا كسر المحرّر).
 * - 200 ⇒ اللوحة كاملة.
 * وبذلك يبقى المحرّر والتصيير يعملان كالسابق حتى قبل تهيئة المفاتيح.
 */

interface CreditsInfo {
  credits: number;
  plan: string;
  renderCost: number;
  billingEnabled: boolean;
  packs: Array<{ id: string; label: string; credits: number; price: string }>;
  usage: Array<{ kind: string; units: number }>;
}

interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface RenderSummary {
  id: string;
  status: string;
  url: string | null;
  createdAt: string;
  creditsUsed: number;
  error: string | null;
}

type Phase = "loading" | "ready" | "signed-out" | "no-database" | "error";

const USAGE_LABELS: Record<string, string> = {
  render: "تصيير",
  tts: "أصوات",
  image: "صور",
  script: "سكربتات",
  transcribe: "نسخ صوت",
  purchase: "شراء",
};

const STATUS_LABELS: Record<string, string> = {
  queued: "في الطابور",
  running: "جارٍ",
  done: "مكتمل",
  error: "فاشل",
};

const ClerkAccountControl: React.FC = () => {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded || !isSignedIn) {
    return null;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">حسابك · مسجّل الدخول</span>
      <UserButton />
    </div>
  );
};

export const AccountPanel: React.FC<{
  /** الحالة الحالية للمحرّر — تُحفظ كمشروع. */
  currentProps: ShortProps;
  /** تطبيق مشروع محمّل على المحرّر. */
  onLoad: (props: ShortProps, title: string) => void;
}> = ({ currentProps, onLoad }) => {
  const [phase, setPhase] = useState<Phase>("loading");
  const [info, setInfo] = useState<CreditsInfo | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [renders, setRenders] = useState<RenderSummary[]>([]);
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setNotice(null);
    const creditsRes = await fetch("/api/credits");
    if (creditsRes.status === 401) {
      setPhase("signed-out");
      return;
    }
    if (creditsRes.status === 503) {
      const body = (await creditsRes.json().catch(() => null)) as
        | { code?: string }
        | null;
      if (body?.code === "AUTH_UNAVAILABLE") {
        setPhase("error");
        return;
      }
      setPhase("no-database");
      return;
    }
    if (!creditsRes.ok) {
      setPhase("error");
      return;
    }
    const creditsJson = (await creditsRes.json()) as {
      type: "success";
      data: CreditsInfo;
    };
    setInfo(creditsJson.data);

    const [projectsRes, rendersRes] = await Promise.all([
      fetch("/api/projects"),
      fetch("/api/renders?limit=8"),
    ]);
    if (projectsRes.ok) {
      const payload = (await projectsRes.json()) as {
        data: { projects: ProjectSummary[] };
      };
      setProjects(payload.data.projects);
    }
    if (rendersRes.ok) {
      const payload = (await rendersRes.json()) as {
        data: { renders: RenderSummary[] };
      };
      setRenders(payload.data.renders);
    }
    setPhase("ready");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveProject = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || currentProps.hook.slice(0, 60) || "مشروع بلا عنوان",
          props: currentProps,
        }),
      });
      const json = (await res.json()) as
        | { type: "success"; data: { id: string } }
        | { type: "error"; message: string };
      if (json.type !== "success") {
        throw new Error(json.message);
      }
      setNotice("حُفظ المشروع في حسابك.");
      await refresh();
    } catch (err) {
      setNotice(`تعذّر الحفظ: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const loadProject = async (id: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${id}`);
      const json = (await res.json()) as
        | { type: "success"; data: { title: string; props: ShortProps } }
        | { type: "error"; message: string };
      if (json.type !== "success") {
        throw new Error(json.message);
      }
      onLoad(json.data.props, json.data.title);
      setTitle(json.data.title);
      setNotice("حُمّل المشروع إلى المحرّر.");
    } catch (err) {
      setNotice(`تعذّر التحميل: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const removeProject = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`رمز ${res.status}`);
      }
      await refresh();
    } catch (err) {
      setNotice(`تعذّر الحذف: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const buy = async (packId: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const json = (await res.json()) as
        | { type: "success"; data: { url: string } }
        | { type: "error"; message: string };
      if (json.type !== "success") {
        throw new Error(json.message);
      }
      window.location.href = json.data.url;
    } catch (err) {
      setNotice(`تعذّر بدء الدفع: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  if (phase === "signed-out") {
    return (
      <InputContainer>
        <div className="text-sm font-medium">حسابك</div>
        <div className="text-xs opacity-70">
          سجّل الدخول لحفظ مشاريعك في السحابة ورؤية سجل التصييرات ورصيدك.
          المحرّر يعمل بلا حساب، لكن الحفظ يبقى على هذا الجهاز فقط.
        </div>
        <Spacing />
        <Link className="underline text-sm" href="/sign-in">
          تسجيل الدخول
        </Link>
      </InputContainer>
    );
  }

  if (phase === "no-database") {
    return (
      <InputContainer>
        <div className="text-sm font-medium">حسابك</div>
        <div className="text-xs opacity-70">
          ميزات الحساب تحتاج قاعدة بيانات. أضف <code>DATABASE_URL</code> (Neon)
          وشغّل ترحيلات <code>drizzle/</code> ثم أعد النشر.
        </div>
      </InputContainer>
    );
  }

  if (phase === "loading") {
    return (
      <InputContainer>
        <div className="text-sm font-medium">حسابك</div>
        <div className="text-xs opacity-60">جارٍ تحميل الحساب…</div>
      </InputContainer>
    );
  }

  if (phase === "error" || !info) {
    return (
      <InputContainer>
        <div className="text-sm font-medium">حسابك</div>
        <ErrorComp
          message={
            phase === "error"
              ? "تعذّر التحقق من جلسة الدخول مؤقتاً. حاول مجدداً."
              : "تعذّر جلب بيانات الحساب."
          }
        />
        <Spacing />
        <Button secondary onClick={() => void refresh()}>
          إعادة المحاولة
        </Button>
      </InputContainer>
    );
  }

  return (
    <InputContainer>
      <div className="flex items-center justify-between gap-3">
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
        process.env.CLERK_SECRET_KEY ? (
          <ClerkAccountControl />
        ) : (
          <div className="text-sm font-medium">حساب محلي</div>
        )}
        <div className="text-sm">
          الرصيد: <strong>{info.credits}</strong> كريدت · التصيير ={" "}
          {info.renderCost}
        </div>
      </div>

      {info.usage.length > 0 ? (
        <div className="text-xs opacity-60">
          الاستهلاك:{" "}
          {info.usage
            .map((u) => `${USAGE_LABELS[u.kind] ?? u.kind} ${u.units}`)
            .join(" · ")}
        </div>
      ) : null}

      <Spacing />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">حفظ المشروع الحالي</label>
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            maxLength={120}
            placeholder="اسم المشروع…"
            className="leading-[1.7] block w-full rounded bg-background p-2 text-xs border outline-none"
          />
          <Button disabled={busy} loading={busy} onClick={saveProject}>
            حفظ
          </Button>
        </div>
      </div>

      {projects.length > 0 ? (
        <div className="flex flex-col gap-1 mt-2">
          <div className="text-xs font-medium">مشاريعي ({projects.length})</div>
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="truncate">{project.title}</span>
              <span className="flex gap-2 shrink-0">
                <button
                  type="button"
                  className="underline opacity-80"
                  onClick={() => void loadProject(project.id)}
                >
                  فتح
                </button>
                <button
                  type="button"
                  className="underline opacity-60"
                  onClick={() => void removeProject(project.id)}
                >
                  حذف
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {renders.length > 0 ? (
        <div className="flex flex-col gap-1 mt-2">
          <div className="text-xs font-medium">سجل التصييرات</div>
          {renders.map((render) => (
            <div
              key={render.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="truncate">
                {STATUS_LABELS[render.status] ?? render.status} ·{" "}
                {new Date(render.createdAt).toLocaleString("ar")}
                {render.error ? ` · ${render.error.slice(0, 60)}` : ""}
              </span>
              {render.url ? (
                <a
                  className="underline shrink-0"
                  href={render.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  تنزيل
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {info.billingEnabled && info.packs.length > 0 ? (
        <div className="flex flex-col gap-1 mt-3">
          <div className="text-xs font-medium">شراء كريدت</div>
          <div className="flex flex-wrap gap-2">
            {info.packs.map((pack) => (
              <Button
                key={pack.id}
                secondary
                disabled={busy}
                onClick={() => void buy(pack.id)}
              >
                {pack.label} — {pack.price}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {notice ? <div className="text-xs mt-2 opacity-80">{notice}</div> : null}
    </InputContainer>
  );
};
