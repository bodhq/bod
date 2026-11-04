import json
import sys
from pathlib import Path

from server.main import app


def main() -> None:
    output_paths = [Path(value) for value in sys.argv[1:]] or [
        Path(__file__).resolve().parents[1] / "schema" / "openapi.json"
    ]
    document = json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"
    for output_path in output_paths:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(document, encoding="utf-8")
        print(f"Wrote OpenAPI schema to {output_path}")


if __name__ == "__main__":
    main()
