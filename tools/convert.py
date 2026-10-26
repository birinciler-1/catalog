#!/usr/bin/env python3
"""
محوّل الإكسل والصور إلى بيانات التطبيق.

المدخلات:
  excel/*.xlsx        ملف لكل شركة (اسم الملف = اسم الشركة، أو أضف عمود "الشركة")
  raw_images/         صور المنتجات، اسم كل صورة = كود المادة (مثال: 01010.png)
                      ويمكن وضعها داخل مجلد باسم الشركة عند تكرار الأكواد بين الشركات

المخرجات:
  data/products.json
  images/thumbs/*.webp   (مصغّرة للشبكة)
  images/full/*.webp     (للتفاصيل والمشاركة)
  reports/missing_images.txt

التشغيل:  python tools/convert.py [--prune] [--force]
"""
import argparse
import datetime
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl
from PIL import Image, ImageOps

ALIASES = {
    "name": ["اسم المادة", "اسم المنتج", "المادة", "name"],
    "code": ["كود المادة", "الكود", "كود", "code"],
    "barcode": ["باركود المادة", "الباركود", "باركود", "barcode"],
    "stock": ["عدد الباقي", "الباقي", "الكمية", "المخزون", "stock"],
    "pack": ["عدد التعبئة", "التعبئة", "pack"],
    "price": ["سعر المفرد", "سعر القطعة", "المفرد", "price"],
    "carton": ["سعر الكارتون", "سعر الكارتونة", "الكارتون", "carton"],
    "company": ["الشركة", "القسم", "company"],
}
IMG_EXT = {".png", ".jpg", ".jpeg", ".webp"}
AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def norm_header(s):
    s = unicodedata.normalize("NFKC", str(s or "")).strip().lower()
    s = re.sub(r"[ً-ٟـ]", "", s)
    return re.sub(r"\s+", " ", s)


HEADER_LOOKUP = {norm_header(a): k for k, v in ALIASES.items() for a in v}


def to_text(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).translate(AR_DIGITS).strip()


def to_code(v, pad):
    s = to_text(v)
    if isinstance(v, (int, float)) and s.isdigit() and pad and len(s) < pad:
        s = s.zfill(pad)
    return s


def to_num(v, warn, where, scale=1):
    if v is None or v == "":
        return 0
    if isinstance(v, (int, float)):
        if isinstance(v, float) and not v.is_integer():
            warn(f"{where}: القيمة {v} فيها كسور — تم التقريب (إن كانت الأرقام بالآلاف استخدم --thousands)")
        return int(round(v * scale))
    s = str(v).translate(AR_DIGITS)
    s = re.sub(r"[^\d-]", "", s)          # يزيل الفواصل والنقاط والرموز
    return int(s) * scale if s not in ("", "-") else 0


def find_header(ws):
    for r_idx, row in enumerate(ws.iter_rows(min_row=1, max_row=40, values_only=True), start=1):
        cols = {}
        for c_idx, v in enumerate(row):
            k = HEADER_LOOKUP.get(norm_header(v))
            if k and k not in cols:
                cols[k] = c_idx
        if "name" in cols and "code" in cols:
            return r_idx, cols
    return None, None


def read_excels(excel_dir, pad, thousands, warn):
    items, seen = [], {}
    files = sorted(p for p in excel_dir.glob("*.xlsx") if not p.name.startswith("~$"))
    if not files:
        sys.exit(f"لا توجد ملفات xlsx داخل {excel_dir}")
    for f in files:
        wb = openpyxl.load_workbook(f, data_only=True, read_only=True)
        found = False
        for ws in wb.worksheets:
            hdr_row, cols = find_header(ws)
            if not hdr_row:
                continue
            found = True
            scale = 1000 if thousands else 1
            for r_idx, row in enumerate(ws.iter_rows(min_row=hdr_row + 1, values_only=True), start=hdr_row + 1):
                get = lambda k: row[cols[k]] if k in cols and cols[k] < len(row) else None
                name, code = to_text(get("name")), to_code(get("code"), pad)
                if not name or not code:
                    continue
                where = f"{f.name}/{ws.title} سطر {r_idx}"
                company = to_text(get("company")) or f.stem
                it = {
                    "code": code, "name": re.sub(r"\s+", " ", name), "company": company,
                    "barcode": re.sub(r"\s+", "", to_text(get("barcode"))),
                    "stock": to_num(get("stock"), warn, where),
                    "pack": to_num(get("pack"), warn, where),
                    "price": to_num(get("price"), warn, where, scale),
                    "carton": to_num(get("carton"), warn, where, scale),
                }
                key = (company, code.lower())
                if key in seen:
                    warn(f"{where}: الكود {code} مكرر في {company} — اعتُمد السطر الأخير")
                    items[seen[key]] = it
                else:
                    seen[key] = len(items)
                    items.append(it)
        if not found:
            warn(f"{f.name}: لم أجد صف العناوين (اسم المادة / كود المادة) — تم تجاهل الملف")
    return items


