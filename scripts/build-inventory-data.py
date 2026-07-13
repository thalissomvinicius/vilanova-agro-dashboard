from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "inventario"
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "data" / "inventory-parcels.json"

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

FARM_NAMES = {
    "vila-nova": "Vila Nova",
    "nova-conceicao": "Nova Conceicao",
    "fe-em-deus": "Fe em Deus",
}


def col_number(cell_ref: str) -> int:
    number = 0
    for char in "".join(ch for ch in cell_ref if ch.isalpha()):
        number = number * 26 + ord(char.upper()) - 64
    return number


def normalize_text(value: str) -> str:
    text = str(value or "").strip().lower()
    replacements = {
        "á": "a",
        "à": "a",
        "â": "a",
        "ã": "a",
        "é": "e",
        "ê": "e",
        "í": "i",
        "ó": "o",
        "ô": "o",
        "õ": "o",
        "ú": "u",
        "ç": "c",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def read_workbook(path: Path) -> dict[str, list[dict[int, str]]]:
    with ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in relationships}

        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in shared_root.findall("a:si", NS):
                shared_strings.append("".join(t.text or "" for t in item.findall(".//a:t", NS)))

        sheets: dict[str, list[dict[int, str]]] = {}
        for sheet in workbook.findall("a:sheets/a:sheet", NS):
            name = sheet.attrib["name"]
            rel_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = relmap[rel_id]
            xml_path = "xl/" + target.lstrip("/") if not target.startswith("xl/") else target
            root = ET.fromstring(archive.read(xml_path))

            rows: list[dict[int, str]] = []
            for row in root.findall("a:sheetData/a:row", NS):
                values: dict[int, str] = {"__row__": str(row.attrib["r"])}
                for cell in row.findall("a:c", NS):
                    value = cell.find("a:v", NS)
                    if value is None:
                        continue
                    text = value.text or ""
                    if cell.attrib.get("t") == "s":
                        text = shared_strings[int(text)]
                    values[col_number(cell.attrib["r"])] = text.strip() if isinstance(text, str) else text
                rows.append(values)

            sheets[name] = rows
        return sheets


def number_value(value: object) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    text = text.replace(".", "").replace(",", ".") if "," in text else text
    try:
        parsed = float(text)
    except ValueError:
        return None
    return parsed


def plant_count(value: object, plants_per_ha: float | None, area_ha: float | None) -> tuple[int | None, int | None]:
    parsed = number_value(value)
    if parsed is None:
        return None, None

    original = int(round(parsed))
    corrected = original
    if area_ha and plants_per_ha and parsed < 100 and area_ha > 1:
        expected = int(round(area_ha * plants_per_ha))
        if expected >= 100 and abs(expected - parsed) > 100:
            corrected = expected

    return corrected, original if original != corrected else None


def is_header(value: object) -> bool:
    return "parcela" in normalize_text(str(value or ""))


def is_valid_parcel(value: object) -> bool:
    text = str(value or "").strip().upper()
    if not text or "TOTAL" in text or "PLANTIO" in text:
        return False
    return bool(re.search(r"[A-Z]\s*-\s*\d+", text))


def make_record(source_file: str, sheet: str, farm_id: str, year: int, row: dict[int, str], start_col: int, last_block: str) -> tuple[dict | None, str]:
    block = str(row.get(start_col, "") or "").strip() or last_block
    parcel = str(row.get(start_col + 1, "") or "").strip().upper().replace(" ", "")

    if is_header(parcel) or not is_valid_parcel(parcel):
        return None, last_block

    plants_per_ha = number_value(row.get(start_col + 3))
    area_ha = number_value(row.get(start_col + 4))
    plants, original_plants = plant_count(row.get(start_col + 2), plants_per_ha, area_ha)
    cultivar = str(row.get(start_col + 5, "") or "").strip()

    if plants is None or area_ha is None:
        return None, last_block

    if not block or normalize_text(block) in {"total", "bloco"}:
        block = parcel.split("-", 1)[0]

    record = {
        "id": f"{farm_id}-{year}-{normalize_text(parcel)}",
        "farmId": farm_id,
        "farmName": FARM_NAMES[farm_id],
        "year": year,
        "block": block.upper(),
        "parcel": parcel,
        "plants": plants,
        "originalPlants": original_plants,
        "plantsPerHa": plants_per_ha,
        "areaHa": area_ha,
        "cultivar": cultivar or "Nao informado",
        "sourceFile": source_file,
        "sheet": sheet,
        "sourceRow": int(row["__row__"]),
    }
    return record, block


