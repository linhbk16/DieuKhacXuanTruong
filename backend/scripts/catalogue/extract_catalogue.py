"""Extract catalogue cells and embedded images for review; never contacts a server."""
import argparse
import hashlib
import html
import io
import json
import re
import unicodedata
import zipfile
from collections import Counter
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET

from PIL import Image, ImageFilter, ImageOps

NS = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'v': 'urn:schemas-microsoft-com:vml',
    'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
}
MONEY = re.compile(r'(?<![\d.,])\d+\s*\.\s*\d{3}(?:\s*\.\s*\d{3})*(?:\s*(?:đ|vnđ|vnd))?', re.I)


def clean(value):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', value)).strip()


def parse_caption(raw):
    """Never infer units or expand abbreviations. Flag anything needing human review."""
    text = clean(raw)
    warnings = []
    match = re.match(r'^(\d{1,4})\s*[-–—.]\s*(.*)$', text)
    if not match:
        return {'number': None, 'categoryName': '', 'dimensions': '', 'warnings': ['Không xác định được STT và tên; cần nhập tay.']}
    number, label = match.groups()
    label = MONEY.sub('', label).strip()
    # Numeric suffix normally starts the dimensions; numeric model names need review.
    split = re.search(r'\d', label)
    name = clean(label[:split.start()] if split else label)
    dimension = clean(label[split.start():] if split else '')
    dimension = re.sub(r'\s*[xX×]\s*', ' × ', dimension)
    if not name:
        warnings.append('Thiếu tên danh mục.')
    if not dimension:
        warnings.append('Chưa có kích thước.')
    if dimension and re.search(r'[^\d\s.,×xX\-/cmCMmđkĐKØø]', dimension):
        warnings.append('Kích thước có chữ hoặc biến thể mẫu; cần tách tên và quy cách.')
    if re.search(r'\b(?:Th|Ch|Ph|H)\b', name):
        warnings.append('Tên viết tắt, cần xác nhận danh mục.')
    if MONEY.search(label):
        warnings.append('Còn chuỗi giống giá tiền.')
    return {'number': int(number), 'categoryName': name, 'dimensions': dimension, 'warnings': warnings}


def images_in(element):
    result = []
    for picture in element.findall('.//pic:pic', NS):
        blip = picture.find('.//a:blip', NS)
        if blip is None:
            continue
        rid = blip.get(f'{{{NS["r"]}}}embed')
        rect = picture.find('.//a:srcRect', NS)
        transform = picture.find('.//a:xfrm', NS)
        result.append((rid, dict(rect.attrib) if rect is not None else {}, dict(transform.attrib) if transform is not None else {}))
    if not result:
        for picture in element.findall('.//v:imagedata', NS):
            result.append((picture.get(f'{{{NS["r"]}}}id'), {}, {}))
    # OOXML may contain both a modern picture and a fallback copy.
    return list({json.dumps(item, sort_keys=True): item for item in result}.values())


def extract_image(archive, rels, spec, output):
    rid, crop, transform = spec
    target = rels.get(rid)
    if not target or target not in archive.namelist():
        raise ValueError('Ảnh liên kết ngoài hoặc ảnh nhúng bị thiếu')
    raw = archive.read(target)
    digest = hashlib.sha256(raw).hexdigest()
    original = output / 'originals' / f'{digest}{PurePosixPath(target).suffix.lower()}'
    if not original.exists():
        original.write_bytes(raw)
    with Image.open(io.BytesIO(raw)) as opened:
        im = ImageOps.exif_transpose(opened).convert('RGB')
        width, height = im.size
        fractions = {key: int(crop.get(key, 0)) / 100000 for key in ('l', 't', 'r', 'b')}
        if any(value < 0 or value >= 1 for value in fractions.values()):
            raise ValueError('Khung cắt ảnh đặc biệt; cần xem thủ công')
        box = (round(width * fractions['l']), round(height * fractions['t']),
               round(width * (1 - fractions['r'])), round(height * (1 - fractions['b'])))
        if box[2] <= box[0] or box[3] <= box[1]:
            raise ValueError('Khung cắt ảnh không hợp lệ')
        im = im.crop(box)
        if transform.get('flipH') in ('1', 'true'):
            im = ImageOps.mirror(im)
        if transform.get('flipV') in ('1', 'true'):
            im = ImageOps.flip(im)
        if transform.get('rot'):
            im = im.rotate(-int(transform['rot']) / 60000, expand=True, fillcolor='white')
        # Keep original resolution when small; no AI-generated details or upscaling.
        im.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        identity = hashlib.sha256((digest + json.dumps([crop, transform], sort_keys=True)).encode()).hexdigest()
        before = output / 'before' / f'{identity}.webp'
        after = output / 'images' / f'{identity}.webp'
        im.save(before, 'WEBP', quality=92, method=4)
        im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=110, threshold=4)).save(after, 'WEBP', quality=92, method=4)
        return {'file': after.relative_to(output).as_posix(), 'before': before.relative_to(output).as_posix(),
                'original': original.relative_to(output).as_posix(), 'sourceSha256': digest,
                'sha256': hashlib.sha256(after.read_bytes()).hexdigest(), 'width': im.width, 'height': im.height}


