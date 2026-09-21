/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['antd', '@ant-design/icons', '@ant-design/cssinjs', 'rc-pagination', 'rc-picker', 'rc-util'],
};

export default nextConfig;
