import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message
} from "antd";
import { adminApi } from "../api/adminApi";
import { ImageUploadField } from "../components/common/ImageUploadField";
import { PageHeaderCard } from "../components/common/PageHeaderCard";
import { StatusTag } from "../components/common/StatusTag";

export function CategoriesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminApi.getCategories({ limit: "all" })
  });

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        ...values,
        imageUrl: values.image?.url || "",
        imageKey: values.image?.key || null
      };
      delete payload.slug;
      delete payload.image;

      if (editing) {
        return adminApi.updateCategory(editing.id, payload);
      }
      return adminApi.createCategory(payload);
    },
    onSuccess: () => {
      message.success("Đã lưu danh mục.");
      setOpen(false);
      setEditing(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteCategory,
    onSuccess: () => {
      message.success("Đã xóa danh mục.");
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    }
  });

  const openEdit = (record) => {
    setEditing(record);
    setOpen(true);
    form.setFieldsValue({
      ...record,
      image: record.imageUrl ? { url: record.imageUrl, key: record.imageKey, altText: record.name } : null
    });
  };

  const columns = [
    { title: "Tên danh mục / Mẫu", dataIndex: "name", render: (name) => <strong>{name}</strong> },
    {
      title: "Loại",
      dataIndex: "type",
      render: (type) => (
        <Tag color={type === "PRODUCT" ? "gold" : "blue"}>
          {type === "PRODUCT" ? "Sản phẩm / Mẫu" : "Công trình"}
        </Tag>
      )
    },
    {
      title: "Số quy cách kích thước",
      render: (_, record) => {
        if (record.type !== "PRODUCT") return "-";
        const count = record.productCount || 0;
        return (
          <Button
            type="link"
            style={{ padding: 0, fontWeight: 600, color: count ? "#c59b27" : "#999" }}
            onClick={() => navigate(`/products?categoryId=${record.id}`)}
          >
            {count} kích thước quy cách →
          </Button>
        );
      }
    },
    { title: "Thứ tự", dataIndex: "sortOrder", width: 90 },
    {
      title: "Nổi bật",
      dataIndex: "isFeatured",
      render: (value) => <StatusTag value={value} />
    },
    {
      title: "Trạng thái",
      dataIndex: "isVisible",
      render: (value) => <StatusTag value={value} />
    },
    {
      title: "Tác vụ",
      render: (_, record) => (
        <Space>
          {record.type === "PRODUCT" && (
            <Button
              type="dashed"
              size="small"
              onClick={() => navigate(`/products?categoryId=${record.id}`)}
            >
              Xem kích thước
            </Button>
          )}
          <Button size="small" onClick={() => openEdit(record)}>Sửa</Button>
          <Popconfirm title="Xóa danh mục này?" okText="Xóa" cancelText="Hủy" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button size="small" danger>Xóa</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <PageHeaderCard
        title="Quản lý danh mục"
        description="Sắp xếp danh mục sản phẩm và công trình, ảnh đại diện và thứ tự hiển thị. Liên kết của từng danh mục sẽ tự tạo theo tên."
        actions={
          <Button
            type="primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
              form.setFieldsValue({ type: "PRODUCT", sortOrder: 0, isFeatured: false, isVisible: true });
            }}
          >
            Thêm danh mục
          </Button>
        }
      />

      <Table className="admin-card" rowKey="id" dataSource={categoriesQuery.data?.items || []} columns={columns} />

      <Modal
        open={open}
        width={820}
        title={editing ? "Cập nhật danh mục" : "Thêm danh mục"}
        okText="Lưu"
        cancelText="Hủy"
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="type" label="Loại danh mục" rules={[{ required: true, message: "Vui lòng chọn loại danh mục." }]}>
            <Select
              options={[
                { value: "PRODUCT", label: "Sản phẩm" },
                { value: "PROJECT", label: "Công trình" }
              ]}
            />
          </Form.Item>
          <Form.Item name="name" label="Tên danh mục" rules={[{ required: true, message: "Vui lòng nhập tên danh mục." }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="image" label="Ảnh danh mục">
            <ImageUploadField folder="categories" />
          </Form.Item>
          <Space style={{ display: "flex" }} size={16} align="start">
            <Form.Item name="sortOrder" label="Thứ tự">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="isFeatured" label="Nổi bật" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="isVisible" label="Đang hiển thị" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
