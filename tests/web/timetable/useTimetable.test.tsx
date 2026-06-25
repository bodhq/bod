import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTimetable } from "@/modules/timetable/hooks/useTimetable";
import * as api from "@/modules/timetable/api";

/**
 * ONBOARDING PRO VÝVOJÁŘE:
 * Jelikož testování React komponent (UI) může být křehké, soustředíme
 * se v rámci "Prod Grade" testování na Business Logiku Frontendu - Hooky.
 *
 * Zde testujeme, zda náš hook správně volá API, nastavuje stavy (loading, error)
 * a bezpečně zachází s daty.
 */

describe("useTimetable Hook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("by měl vrátit pole hodin a správně vyřešit načítání", async () => {
    // 1. ARRANGE: Namockujeme data z API klienta
    const mockLessons = [
      {
        id: 1,
        class_id: 1,
        subject: "Matematika",
        teacher_id: 1,
        room: "U2",
        day: 1,
        start_time: "08:00",
        end_time: "08:45",
      },
    ];

    vi.spyOn(api, "fetchClassTimetable").mockResolvedValue(mockLessons);

    // 2. ACT: Vyrenderujeme hook v izolaci
    const { result } = renderHook(() => useTimetable(1));

    // Na začátku by mělo být načítání true
    expect(result.current.isLoading).toBe(true);
    expect(result.current.lessons).toEqual([]);

    // 3. ASSERT: Počkáme na dokončení asynchronních operací
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.lessons).toEqual(mockLessons);
    expect(result.current.error).toBeNull();
  });

  it("by měl zachytit chybu, pokud API selže", async () => {
    // 1. ARRANGE: API vyhodí chybu
    vi.spyOn(api, "fetchClassTimetable").mockRejectedValue(
      new Error("Network Error"),
    );

    // 2. ACT
    const { result } = renderHook(() => useTimetable(1));

    // 3. ASSERT
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Nepodařilo se načíst rozvrh.");
    expect(result.current.lessons).toEqual([]);
  });
});
