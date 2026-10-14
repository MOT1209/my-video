import { describe, expect, test } from "bun:test";
import { generateSecMsGecV2 } from "./sec-ms-gec";

const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";

// قيم مرجعية مُتحقق منها ضد مكتبة edge-tts الرسمية (Python 7.3.1)
const VECTORS: Array<[number, string]> = [
  [
    1791988200,
    "627E7559185D9B80-F9DC5FC54DEC3E37506C3489607E2FABA1C21F388ABD8410FAA09DA28A6799D4",
  ],
  [
    1000000000.5,
    "5E9153719FADA922-14D2A75113EC5862E17303287DCDB197E3A671DF9FCC53C100D6B27928384B98",
  ],
  [
    0.1,
    "52BC7A17B50DFEC9-28C4394775C8751CD2F6859C030C06DB1489ACAB3B3A7651831FC26895177ED6",
  ],
];

describe("generateSecMsGecV2", () => {
  for (const [stamp, expected] of VECTORS) {
    test(`matches official implementation at ${stamp}`, () => {
      expect(generateSecMsGecV2(TOKEN, stamp)).toBe(expected);
    });
  }

  test("format is <16 hex>-<64 hex>", () => {
    expect(generateSecMsGecV2(TOKEN, 1791988263.972)).toMatch(
      /^[0-9A-F]{16}-[0-9A-F]{64}$/,
    );
  });

  test("same 5-minute window gives same token", () => {
    expect(generateSecMsGecV2(TOKEN, 1791988200)).toBe(
      generateSecMsGecV2(TOKEN, 1791988499),
    );
  });
});
