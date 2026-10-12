import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
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
  message
} from "antd";
import { adminApi } from "../api/adminApi";
import { ImageUploadField } from "../components/common/ImageUploadField";
import { PageHeaderCard } from "../components/common/PageHeaderCard";
import { RichTextEditor } from "../components/common/RichTextEditor";
import { StatusTag } from "../components/common/StatusTag";
import { applyServerValidationToForm, createMinLengthRule, getApiErrorMessage } from "../utils/formFeedback";

const mapImages = (images = []) =>
  images.map((image, index) => ({
    url: image.url,
    key: image.key,
    altText: image.altText || "",
    sortOrder: image.sortOrder ?? index,
    isPrimary: Boolean(image.isPrimary)
  }));

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const projectsQuery = useQuery({
    queryKey: ["admin-projects"],
    queryFn: () => adminApi.getProjects({ limit: 100 })
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-project-categories"],
    queryFn: () => adminApi.getCategories({ type: "PROJECT", limit: "all" })
  });

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        ...values,
        categoryId: values.categoryId || null,
        images: mapImages(values.images)
      };
      delete payload.slug;

      if (editing) {
        return adminApi.updateProject(editing.id, payload);
      }
      return adminApi.createProject(payload);
    },
    onSuccess: () => {
      message.success("Đã lưu công trình.");
      setOpen(false);
      setEditing(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    },
    onError: (error) => {
      const hasFieldErrors = applyServerValidationToForm(form, error);

      message.error(
        hasFieldErrors ? "Vui lòng kiểm tra lại các ô đang báo lỗi trước khi lưu." : getApiErrorMessage(error, "Không thể lưu công trình.")
      );
    }
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteProject,
    onSuccess: () => {
      message.success("Đã xóa công trình.");
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    }
  });

  const openEdit = (record) => {
    setEditing(record);
    setOpen(true);
    form.setFieldsValue({
      ...record,
      images: mapImages(record.images || [])
    });
  };

  const columns = [
    {
      title: "Ảnh",
      render: (_, record) => (
        <Image
          src={record.thumbnail || record.images?.[0]?.url}
          width={92}
          height={72}
          style={{ objectFit: "cover", borderRadius: 12 }}
        />
      )
    },
    { title: "Tên công trình", dataIndex: "name" },
    { title: "Địa điểm", dataIndex: "location" },
    { title: "Năm", dataIndex: "year" },
    { title: "Nổi bật", dataIndex: "isFeatured", render: (value) => <StatusTag value={value} /> },
    {
      title: "Tác vụ",
      render: (_, record) => (
        <Space>
          <Button onClick={() => openEdit(record)}>Sửa</Button>
          <Popconfirm title="Xóa công trình này?" okText="Xóa" cancelText="Hủy" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button danger>Xóa</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <PageHeaderCard
        title="Quản lý công trình"
        description="Quản lý tên công trình, hình ảnh, địa điểm, năm thực hiện và phạm vi thi công. Liên kết của công trình sẽ tự tạo theo tên."
        actions={
          <Button
            type="primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
              form.setFieldsValue({
                sortOrder: 0,
                isFeatured: false,
                isVisible: true,
                images: []
              });
            }}
          >
            Thêm công trình
          </Button>
        }
      />

      <Table className="admin-card" rowKey="id" dataSource={projectsQuery.data?.items || []} columns={columns} />

      <Drawer
        open={open}
        width={880}
        title={editing ? "Cập nhật công trình" : "Thêm công trình"}
        onClose={() => setOpen(false)}
        extra={
          <Button type="primary" onClick={() => form.submit()} loading={saveMutation.isPending}>
            Lưu
          </Button>
        }
      >
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="categoryId" label="Danh mục công trình">
            <Select
              allowClear
              options={(categoriesQuery.data?.items || []).map((item) => ({
                label: item.name,
                value: item.id
              }))}
            />
          </Form.Item>
          <Form.Item name="name" label="Tên công trình" rules={[createMinLengthRule("Tên công trình", 2)]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="shortDescription"
            label="Mô tả ngắn"
            rules={[createMinLengthRule("Mô tả ngắn", 10)]}
            extra="Nên viết ít nhất 10 ký tự để khách hàng hiểu nhanh về công trình."
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="content" label="Nội dung chi tiết">
            <RichTextEditor />
          </Form.Item>
          <Space style={{ display: "flex" }} size={16} align="start">
            <Form.Item name="location" label="Địa điểm" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="year" label="Năm thực hiện" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="scope" label="Hạng mục thực hiện">
            <Input />
          </Form.Item>
          <Form.Item
            name="images"
            label="Bộ ảnh công trình"
            extra="Bạn có thể chọn nhiều ảnh để khách xem rõ công trình ở nhiều góc khác nhau."
          >
            <ImageUploadField folder="projects" multiple />
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
          <Form.Item
            name="metaTitle"
            label="Tiêu đề khi tìm kiếm (tùy chọn)"
            extra="Nếu muốn, bạn có thể đặt một tiêu đề riêng khi công trình xuất hiện trên Google."
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="metaDescription"
            label="Mô tả khi tìm kiếm (tùy chọn)"
            extra="Nếu để trống, website sẽ tự dùng phần mô tả ngắn của công trình."
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
