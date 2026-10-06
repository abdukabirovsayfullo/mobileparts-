import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile


NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def cell_value(cell, shared_strings):
    value = cell.find("x:v", NS)
    if value is None:
        inline = cell.find("x:is/x:t", NS)
        return inline.text if inline is not None else None
    raw = value.text
    if cell.attrib.get("t") == "s":
        return shared_strings[int(raw)]
    if cell.attrib.get("t") == "b":
        return raw == "1"
    try:
        number = float(raw)
        return int(number) if number.is_integer() else number
    except (TypeError, ValueError):
        return raw


def read_rows(path):
    with zipfile.ZipFile(path) as archive:
        names = {name.lower(): name for name in archive.namelist()}
        strings_root = ET.fromstring(archive.read(names["xl/sharedstrings.xml"]))
        shared_strings = []
        for item in strings_root.findall("x:si", NS):
            shared_strings.append("".join(node.text or "" for node in item.findall(".//x:t", NS)))

        sheet_root = ET.fromstring(archive.read(names["xl/worksheets/sheet1.xml"]))
        rows = []
        for row in sheet_root.findall(".//x:sheetData/x:row", NS):
            cells = {}
            for cell in row.findall("x:c", NS):
                cells[cell.attrib["r"]] = cell_value(cell, shared_strings)
            rows.append({"row": int(row.attrib["r"]), "cells": cells})

    return rows


def normalize_name(value):
    return re.sub(r"\s+", " ", str(value or "")).strip().casefold()


def summarize(rows, database_path):
    products = []
    for row in rows:
        cells = row["cells"]
        name = cells.get(f"B{row['row']}")
        if not name or normalize_name(name) in {"ombor / maxsulot", "магазин"}:
            continue
        products.append({
            "row": row["row"],
            "name": re.sub(r"\s+", " ", str(name)).strip(),
            "openingQty": cells.get(f"E{row['row']}") or 0,
            "openingCost": cells.get(f"F{row['row']}") or 0,
            "incomingQty": cells.get(f"G{row['row']}") or 0,
            "incomingCost": cells.get(f"H{row['row']}") or 0,
            "outgoingQty": cells.get(f"I{row['row']}") or 0,
            "outgoingCost": cells.get(f"J{row['row']}") or 0,
            "closingQty": cells.get(f"K{row['row']}") or 0,
            "closingCost": cells.get(f"L{row['row']}") or 0,
        })

    by_name = {}
    for product in products:
        by_name.setdefault(normalize_name(product["name"]), []).append(product)

    result = {
        "workbookProducts": len(products),
        "duplicateWorkbookNames": {key: len(value) for key, value in by_name.items() if len(value) > 1},
        "totals": {
            key: sum(float(product[key]) for product in products)
            for key in ("openingQty", "openingCost", "incomingQty", "incomingCost", "outgoingQty", "outgoingCost", "closingQty", "closingCost")
        },
        "productsWithIncoming": sum(1 for product in products if product["incomingQty"]),
        "productsWithOutgoing": sum(1 for product in products if product["outgoingQty"]),
        "negativeClosing": [product for product in products if product["closingQty"] < 0],
    }

    if database_path:
        with open(database_path, encoding="utf-8") as source:
            database = json.load(source)
        db_by_name = {}
        for product in database.get("products", []):
            db_by_name.setdefault(normalize_name(product.get("name")), []).append(product)
        matched = []
        missing = []
        ambiguous = []
        for product in products:
            candidates = db_by_name.get(normalize_name(product["name"]), [])
            if len(candidates) == 1:
                matched.append((product, candidates[0]))
            elif not candidates:
                missing.append(product)
            else:
                ambiguous.append({"source": product, "matches": candidates})
        result.update({
            "databaseProducts": len(database.get("products", [])),
            "matched": len(matched),
            "missingCount": len(missing),
            "missing": missing[:30],
            "ambiguousCount": len(ambiguous),
            "ambiguous": ambiguous[:20],
            "sameClosingStock": sum(1 for source, target in matched if float(source["closingQty"]) == float(target.get("stock", 0))),
            "stockDifferenceTotal": sum(float(target.get("stock", 0)) - float(source["closingQty"]) for source, target in matched),
            "stockDifferenceExamples": [
                {"name": source["name"], "excelClosing": source["closingQty"], "crmStock": target.get("stock")}
                for source, target in matched if float(source["closingQty"]) != float(target.get("stock", 0))
            ][:30],
        })
    return result


def main(path, database_path=None):
    rows = read_rows(path)
    if database_path:
        print(json.dumps(summarize(rows, database_path), ensure_ascii=False, indent=2))
        return

    print(json.dumps({"rowCount": len(rows), "rows": rows}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
