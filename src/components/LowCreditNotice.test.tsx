import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LowCreditNotice } from "./LowCreditNotice";

const render = (props: React.ComponentProps<typeof LowCreditNotice>) =>
  renderToStaticMarkup(<LowCreditNotice {...props} />);

describe("LowCreditNotice", () => {
  test("لا يظهر إن كان الرصيد يكفي تصييراً واحداً", () => {
    expect(render({ credits: 1, renderCost: 1, billingEnabled: true })).toBe("");
    expect(render({ credits: 5, renderCost: 1, billingEnabled: false })).toBe("");
  });

  test("رصيد صفر مع فوترة مفعّلة: يشرح السبب ويوجّه للشراء", () => {
    const html = render({ credits: 0, renderCost: 1, billingEnabled: true });
    expect(html).toContain('role="status"');
    expect(html).toContain("لا يكفي لتصيير");
    expect(html).toContain("بريد مؤقت");
    expect(html).toContain("شراء كريدت من الحزم");
  });

  test("رصيد صفر بلا فوترة: لا يعد بشراء غير متاح", () => {
    const html = render({ credits: 0, renderCost: 1, billingEnabled: false });
    expect(html).toContain("الشراء غير مفعّل");
    expect(html).not.toContain("من الحزم أدناه");
  });
});
