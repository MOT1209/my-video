"use client";

import { useEffect, useState } from "react";
import type { CaptionStyle, ShortTheme, WordCaption } from "../../types/shorts";

/**
 * حفظ/تحميل حالة المحرّر (بند "حفظ المشاريع" من المرحلة 4 — شريحة أولى):
 * قبل هذه الجولة كانت الحالة تُفقد عند تحديث الصفحة. نحفظ كل حقول المحرّر
 * في localStorage لكل جهاز — بلا قاعدة بيانات أو حسابات (فتظل قاعدة
 * بيانات + مصادقة خطوة المرحلة 4 الكاملة لهذا البند).
 *
 * التصميم: تُقرأ المحفوظات بعد أول تركيب (متوافق مع SSR — القيم
 * الافتراضية تُصيَّر أولاً ثم تُستبدل في useEffect)، ثم تُكتب القيم
 * بعد 300ms من آخر تغيير (بلا stringify كل حرف).
 */

const STORAGE_KEY = "my-video:editor:v1";

export interface EditorState {
  hook: string;
  scenesText: string;
  theme: ShortTheme;
  captionStyle: CaptionStyle;
  voiceId: string;
  scriptSource: string;
  audioUrl: string | null;
  audioDurationSec: number | null;
  captions: WordCaption[];
}

function loadSavedState(): Partial<EditorState> | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<EditorState>;
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** يُعيد ما حفظه المستخدم آخر مرة (null قبل hydration الأولى). */
export function useSavedEditorState(): {
  saved: Partial<EditorState> | null;
  hydrated: boolean;
} {
  const [saved, setSaved] = useState<Partial<EditorState> | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSaved(loadSavedState());
    setHydrated(true);
  }, []);

  return { saved, hydrated };
}

/** يكتب الحالة بعد 300ms من آخر تغيير؛ فشل الحفظ لا يؤثر بالمحرّر. */
export function usePersistEditor(
  fields: EditorState,
  hydrated: boolean,
): void {
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) {
        return;
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
      } catch {
        // localStorage ممتلئ أو محظور — لا نجعل عملية المحرّر تفشل
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [fields, hydrated]);
}
