import { useEffect, useState } from "react";
import { Layout, Menu, Button, Modal } from "antd";
import {
  AppstoreOutlined,
  DashboardOutlined,
  FileImageOutlined,
  FileTextOutlined,
  FolderOutlined,
  HomeOutlined,
  LogoutOutlined,
  MailOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { adminApi } from "../../api/adminApi";
import { useAuth } from "../../context/AuthContext";

const { Header, Sider, Content } = Layout;

const menuItems = [
  {
    key: "/",
    icon: <DashboardOutlined />,
    label: <Link to="/">Tổng quan</Link>,
  },
  {
    key: "/banners",
    icon: <FileImageOutlined />,
    label: <Link to="/banners">Banner</Link>,
  },
  {
    key: "/categories",
    icon: <FolderOutlined />,
    label: <Link to="/categories">Danh mục</Link>,
  },
  {
    key: "/products",
    icon: <AppstoreOutlined />,
    label: <Link to="/products">Sản phẩm</Link>,
  },
  {
    key: "/projects",
    icon: <HomeOutlined />,
    label: <Link to="/projects">Công trình</Link>,
  },
  {
    key: "/pages",
    icon: <FileTextOutlined />,
    label: <Link to="/pages">Trang tĩnh</Link>,
  },
  {
    key: "/contacts",
    icon: <MailOutlined />,
    label: <Link to="/contacts">Liên hệ</Link>,
  },
  {
    key: "/settings",
    icon: <SettingOutlined />,
    label: <Link to="/settings">Cấu hình</Link>,
  },
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  // Same query key as the Settings page, so a new logo shows up right after saving.
  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: adminApi.getSettings,
    enabled: Boolean(user),
    staleTime: 1000 * 60 * 5,
  });
  const companyName = settings?.companyName || "Điêu Khắc Xuân Trường";

  const match = menuItems.find(
    (item) =>
      location.pathname === item.key ||
      location.pathname.startsWith(`${item.key}/`),
  );
  const selectedKey = match?.key || "/";

  useEffect(() => {
    if (!user) {
      return;
    }

    const welcomeName = sessionStorage.getItem("admin_welcome_name");
    if (!welcomeName) {
      return;
    }

    setWelcomeOpen(true);
    sessionStorage.removeItem("admin_welcome_name");
  }, [user]);

  return (
    <Layout className="admin-shell">
      <Sider breakpoint="lg" collapsedWidth="0" theme="light" width={260}>
        <div className="admin-logo">
          {settings?.logoUrl ? (
            <img className="admin-logo__image" src={settings.logoUrl} alt={companyName} />
          ) : (
            <span>DK</span>
          )}
          <div>
            <strong>{companyName}</strong>
          </div>
        </div>
        <Menu mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
      </Sider>
      <Layout>
        <Header className="admin-header">
          <div className="admin-header__account">
            <strong>{user?.fullName}</strong>
            <small>{user?.email}</small>
          </div>
          <Button
            icon={<LogoutOutlined />}
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Đăng xuất
          </Button>
        </Header>
        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
      <Modal
        open={welcomeOpen}
        title="Xin chào"
        onCancel={() => setWelcomeOpen(false)}
        onOk={() => setWelcomeOpen(false)}
        okText="Đóng"
        cancelButtonProps={{ style: { display: "none" } }}
      >
        <p style={{ margin: 0 }}>
          {user?.fullName
            ? `Chào mừng ${user.fullName} quay lại trang quản trị.`
            : "Chào mừng bạn quay lại trang quản trị."}
        </p>
      </Modal>
    </Layout>
  );
}
