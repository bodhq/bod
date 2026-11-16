import type { RoomTransferCoverage } from "../transfer-draft";

import { Button } from "@/core/ui/actions/Button";

import { transferLevels } from "../transfer-draft";

export function TransferLegend() {
  return (
    <ul className="transfer-key" aria-label="Význam náročností">
      {transferLevels.map((level) => (
        <li key={level.id} data-level={level.id}>
          <i aria-hidden="true" />
          {level.label}
          {level.range && ` · ${level.range}`}
        </li>
      ))}
    </ul>
  );
}

export function TransferCoverage({
  coverage,
  onSelect,
}: {
  coverage: RoomTransferCoverage;
  onSelect?: (id: string) => void;
}) {
  return (
    <fieldset className="transfer-coverage" aria-label="Přehled přesunů podle výchozí učebny">
      {coverage.map(({ room, counts }) => {
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        const description = transferLevels
          .map((level) => `${level.label}: ${counts[level.id]}`)
          .join(", ");
        const content = (
          <>
            <span className="transfer-coverage-label">
              <strong>{room.code}</strong>
              <span>{counts.missing ? `Chybí ${counts.missing}` : "Vyplněno"}</span>
            </span>
            <span className="transfer-coverage-track" aria-hidden="true">
              {transferLevels.map(
                (level) =>
                  counts[level.id] > 0 && (
                    <span
                      key={level.id}
                      data-level={level.id}
                      style={{ width: `${(counts[level.id] / Math.max(1, total)) * 100}%` }}
                    />
                  ),
              )}
            </span>
          </>
        );
        return onSelect ? (
          <Button
            key={room.id}
            variant="choice"
            className="transfer-coverage-room"
            contentClassName="transfer-coverage-content"
            aria-label={`Z učebny ${room.code}. ${description}`}
            onClick={() => onSelect(room.id)}
          >
            {content}
          </Button>
        ) : (
          <div
            key={room.id}
            className="transfer-coverage-room"
            role="img"
            aria-label={`Z učebny ${room.code}. ${description}`}
          >
            {content}
          </div>
        );
      })}
    </fieldset>
  );
}