def safe(s):
    return re.sub(r"[^A-Za-z0-9_-]+", "_", s)


def build_image_index(img_dir):
    """يفهرس الصور: (شركة|None, اسم الملف) ثم كل جزء من اسم الملف."""
    exact, tokens = {}, {}
    if not img_dir.exists():
        return exact, tokens
    for p in sorted(img_dir.rglob("*")):
        if p.suffix.lower() not in IMG_EXT or p.name.startswith("."):
            continue
        rel = p.relative_to(img_dir)
        scope = rel.parts[0] if len(rel.parts) > 1 else None
        stem = unicodedata.normalize("NFKC", p.stem).strip().lower()
        exact.setdefault((scope, stem), p)
        for t in re.split(r"[^0-9a-z؀-ۿ]+", stem):
            if t:
                tokens.setdefault((scope, t), []).append(p)
    return exact, tokens


def find_image(it, exact, tokens):
    code = it["code"].lower()
    for scope in (it["company"], None):
        if (scope, code) in exact:
            return exact[(scope, code)]
    for scope in (it["company"], None):          # "1 - 00748.png" أو "00748 (1).png"
        c = tokens.get((scope, code))
        if c and len(c) == 1:
            return c[0]
    return None


def save_webp(src, dst, size, quality, force):
    if dst.exists() and not force and dst.stat().st_mtime >= src.stat().st_mtime:
        return False
    im = ImageOps.exif_transpose(Image.open(src))
    im = im.convert("RGBA" if ("A" in im.getbands() or im.mode == "P") else "RGB")
    im.thumbnail((size, size), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=quality, method=4)
    return True


def main():
    root = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser()
    ap.add_argument("--excel", default=root / "excel", type=Path)
    ap.add_argument("--images", default=root / "raw_images", type=Path)
    ap.add_argument("--out", default=root, type=Path)
    ap.add_argument("--pad", type=int, default=5, help="تعبئة الأكواد الرقمية القصيرة بأصفار (الافتراضي 5)")
    ap.add_argument("--thousands", action="store_true", help="اضرب الأسعار بـ 1000 (إن كانت مكتوبة 7.75 بدل 7750)")
    ap.add_argument("--prune", action="store_true", help="احذف صور المنتجات المحذوفة من الإكسل")
    ap.add_argument("--force", action="store_true", help="أعد تحويل كل الصور")
    a = ap.parse_args()

    warnings = []
    warn = warnings.append
    items = read_excels(a.excel, a.pad, a.thousands, warn)
    companies = list(dict.fromkeys(i["company"] for i in items))

    code_cos = {}
    for i in items:
        code_cos.setdefault(i["code"].lower(), set()).add(i["company"])

    exact, tokens = build_image_index(a.images)
    used, missing, converted = set(), [], 0
    for it in items:
        src = find_image(it, exact, tokens)
        if not src:
            it["img"] = ""
            missing.append(f'{it["company"]}\t{it["code"]}\t{it["name"]}')
            continue
        stem = safe(it["code"])
        if len(code_cos[it["code"].lower()]) > 1:
            stem += "__" + hashlib.md5(it["company"].encode()).hexdigest()[:4]
        it["img"] = stem
        used.add(stem)
        t = save_webp(src, a.out / "images/thumbs" / f"{stem}.webp", 360, 80, a.force)
        f = save_webp(src, a.out / "images/full" / f"{stem}.webp", 1000, 85, a.force)
        converted += t or f

    if a.prune:
        for kind in ("thumbs", "full"):
            for p in (a.out / "images" / kind).glob("*.webp"):
                if p.stem not in used:
                    p.unlink()

    payload = {"companies": companies, "items": items}
    digest = hashlib.sha1(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]
    out = a.out / "data" / "products.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    updated = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    if out.exists():
        try:
            old = json.loads(out.read_text(encoding="utf-8"))
            if old.get("version") == digest:
                updated = old.get("updated", updated)
        except Exception:
            pass
    out.write_text(json.dumps({"version": digest, "updated": updated, **payload},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    rep = a.out / "reports"
    rep.mkdir(exist_ok=True)
    (rep / "missing_images.txt").write_text("الشركة\tالكود\tالاسم\n" + "\n".join(missing) + "\n", encoding="utf-8")

    print(f"المواد: {len(items)} | الشركات: {len(companies)} | صور محوّلة الآن: {converted} | بلا صورة: {len(missing)}")
    for w in warnings[:30]:
        print("تنبيه:", w)
    if len(warnings) > 30:
        print(f"… و{len(warnings) - 30} تنبيهات أخرى")


if __name__ == "__main__":
    main()