def write_review(manifest, output):
    cards = []
    for index, entry in enumerate(manifest['items']):
        pics = ''.join(f'<a href="{html.escape(img["file"])}" target="_blank"><img loading="lazy" src="{html.escape(img["file"])}" alt="Ảnh mẫu"></a><a href="{html.escape(img["before"])}" target="_blank">Trước làm nét</a>' for img in entry['images'])
        esc = html.escape
        cards.append(f'''<article data-index="{index}"><h2>Mẫu {entry['number'] or '?'} · ô {entry['cell']}</h2>
          <p>{esc(entry['rawCaption'])}</p><div class="pictures">{pics}</div>
          <p class="warning">{esc(' / '.join(entry['warnings']))}</p>
          <label>Danh mục <input data-key="categoryName" value="{esc(entry['categoryName'], quote=True)}"></label>
          <label>Kích thước <input data-key="dimensions" value="{esc(entry['dimensions'], quote=True)}"></label>
          <label><input type="checkbox" data-key="approved"> Đã kiểm tra đúng mẫu, kích thước, ảnh không chứa giá</label>
          </article>''')
    # HTML is local-only. Escape the embedded JSON so document text cannot execute code.
    payload = json.dumps(manifest, ensure_ascii=False).replace('<', '\\u003c')
    page = '''<!doctype html><html lang="vi"><meta charset="utf-8"><title>Duyệt catalogue trước khi nhập</title>
    <style>body{font:16px system-ui;background:#f5f2ed;margin:24px;color:#252018}header{position:sticky;top:0;background:#fff;padding:16px;border:1px solid #ccc;z-index:2}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px}article{padding:16px;background:#fff;border:1px solid #ddd}h2{font-size:18px}.pictures img{width:100%;height:220px;object-fit:contain}.pictures a{display:block}label{display:block;margin:12px 0}input:not([type=checkbox]){width:95%;font:inherit;padding:8px}.warning{color:#973b00}button{font:inherit;padding:10px;cursor:pointer}</style>
    <header><strong>Chỉ duyệt trên máy — chưa upload hoặc ghi database</strong><p>Kiểm tra ảnh, tên danh mục và kích thước. Không chọn mẫu không rõ thông tin hoặc ảnh chứa giá. Không tự suy đoán đơn vị.</p><button id="save">Tải manifest đã duyệt</button></header><main class="grid">''' + ''.join(cards) + '''</main>
    <script id="data" type="application/json">''' + payload + '''</script><script>
    const manifest=JSON.parse(document.getElementById('data').textContent);
    document.getElementById('save').onclick=()=>{document.querySelectorAll('article').forEach(card=>{const item=manifest.items[Number(card.dataset.index)];card.querySelectorAll('[data-key]').forEach(input=>item[input.dataset.key]=input.type==='checkbox'?input.checked:input.value.trim());});const url=URL.createObjectURL(new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='manifest-reviewed.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    </script></html>'''
    (output / 'review.html').write_text(page, encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    source, output = Path(args.source).resolve(), Path(args.out).resolve()
    if (output / 'manifest.json').exists():
        raise SystemExit('Đã có manifest.json. Chọn thư mục --out mới để không ghi đè bản đã duyệt.')
    for folder in ('originals', 'before', 'images'):
        (output / folder).mkdir(parents=True, exist_ok=True)
    items, unassigned, errors = [], [], []
    with zipfile.ZipFile(source) as archive:
        document = ET.fromstring(archive.read('word/document.xml'))
        relationships = ET.fromstring(archive.read('word/_rels/document.xml.rels'))
        rels = {rel.get('Id'): str(PurePosixPath('word') / rel.get('Target', '')) for rel in relationships if rel.get('TargetMode') != 'External'}
        for index, cell in enumerate(document.findall('.//w:tbl/w:tr/w:tc', NS), 1):
            raw = '\n'.join(''.join(t.text or '' for t in p.findall('.//w:t', NS)) for p in cell.findall('w:p', NS)).strip()
            parsed = parse_caption(raw)
            entry = {'cell': index, 'rawCaption': raw, **parsed, 'approved': False, 'images': []}
            for spec in images_in(cell):
                try:
                    image = extract_image(archive, rels, spec, output)
                    entry['images'].append(image)
                    if min(image['width'], image['height']) < 320:
                        entry['warnings'].append('Ảnh gốc nhỏ; làm nét không phục hồi được chi tiết đã mất.')
                except Exception as exc:
                    entry['warnings'].append(str(exc))
                    errors.append({'cell': index, 'error': str(exc)})
            if not entry['images']:
                entry['warnings'].append('Không có ảnh riêng trong ô.')
            items.append(entry)
        # Standalone artwork is preserved separately, never silently imported as a product.
        for paragraph in document.findall('./w:body/w:p', NS):
            for spec in images_in(paragraph):
                try:
                    unassigned.append(extract_image(archive, rels, spec, output))
                except Exception as exc:
                    errors.append({'outsideTable': True, 'error': str(exc)})
        # This catalogue's first page is a single composite image, not Word table cells.
        # Coordinates/captions below were checked visually against that page; still require review.
        if len(unassigned) == 1 and unassigned[0]['sourceSha256'] == '164c8476af1bc72a0a0d1ae25bb95e9998fe8ff5a958a17efa78dbe4779d21b0':
            first_picture = images_in(document.find('./w:body/w:p', NS))[0]
            captions = [
                '01 - Cột tròn 10 x 17', '02 - Cột tròn 12 x 17', '03 - Cột tròn 15 x 22',
                '04 - Cột tròn 16 x 27', '05 - Cột tròn 18 x 27', '06 - Cột tròn 20 x 30',
                '07 - Cột tròn 20 x 20 (vấu)', '08 - Cột tròn 22 x 33', '09 - Cột tròn 22 (vấu)',
                '10 - Cột tròn 24 x 30', '11 - Cột tròn 25 x 30', '12 - Cột tròn 50 x 60',
                '13 - Cột 30 x 25 (mảnh)', '14 - Cột tròn 30 x 45', '15 - Cột tròn 35 x 27',
                '16 - Cột tròn 30 x 42', '17 - Cột tròn 30 x 33', '18 - Cột 30 x 33 (vấu)',
                '19 - Cột tròn 30 x 45', '20 - Cột tròn 30 x 43', '21 - Cột tròn 32 x 50',
                '22 - Cột tròn 35 x 55', '23 - Cột 35 x 28 (mảnh)', '24 - Cột tròn 35 x 47',
                '25 - Cột tròn 35 x 33', '26 - Cột tròn 40 x 32', '27 - Cột tròn 40 x 50',
                '28 - Cột tròn 45 x 32', '29 - Cột tròn 60 x 43', '30 - Đầu cột 42 x 52',
            ]
            columns = [(0.022, .199), (.221, .399), (.421, .594), (.611, .790), (.807, .984)]
            rows = [(.152, .258), (.293, .401), (.438, .540), (.580, .681), (.724, .825), (.865, .959)]
            first_items = []
            for offset, caption in enumerate(captions):
                left, right = columns[offset % 5]
                top, bottom = rows[offset // 5]
                crop = {'l': str(round(left*100000)), 't': str(round(top*100000)),
                        'r': str(round((1-right)*100000)), 'b': str(round((1-bottom)*100000))}
                parsed = parse_caption(caption)
                parsed['warnings'].append('Ảnh cắt từ trang ghép; cần kiểm tra chú thích và chất lượng.')
                if offset == 9:
                    parsed['warnings'].append('Chú thích ghi 24 × 30 nhưng chữ trên ảnh ghi 20–30; cần xác nhận.')
                first_items.append({'cell': f'cover-{offset+1}', 'rawCaption': caption, **parsed,
                                    'approved': False, 'images': [extract_image(archive, rels, (first_picture[0], crop, {}), output)]})
            items = first_items + items
    numbers = Counter(entry['number'] for entry in items if entry['number'] is not None)
    for entry in items:
        if numbers[entry['number']] > 1:
            entry['warnings'].append('STT xuất hiện nhiều lần; cần đối chiếu ảnh.')
    manifest = {'version': 1, 'catalogueId': 'xuan-truong-catalogue',
                'sourceFile': source.name, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'processing': 'Original resolution, maximum 1600px, UnsharpMask(1.0,110,4), WebP quality 92; no generative editing.',
                'items': items, 'unassignedImages': unassigned, 'errors': errors}
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    write_review(manifest, output)
    print(json.dumps({'cells': len(items), 'imagesInCells': sum(len(e['images']) for e in items),
                      'unassignedImages': len(unassigned), 'imageErrors': len(errors),
                      'review': str(output / 'review.html')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
