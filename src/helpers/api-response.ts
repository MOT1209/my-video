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
    try {
      const payload = await req.json();
      const parsed = schema.parse(payload);
      const data = await handler(req, parsed);
      return NextResponse.json({
        type: "success",
        data: data,
      });
    } catch (err) {
      return NextResponse.json(
        { type: "error", message: (err as Error).message },
        {
          status: 500,
        },
      );
    }
  };
