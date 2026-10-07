# Nhập catalogue Xuân Trường

## Quy tắc

- Tên trong tài liệu dùng để tạo danh mục PRODUCT riêng khi bật `--allow-new-categories`; tên đã có được dùng lại. Không tự chuyển hoặc sửa sản phẩm cũ.
- STT nhận diện mẫu; các mẫu khác kích thước không tự gộp thành một sản phẩm.
- Không nhập giá. Không đoán đơn vị, tên viết tắt, kích thước thiếu hoặc mâu thuẫn.
- Chỉ nhập dòng đã duyệt ảnh và thông tin. Cùng danh mục/kích thước với sản phẩm cũ phải đối chiếu ảnh, không tự thêm.
- Làm nét nhẹ ảnh gốc, không phóng lớn hoặc tạo thêm chi tiết. Ảnh nguồn nhỏ vẫn có giới hạn chất lượng.

## 1. Đối chiếu dữ liệu hiện có — chỉ đọc

Chạy tại thư mục `backend`:

```powershell
node scripts/catalogue/plan_catalogue.mjs --manifest temp/catalogue-review-20261006-v3/manifest.json --allow-new-categories
```

Lệnh chỉ đọc MongoDB và ghi báo cáo local `existing-catalogue.json`, `import-plan.json`; không upload. Mọi mẫu ban đầu chưa duyệt nên kết quả REVIEW là bình thường. Kiểm tra `target` vì cấu hình local có thể dùng chung database website đang chạy. Không gửi file `.env` hoặc khóa bí mật.

## 2. Duyệt trước khi nhập

Mở `backend/temp/catalogue-review-20261006-v3/review.html`. Đối chiếu hình, tên danh mục và kích thước; chỉ đánh dấu những mẫu chắc chắn đúng và ảnh không chứa giá. Mẫu 10 có mâu thuẫn kích thước giữa chú thích và chữ trên ảnh, cần xác minh.

Lưu `manifest-reviewed.json` về cùng thư mục với `review.html`. Không dùng bản trích xuất cũ không có hậu tố `-v3`.

Nếu tên tài liệu khác danh mục hiện có, tạo `category-map.json` dạng `{"ten da chuan hoa": "ID danh mục PRODUCT đã đối chiếu"}` rồi truyền `--mapping <đường-dẫn>`. Không tự chọn danh mục chỉ dựa trên tên gần giống.

Lập lại kế hoạch với manifest đã duyệt:

```powershell
node scripts/catalogue/plan_catalogue.mjs --manifest temp/catalogue-review-20261006-v3/manifest-reviewed.json --allow-new-categories
```

Đọc từng quyết định CREATE trong `import-plan.json`. REVIEW/SKIP không được nhập. Nếu thay đổi manifest hoặc ảnh phải lập lại kế hoạch. Kế hoạch chưa tính hết va chạm giữa các mẫu mới; lúc nhập sẽ kiểm tra lại và bỏ qua mẫu nghi trùng.

`proposedNewCategories` chỉ là số danh mục đề xuất, chưa tạo trong database. Danh mục mới chỉ được tạo khi nhập một sản phẩm đã duyệt thuộc danh mục đó. Tên viết tắt, lỗi chữ hoặc trùng slug bị chặn để kiểm tra. Mẫu có cùng tên/quy cách hoặc STT với sản phẩm cũ sẽ được cảnh báo dù nằm ở danh mục khác; cùng STT là dấu hiệu cần duyệt, không khẳng định hai ảnh là một mẫu.

## 3. Kiểm thử — người dùng chạy trước khi upload

```powershell
node --test scripts/catalogue/catalogue_rules.test.mjs
python scripts/catalogue/test_extract_catalogue.py
```

Các kiểm thử chỉ kiểm tra quy tắc tách thông tin/chống trùng; không kết nối database. Chúng không thay thế việc duyệt từng ảnh.

## 4. Upload — có ghi dữ liệu, chỉ chạy sau khi duyệt

Script dùng cấu hình MongoDB/Cloudinary sẵn có, ưu tiên `.env` ở gốc dự án rồi `backend/.env`. Không chạy đồng thời nhiều bản importer. Nên sao lưu database trước.

```powershell
$planPath = "temp/catalogue-review-20261006-v3/import-plan.json"
$plan = Get-Content -Raw $planPath | ConvertFrom-Json
$planHash = (Get-FileHash -Algorithm SHA256 $planPath).Hash.ToLowerInvariant()
$target = "$($plan.host)/$($plan.database)"
Write-Output $target
# Chỉ chạy dòng dưới sau khi xác nhận đúng database và các mẫu CREATE:
node scripts/catalogue/apply_catalogue.mjs --apply --plan $planPath --manifest temp/catalogue-review-20261006-v3/manifest-reviewed.json --confirm-target $target --confirm-plan $planHash --limit 5
```

Nhập thử tối đa 5 mẫu, kiểm tra trên web trước khi tiếp tục. Script không ghi trường giá. Sản phẩm nhập dở được giữ ẩn; chỉ hiện sau khi đủ ảnh. Biên nhận nằm trong `receipts/` cạnh manifest.

Chạy lại cùng kế hoạch bỏ qua mẫu đã nhập; ảnh có khóa cố định và không ghi đè. Nếu dừng giữa chừng, giữ nguyên manifest/kế hoạch để tiếp tục. Nếu có `import.lock` sau sự cố, cần kiểm tra không còn tiến trình nhập đang chạy trước khi xử lý thủ công; không chạy lại mù quáng.

## Khôi phục

Không có tự động xóa sản phẩm hoặc ảnh Cloudinary. Nếu nhập sai, dùng ID/slug trong biên nhận để ẩn đúng các sản phẩm vừa nhập bằng trang quản trị, giữ dữ liệu để kiểm tra. Không xóa theo tên hoặc toàn bộ danh mục. Đây là MongoDB, không áp dụng câu lệnh rollback SQL.

Danh mục mới có bản ghi `CATEGORY_CREATED` trong biên nhận. Nếu cần khôi phục, chỉ ẩn danh mục mới đó sau khi kiểm tra các sản phẩm bên trong; không tác động danh mục có sẵn. Sự cố upload có thể để lại danh mục trống, cần đối chiếu biên nhận.

## Giới hạn

Chưa xác minh tích hợp Cloudinary/MongoDB trước khi người dùng chạy. Chống trùng dựa trên slug, tên, STT, danh mục, kích thước và ảnh trùng byte trong tài liệu; ảnh khác byte nhưng cùng mẫu vẫn cần người duyệt. Không có khóa liên máy, không chạy nhiều đợt đồng thời. Không tự duyệt toàn bộ dữ liệu chỉ vì đã bật tạo danh mục.
