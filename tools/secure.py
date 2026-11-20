#!/usr/bin/env python3
"""أداة الحماية للكتالوج — تعمل داخل GitHub Actions (لا تعمل شيئاً على جهازك).

الأوامر:
  unlock-excel  : يفك قفل ملفات إكسل داخل excel/ على جهاز GitHub المؤقت فقط (لا تُحفظ مفتوحة في المستودع)
  seal          : يشفّر data/products.json  → data/products.enc  (برمز APP_CODE) ثم يحذف الملف المقروء
                  ويشفّر private/debts.xlsx → data/debts.enc     (برمز DEBTS_CODE إن وُجد وإلا APP_CODE)

الأسرار تُقرأ من متغيرات البيئة (GitHub Secrets): EXCEL_PASSWORD و APP_CODE و DEBTS_CODE (اختياري).
لا يُطبع أي سر في السجل.
"""
import base64, glob, io, json, os, sys

ITER = 250_000          # يجب أن يطابق ما في app.js
MIN_CODE = 8


def die(msg):
    print('❌ ' + msg); sys.exit(1)


def code_norm(v):       # نفس codeNorm في app.js: إزالة الفراغات وتحويل الأرقام العربية
    t = str(v or '').strip()
    for i, d in enumerate('٠١٢٣٤٥٦٧٨٩'): t = t.replace(d, str(i))
    for i, d in enumerate('۰۱۲۳۴۵۶۷۸۹'): t = t.replace(d, str(i))
    return t


def b64(b): return base64.b64encode(b).decode()


def encrypt(data: bytes, code: str) -> dict:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    salt, iv = os.urandom(16), os.urandom(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER).derive(code.encode('utf-8'))
    return {'v': 1, 'kdf': 'pbkdf2-sha256', 'iter': ITER, 'salt': b64(salt), 'iv': b64(iv), 'ct': b64(AESGCM(key).encrypt(iv, data, None))}


def decrypt(env: dict, code: str) -> bytes:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=base64.b64decode(env['salt']), iterations=env['iter']).derive(code.encode('utf-8'))
    return AESGCM(key).decrypt(base64.b64decode(env['iv']), base64.b64decode(env['ct']), None)


def open_excel_bytes(path, password):
    """يعيد محتوى ملف إكسل مفتوحاً؛ إن كان مقفلاً يفكه بكلمة السر، وإن لم يكن مقفلاً يعيده كما هو."""
    raw = open(path, 'rb').read()
    import msoffcrypto
    of = msoffcrypto.OfficeFile(io.BytesIO(raw))
    if not of.is_encrypted():
        return raw, False
    if not password:
        die(f'الملف {path} مقفل بكلمة سر لكن السر EXCEL_PASSWORD غير موجود في GitHub Secrets')
    try:
        of.load_key(password=password)
        out = io.BytesIO(); of.decrypt(out)
    except Exception:
        die(f'تعذّر فك قفل {path}: كلمة سر إكسل في GitHub Secrets (EXCEL_PASSWORD) لا تطابق كلمة سر الملف')
    return out.getvalue(), True


def cmd_unlock_excel():
    pw = os.environ.get('EXCEL_PASSWORD', '')
    files = [p for p in sorted(glob.glob('excel/*.xls*')) if not os.path.basename(p).startswith('~$')]
    if not files: print('لا ملفات إكسل داخل excel/'); return
    for p in files:
        data, was = open_excel_bytes(p, pw)
        if was: open(p, 'wb').write(data)          # يُكتب على جهاز GitHub المؤقت فقط، ولا يدخل الحفظ في المستودع
        print(('🔓 فُك قفل ' if was else '• غير مقفل: ') + p)


def cmd_seal():
    app = code_norm(os.environ.get('APP_CODE'))
    if len(app) < MIN_CODE: die(f'APP_CODE غير موجود أو أقصر من {MIN_CODE} أحرف — لم يُنشر شيء')
    src = 'data/products.json'
    if not os.path.exists(src): die('لم أجد data/products.json (هل نجح convert.py؟)')
    raw = open(src, 'rb').read(); json.loads(raw)
    env = encrypt(raw, app)
    assert decrypt(env, app) == raw                  # فحص رجوع قبل أي حذف
    json.dump(env, open('data/products.enc', 'w'), separators=(',', ':'))
    os.remove(src)
    print(f'🔒 data/products.enc ({len(raw)//1024} KB مشفّر) وحُذف products.json المقروء')

    dsrc = 'private/debts.xlsx'
    if os.path.exists(dsrc):
        dcode = code_norm(os.environ.get('DEBTS_CODE')) or app
        data, _ = open_excel_bytes(dsrc, os.environ.get('EXCEL_PASSWORD', ''))
        denv = encrypt(data, dcode)
        assert decrypt(denv, dcode) == data
        json.dump(denv, open('data/debts.enc', 'w'), separators=(',', ':'))
        print('🔒 data/debts.enc (الديون) بتشفير ' + ('رمز الديون المستقل' if os.environ.get('DEBTS_CODE') else 'رمز التطبيق'))
    else:
        print('• لا يوجد private/debts.xlsx — لم تُنشر ديون')
    if os.path.exists('data/debts.xlsx'):
        print('⚠ تنبيه: data/debts.xlsx القديم (مقروء) ما زال في المستودع — احذفه يدوياً')


if __name__ == '__main__':
    c = sys.argv[1] if len(sys.argv) > 1 else ''
    {'unlock-excel': cmd_unlock_excel, 'seal': cmd_seal}.get(c, lambda: die('الأوامر: unlock-excel | seal'))()
