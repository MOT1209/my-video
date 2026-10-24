import { NextResponse } from "next/server";
import { z, ZodType } from "zod";

export type ApiResponse<Res> =
  | {
      type: "error";
      message: string;
    }
  | {
      type: "success";
      data: Res;
    };

/**
 * مغلّفَا الردود للمسارات الجديدة: نفس شكل `executeApi`
 * (`type: success|error`) لكن مع رمز حالة صحيح — تحتاجه مسارات المرحلة 4
 * للتفريق بين 400 (بيانات) و401 (هوية) و404 (ملكية) و503 (قاعدة مفقودة)،
 * وهو ما لا يسمح به `executeApi` الذي يُعيد 500 لكل خطأ.
 */
export function apiSuccess<Res>(data: Res) {
  return NextResponse.json({ type: "success", data });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ type: "error", message }, { status });
}

export const executeApi =
  <Res, Req extends ZodType>(
    schema: Req,
    handler: (req: Request, body: z.infer<Req>) => Promise<Res>,
  ) =>
  async (req: Request) => {
    if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return apiError("أرسل الطلب بصيغة application/json.", 415);
    }

    // JSON تالف أو بيانات مخالفة للمخطط ⇒ 400 برسالة عامة (لا تفاصيل Zod الداخلية)
    const payload = await req.json().catch(() => undefined);
    const parsed = schema.safeParse(payload);
    if (payload === undefined || !parsed.success) {
      return NextResponse.json(
        { type: "error", message: "طلب غير صالح: تحقّق من الحقول المرسلة." },
        { status: 400 },
      );
    }
    try {
      const data = await handler(req, parsed.data);
      return NextResponse.json({
        type: "success",
        data: data,
      });
    } catch (err) {
      // لا نعيد تفاصيل المزوّد أو الخطأ الداخلي إلى العميل.
      const errorName = err instanceof Error ? err.name : "unknown";
      console.error(`api: تعذّر تنفيذ الطلب (${errorName})`);
      return apiError("تعذّر تنفيذ الطلب حالياً.", 502);
    }
  };
