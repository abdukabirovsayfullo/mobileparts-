import json
import re
import sys

from inspect_turnover_xlsx import normalize_name, read_rows


def number(cells, column, row):
    value = cells.get(f"{column}{row}")
    return float(value) if value not in (None, "") else 0.0


def main(source_path, output_path):
    items = []
    for source in read_rows(source_path):
        row = source["row"]
        cells = source["cells"]
        raw_name = cells.get(f"B{row}")
        if not raw_name or normalize_name(raw_name) in {"ombor / maxsulot", "магазин"}:
            continue
        incoming_qty = number(cells, "G", row)
        outgoing_qty = number(cells, "I", row)
        if incoming_qty <= 0 and outgoing_qty <= 0:
            continue
        items.append({
            "sourceRow": row,
            "name": re.sub(r"\s+", " ", str(raw_name)).strip(),
            "incomingQty": incoming_qty,
            "incomingCost": number(cells, "H", row),
            "outgoingQty": outgoing_qty,
            "outgoingCost": number(cells, "J", row),
        })

    plan = {
        "importId": "turnover-2026-09",
        "sourceName": "tavar aylanmasi yangi.xlsx",
        "period": {"from": "2026-09-01", "to": "2026-09-30"},
        "timestamp": "2026-09-30T18:59:00.000Z",
        "items": items,
        "totals": {
            "incomingQty": sum(item["incomingQty"] for item in items),
            "incomingCost": sum(item["incomingCost"] for item in items),
            "outgoingQty": sum(item["outgoingQty"] for item in items),
            "outgoingCost": sum(item["outgoingCost"] for item in items),
        },
    }
    with open(output_path, "w", encoding="utf-8") as output:
        json.dump(plan, output, ensure_ascii=False, indent=2)
        output.write("\n")
    print(json.dumps({"items": len(items), **plan["totals"]}, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
