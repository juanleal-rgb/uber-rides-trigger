/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: [
        {
          loader: "@svgr/webpack",
          options: {
            ref: true,
            svgoConfig: {
              plugins: [
                {
                  name: "preset-default",
                  params: {
                    overrides: {
                      removeViewBox: false,
                      mergePaths: false,
                      collapseGroups: false,
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    });
    return config;
  },
};

export default nextConfig;
