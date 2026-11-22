import { describe, expect, test } from "vitest";
import { regionAliases } from "./regions";

describe("카카오 시도 이름 약칭", () => {
  test.each([
    ["전남광주통합특별시", ["전남", "광주"]],
    ["강원특별자치도", ["강원"]],
    ["전북특별자치도", ["전북"]],
  ])("%s", (name, expected) => {
    expect(regionAliases(name)).toEqual(expected);
  });
});
