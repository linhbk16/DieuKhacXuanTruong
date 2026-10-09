import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Drawer,
  Form,
  Image,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  message
} from "antd";
import { adminApi } from "../api/adminApi";
import { ImageUploadField } from "../components/common/ImageUploadField";
import { PageHeaderCard } from "../components/common/PageHeaderCard";
import { RichTextEditor } from "../components/common/RichTextEditor";
import { StatusTag } from "../components/common/StatusTag";
import { applyServerValidationToForm, createMinLengthRule, getApiErrorMessage } from "../utils/formFeedback";
import { parseDimensionOptions, serializeDimensionOptions } from "../utils/productDimensions";

const mapImages = (images = []) =>
  images.map((image, index) => ({
    url: image.url,
    key: image.key,
    altText: image.altText || "",
    sortOrder: image.sortOrder ?? index,
    isPrimary: Boolean(image.isPrimary)
  }));

export function ProductsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  // Filters from URL or local
  const urlCategoryId = searchParams.get("categoryId") || "";
  const [selectedCategory, setSelectedCategory] = useState(urlCategoryId);
  const [searchKeyword, setSearchKeyword] = useState("");

  // Sync state if URL changes
  useEffect(() => {
    setSelectedCategory(urlCategoryId);
  }, [urlCategoryId]);

  const categoriesQuery = useQuery({
    queryKey: ["admin-product-categories"],
    queryFn: () => adminApi.getCategories({ type: "PRODUCT", limit: 100 })
  });

  const productsQuery = useQuery({
    queryKey: ["admin-products", { categoryId: selectedCategory, search: searchKeyword }],
    queryFn: () =>
      adminApi.getProducts({
        categoryId: selectedCategory || undefined,
        search: searchKeyword || undefined,
        limit: 100
      })
  });

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        ...values,
        tags: values.tags ? values.tags.split(",").map((item) => item.trim()).filter(Boolean) : [],
        images: mapImages(values.images),
        dimensions: serializeDimensionOptions(values.dimensions)
      };
      delete payload.slug;

      if (editing) {
        return adminApi.updateProduct(editing.id, payload);
      }
      return adminApi.createProduct(payload);
    },
    onSuccess: () => {
      message.success(editing ? "Đã cập nhật sản phẩm." : "Đã thêm sản phẩm mới.");
      setOpen(false);
      setEditing(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-product-categories"] });
    },
    onError: (error) => {
      const hasFieldErrors = applyServerValidationToForm(form, error);
      message.error(
        hasFieldErrors ? "Vui lòng kiểm tra lại các ô đang báo lỗi trước khi lưu." : getApiErrorMessage(error, "Không thể lưu sản phẩm.")
      );
    }
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteProduct,
    onSuccess: () => {
      message.success("Đã xóa sản phẩm.");
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-product-categories"] });
    }
  });

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
    form.resetFields();
    form.setFieldsValue({
      categoryId: selectedCategory || (categoriesQuery.data?.items?.[0]?.id ?? undefined),
      material: "Bê tông",
      sortOrder: 0,
      isFeatured: false,
      isVisible: true,
      images: []
    });
  };

  const openEdit = (record) => {
    setEditing(record);
    setOpen(true);
    form.setFieldsValue({
      ...record,
      categoryId: record.categoryId || record.category?.id,
      tags: (record.tags || []).join(", "),
      images: mapImages(record.images || []),
      dimensions: parseDimensionOptions(record.dimensions)
    });
  };

  // Clone an existing product/variant to quickly register a new size
  const cloneProduct = (record) => {
    setEditing(null);
    setOpen(true);
    form.resetFields();
    form.setFieldsValue({
      ...record,
      categoryId: record.categoryId || record.category?.id,
      name: `${record.name} (Bản sao mới)`,
      shortDescription: record.shortDescription,
      content: record.content,
      material: record.material || "Bê tông",
      dimensions: parseDimensionOptions(record.dimensions),
      tags: (record.tags || []).join(", "),
      images: mapImages(record.images || []),
      sortOrder: (record.sortOrder || 0) + 1,
      isFeatured: false,
      isVisible: true
    });
    message.info("Đã sao chép thông tin. Hãy chỉnh sửa Tên quy cách/Kích thước mới và tải ảnh nếu có.");
  };

  // Auto-fill template description for architectural products
  const fillSampleTemplate = () => {
    const currentName = form.getFieldValue("name") || "CV 60x85";
    const sampleHtml = `<ul>
<li><strong>Mã sản phẩm:</strong> ${currentName}</li>
<li><strong>Kích thước:</strong> Theo quy cách ôm thân cột x Chiều cao</li>
<li><strong>Dạng thiết kế:</strong> Mảnh ốp ghép đúc sẵn tiện lợi cẩu lắp thi công</li>
<li><strong>Chất liệu:</strong> Bê tông gia cường mác cao / Thạch cao mỹ thuật</li>
<li><strong>Phong cách:</strong> Tân cổ điển hoàng gia Châu Âu</li>
<li><strong>Ứng dụng:</strong> Trang trí đầu/chân cột sảnh, cột hiên, biệt thự, dinh thự</li>
<li><strong>Ưu điểm:</strong> Họa tiết đục nổi 3D sắc nét, bề mặt láng mịn sẵn sàng phủ sơn hoàn thiện</li>
</ul>`;
    form.setFieldsValue({ content: sampleHtml });
    message.success("Đã điền khung mô tả kỹ thuật mẫu.");
  };

  const categories = [...(categoriesQuery.data?.items || [])].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", "vi", { sensitivity: "base", numeric: true })
  );
  const products = productsQuery.data?.items || [];

  const columns = [
    {
      title: "Ảnh",
      width: 105,
      render: (_, record) => (
        <Image
          src={record.thumbnail || record.images?.[0]?.url}
          width={84}
          height={64}
          style={{ objectFit: "cover", borderRadius: 10, border: "1px solid #f0e6d2" }}
          fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Crect width='80' height='60' fill='%23eee'/%3E%3C/svg%3E"
        />
      )
    },
    {
      title: "Tên quy cách & Kích thước",
      dataIndex: "name",
      render: (name, record) => (
        <div>
          <strong style={{ fontSize: "14px", color: "#1a1612" }}>{name}</strong>
          {record.shortDescription && (
            <div style={{ color: "#777", fontSize: "12px", marginTop: "2px", maxWidth: "340px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {record.shortDescription}
            </div>
          )}
        </div>
      )
    },
    {
      title: "Danh mục (Mẫu SP)",
      width: 180,
      render: (_, record) => (
        <Tag color="gold" style={{ fontWeight: 600, fontSize: "12px", borderRadius: "12px", padding: "2px 8px" }}>
          {record.category?.name || "Chưa phân loại"}
        </Tag>
      )
    },
    {
      title: "Kích thước (cm)",
      width: 140,
      render: (_, record) => {
        const dims = parseDimensionOptions(record.dimensions);
        if (dims.length) {
          return dims.map((d) => <Tag key={d}>{d}</Tag>);
        }
        return <span style={{ color: "#999", fontSize: "12px" }}>Theo thiết kế</span>;
      }
    },
    {
      title: "Chất liệu",
      dataIndex: "material",
      width: 120,
      render: (material) => material ? <Tag color="cyan">{material}</Tag> : <span style={{ color: "#bbb" }}>-</span>
    },
    {
      title: "Nổi bật",
      dataIndex: "isFeatured",
      width: 90,
      render: (value) => <StatusTag value={value} />
    },
    {
      title: "Trạng thái",
      dataIndex: "isVisible",
      width: 95,
      render: (value) => <StatusTag value={value} />
    },
    {
      title: "Tác vụ",
      width: 200,
      render: (_, record) => (
        <Space size={6}>
          <Button size="small" onClick={() => openEdit(record)}>
            Sửa
          </Button>
          <Tooltip title="Nhân bản mẫu này để tạo nhanh kích thước mới">
            <Button size="small" type="dashed" onClick={() => cloneProduct(record)}>
              Nhân bản
            </Button>
          </Tooltip>
          <Popconfirm
            title="Xóa quy cách sản phẩm này?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button size="small" danger>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <PageHeaderCard
        title="Quản lý sản phẩm & Quy cách kích thước"
        description="Mỗi Danh mục là một Mẫu sản phẩm chính (như Đầu cột vuông, Đầu cột tròn, Phù điêu...). Tại đây bạn quản lý các phiên bản kích thước, ảnh chi tiết và thông số quy cách của từng mẫu."
        actions={
          <Button type="primary" size="large" onClick={openCreate}>
            + Thêm sản phẩm / Kích thước mới
          </Button>
        }
      />

      {/* Filter and Search Bar for Unified Product & Category Browsing */}
      <Card
        size="small"
        className="admin-card"
        style={{ marginBottom: 16, background: "#faf7f2", borderColor: "#eddcc0" }}
      >
        <Space wrap size={16} align="center">
          <span style={{ fontWeight: 600, color: "#5a4828" }}>📁 Lọc theo Mẫu/Danh mục:</span>
          <Select
            style={{ width: 280 }}
            placeholder="Tất cả danh mục sản phẩm"
            value={selectedCategory || ""}
            onChange={(val) => {
              setSelectedCategory(val);
              const p = new URLSearchParams(searchParams);
              if (val) p.set("categoryId", val);
              else p.delete("categoryId");
              setSearchParams(p);
            }}
            options={[
              {
                label: `✨ Tất cả danh mục (${categories.reduce((s, c) => s + (c.productCount || 0), 0) || products.length} tác phẩm)`,
                value: ""
              },
              ...categories.map((cat) => ({
                label: `${cat.name} (${cat.productCount || 0} kích thước)`,
                value: cat.id
              }))
            ]}
          />

          <Input.Search
            style={{ width: 300 }}
            placeholder="Tìm theo tên mẫu, mã hoặc kích thước..."
            allowClear
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />

          {(selectedCategory || searchKeyword) && (
            <Button
              onClick={() => {
                setSelectedCategory("");
                setSearchKeyword("");
                setSearchParams({});
              }}
            >
              ✕ Xóa bộ lọc
            </Button>
          )}

          <span style={{ color: "#777", fontSize: "13px", marginLeft: "auto" }}>
            Hiển thị: <strong>{products.length}</strong> quy cách
          </span>
        </Space>
      </Card>

      <Table
        className="admin-card"
        rowKey="id"
        dataSource={products}
        columns={columns}
        loading={productsQuery.isLoading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />

      <Drawer
        open={open}
        width={920}
        title={
          editing
            ? `Cập nhật: ${editing.name}`
            : "Thêm sản phẩm / Kích thước mới"
        }
        onClose={() => setOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="primary" onClick={() => form.submit()} loading={saveMutation.isPending}>
              Lưu sản phẩm
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item
            name="categoryId"
            label="Danh mục (Mẫu sản phẩm cha)"
            rules={[{ required: true, message: "Vui lòng chọn danh mục." }]}
            extra="Mỗi danh mục là một dòng sản phẩm/hoa văn chuẩn (ví dụ: ĐẤU CỘT, Phù Điêu, Hoa văn...)."
          >
            <Select
              options={categories.map((item) => ({
                label: `${item.name} ${item.productCount ? `(${item.productCount} cỡ hiện có)` : ""}`,
                value: item.id
              }))}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên quy cách & Kích thước sản phẩm"
            rules={[createMinLengthRule("Tên sản phẩm", 2)]}
            extra="Ví dụ: '64 - Cột vuông 60 x 85' hoặc 'Đầu cột tròn CV 15x22' để khách hàng nhận biết ngay quy cách."
          >
            <Input placeholder="Nhập tên sản phẩm kèm kích thước" />
          </Form.Item>

          <Form.Item
            name="shortDescription"
            label="Mô tả ngắn gọn"
            rules={[createMinLengthRule("Mô tả ngắn", 10)]}
            extra="Tóm tắt quy cách, phom dáng và ứng dụng của kích thước này."
          >
            <Input.TextArea rows={3} placeholder="Đấu cột vuông bê tông đúc sẵn với chiều cao... phom ôm thân cột..." />
          </Form.Item>

          <Space orientation="horizontal" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Mô tả kỹ thuật chi tiết:</span>
            <Button size="small" type="link" onClick={fillSampleTemplate}>
              ⚡ Điền mẫu mô tả kỹ thuật chuẩn
            </Button>
          </Space>
          <Form.Item name="content">
            <RichTextEditor />
          </Form.Item>

          <Space orientation="horizontal" style={{ display: "flex" }} size={16} align="start">
            <Form.Item name="material" label="Chất liệu" style={{ flex: 1 }}>
              <Select
                placeholder="Chọn hoặc nhập chất liệu"
                options={[
                  { value: "Bê tông", label: "Bê tông / Xi măng đúc sẵn" },
                  { value: "Bê tông GFRC", label: "Bê tông cốt sợi thủy tinh (GFRC)" },
                  { value: "Thạch cao", label: "Thạch cao mỹ thuật" },
                  { value: "Gỗ", label: "Gỗ tự nhiên" },
                  { value: "Đá", label: "Đá điêu khắc" }
                ]}
              />
            </Form.Item>
            <Form.Item
              name="dimensions"
              label="Kích thước chi tiết (tags)"
              style={{ flex: 1 }}
              extra="Ví dụ: 60x85, Ôm cột 60cm, Cao 85cm."
            >
              <Select mode="tags" tokenSeparators={[","]} placeholder="Nhập kích thước rồi Enter" />
            </Form.Item>
          </Space>

          <Form.Item name="tags" label="Tags tìm kiếm (phân cách bằng dấu phẩy)">
            <Input placeholder="đầu cột, cột vuông, tân cổ điển, ngoại thất" />
          </Form.Item>

          <Form.Item
            name="images"
            label="Bộ ảnh sản phẩm"
            extra="Tải ảnh sắc nét của sản phẩm/kích thước này. Ảnh đầu tiên sẽ làm ảnh đại diện chính."
          >
            <ImageUploadField folder="products" multiple />
          </Form.Item>

          <Space orientation="horizontal" style={{ display: "flex" }} size={24} align="center">
            <Form.Item name="sortOrder" label="Thứ tự hiển thị">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="isFeatured" label="Nổi bật (Trang chủ)" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="isVisible" label="Đang hiển thị" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item
            name="metaTitle"
            label="Tiêu đề SEO Google (tùy chọn)"
            extra="Nếu để trống, website sẽ tự dùng tên sản phẩm."
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="metaDescription"
            label="Mô tả SEO Google (tùy chọn)"
            extra="Nếu để trống, website sẽ tự dùng phần mô tả ngắn của sản phẩm."
          >
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
