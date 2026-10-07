import { describe, expect, it } from "vitest";
import { isDiscoverDailyDue, nextDiscoverScheduledAt } from "./schedule";

describe("agendamento do Descobrir IA", () => {
  it("calcula a próxima passagem das 08h em São Paulo sem histórico", () => {
    expect(nextDiscoverScheduledAt({ enabled: true }, undefined, new Date("2026-10-07T10:59:59.000Z")))
      .toBe("2026-10-07T11:00:00.000Z");
    expect(nextDiscoverScheduledAt({ enabled: true }, undefined, new Date("2026-10-07T11:00:00.000Z")))
      .toBe("2026-10-08T11:00:00.000Z");
  });

  it("respeita dois dias civis e deixa estado vencido para a próxima passagem", () => {
    expect(nextDiscoverScheduledAt({ enabled: true }, "2026-10-05", new Date("2026-10-07T10:59:59.000Z")))
      .toBe("2026-10-07T11:00:00.000Z");
    expect(nextDiscoverScheduledAt({ enabled: true }, "2026-10-05", new Date("2026-10-07T11:00:00.000Z")))
      .toBe("2026-10-08T11:00:00.000Z");
    expect(nextDiscoverScheduledAt({ enabled: true }, "2026-09-20", new Date("2026-10-07T13:00:00.000Z")))
      .toBe("2026-10-08T11:00:00.000Z");
  });

  it("não prevê execução quando pausado e só considera diária após 08h", () => {
    expect(nextDiscoverScheduledAt({ enabled: false }, "2026-10-01", new Date("2026-10-07T13:00:00.000Z"))).toBeNull();
    expect(isDiscoverDailyDue(undefined, new Date("2026-10-07T10:59:59.000Z"))).toBe(false);
    expect(isDiscoverDailyDue("2026-10-05", new Date("2026-10-07T11:00:00.000Z"))).toBe(true);
    expect(isDiscoverDailyDue("2026-10-06", new Date("2026-10-07T13:00:00.000Z"))).toBe(false);
  });

  it("mantém o intervalo civil em viradas de mês, ano e no dia bissexto", () => {
    expect(nextDiscoverScheduledAt({ enabled: true }, "2026-01-30", new Date("2026-01-30T12:00:00.000Z")))
      .toBe("2026-02-01T11:00:00.000Z");
    expect(nextDiscoverScheduledAt({ enabled: true }, "2026-12-31", new Date("2027-01-01T12:00:00.000Z")))
      .toBe("2027-01-02T11:00:00.000Z");
    expect(nextDiscoverScheduledAt({ enabled: true }, "2028-02-27", new Date("2028-02-27T12:00:00.000Z")))
      .toBe("2028-02-29T11:00:00.000Z");
  });
});