def parse_side_by_side(source_file: str, sheet: str, rows: list[dict[int, str]], farm_id: str, year: int, groups: list[int]) -> list[dict]:
    records: list[dict] = []
    last_blocks = {group: "" for group in groups}

    for row in rows:
        for group in groups:
            record, block = make_record(source_file, sheet, farm_id, year, row, group, last_blocks[group])
            if block:
                last_blocks[group] = block
            if record:
                records.append(record)

    return records


def parse_vila_nova(path: Path) -> list[dict]:
    workbook = read_workbook(path)
    records: list[dict] = []
    records.extend(parse_side_by_side(path.name, "Planti - 2011", workbook["Planti - 2011"], "vila-nova", 2011, [1, 8]))
    records.extend(parse_side_by_side(path.name, "Plantio - 2012", workbook["Plantio - 2012"], "vila-nova", 2012, [2, 9]))
    return records


def parse_nova_conceicao_fe_em_deus(path: Path) -> list[dict]:
    workbook = read_workbook(path)
    rows = workbook["Planilha1"]
    records: list[dict] = []
    farm_id = ""
    year = 0
    last_blocks = {1: "", 8: ""}

    for row in rows:
        row_text = " ".join(str(value) for key, value in row.items() if key != "__row__")
        normalized = normalize_text(row_text)

        if "fazenda-nova-conceicao" in normalized:
            farm_id = "nova-conceicao"
            last_blocks = {1: "", 8: ""}
        elif "fazenda-fe-em-deus" in normalized:
            farm_id = "fe-em-deus"
            last_blocks = {1: "", 8: ""}

        year_match = re.search(r"plantio\s*(20\d{2})", row_text, flags=re.IGNORECASE)
        if year_match and len([value for key, value in row.items() if key != "__row__" and str(value).strip()]) <= 2:
            year = int(year_match.group(1))
            last_blocks = {1: "", 8: ""}

        if not farm_id or not year:
            continue

        for group in (1, 8):
            record, block = make_record(path.name, "Planilha1", farm_id, year, row, group, last_blocks[group])
            if block:
                last_blocks[group] = block
            if record:
                records.append(record)

    return records


def summarize(records: list[dict]) -> dict:
    summary = {
        "totalParcels": len(records),
        "totalPlants": sum(record["plants"] for record in records),
        "totalAreaHa": round(sum(record["areaHa"] for record in records), 2),
        "byFarm": {},
        "byYear": {},
        "byCultivar": {},
        "correctedRows": [record for record in records if record["originalPlants"] is not None],
    }

    for record in records:
        for key, value in (
            ("byFarm", record["farmName"]),
            ("byYear", str(record["year"])),
            ("byCultivar", record["cultivar"]),
        ):
            bucket = summary[key].setdefault(value, {"parcels": 0, "plants": 0, "areaHa": 0})
            bucket["parcels"] += 1
            bucket["plants"] += record["plants"]
            bucket["areaHa"] = round(bucket["areaHa"] + record["areaHa"], 2)

    return summary


def main() -> None:
    vila_nova = RAW_DIR / "INVENTARIO 2011-2012 - VILA NOVA.xlsx"
    nova_fe = RAW_DIR / "INVENTARIO DAS FAZENDAS NOVA CONCEICAO E FE EM DEUS.xlsx"

    records = [
        *parse_vila_nova(vila_nova),
        *parse_nova_conceicao_fe_em_deus(nova_fe),
    ]
    records.sort(key=lambda item: (item["farmName"], item["year"], item["block"], item["parcel"], item["sourceRow"]))

    payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "sourceDirectory": "data/inventario",
        "notes": [
            "Vila Nova usa somente as abas 2011 e 2012, conforme orientacao operacional.",
            "Quando plantas informadas eram incompativeis com area e densidade, plants foi recalculado e originalPlants preserva o valor da celula.",
        ],
        "records": records,
        "summary": summarize(records),
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Generated {OUTPUT} with {len(records)} records")


if __name__ == "__main__":
    main()
