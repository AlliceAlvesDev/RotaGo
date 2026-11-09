import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RotaGo",
    short_name: "RotaGo",
    description: "Ganhos, custos e lucro real das suas rotas.",
    start_url: "/",
    display: "standalone",
    background_color: "#090b10",
    theme_color: "#090b10",
    orientation: "portrait",
    icons: [
      { src: "/logo-symbol.png", sizes: "177x144", type: "image/png", purpose: "any" },
    ],
  };
}
