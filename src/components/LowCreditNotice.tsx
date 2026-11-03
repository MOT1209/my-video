import React from "react";

/**
 * تنبيه الرصيد غير الكافي في لوحة الحساب. يشرح لماذا قد يكون الرصيد صفراً من
 * البداية: الكريدت المجاني يُمنح عند إنشاء الحساب فقط، ويُحجب عن البريد المؤقت
 * وعن ما يتجاوز سقف الحسابات الجديدة من نفس الشبكة (`signup-guard.ts`).
 * لا يظهر إن كان الرصيد يكفي تصييراً واحداً.
 */
export const LowCreditNotice: React.FC<{
  credits: number;
  renderCost: number;
  billingEnabled: boolean;
}> = ({ credits, renderCost, billingEnabled }) => {
  if (credits >= renderCost) {
    return null;
  }
  return (
    <div role="status" className="mt-2 rounded border p-2 text-xs leading-[1.8]">
      رصيدك الحالي لا يكفي لتصيير فيديو (يحتاج {renderCost} كريدت). الكريدت
      المجاني يُمنح مرة واحدة عند إنشاء الحساب، وقد لا يُمنح لبعض الحسابات
      (بريد مؤقت، أو تسجيل حسابات كثيرة من نفس الشبكة).{" "}
      {billingEnabled
        ? "يمكنك شراء كريدت من الحزم أدناه."
        : "الشراء غير مفعّل على هذا الخادم حالياً."}
    </div>
  );
};
